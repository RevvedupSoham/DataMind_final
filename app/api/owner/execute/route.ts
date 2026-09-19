import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { requireOwner } from "@/lib/auth/authorization";
import { validateSqlSafety } from "@/lib/owner/sql-safety";
import { verifyOwnerApprovalToken } from "@/lib/owner/approval";
import { createAuditLog } from "@/lib/audit/logger";
import { createClient } from "@supabase/supabase-js";

function getOwnerExecutionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  try {
    requireOwner(session);
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as {
    sql?: unknown;
    approvalToken?: unknown;
    confirmed?: unknown;
  };

  const sql = typeof payload.sql === "string" ? payload.sql.trim() : "";
  const approvalToken =
    typeof payload.approvalToken === "string" ? payload.approvalToken : "";
  const confirmed = payload.confirmed === true;

  if (!sql || !approvalToken) {
    return NextResponse.json(
      { error: "SQL and an approval token are required." },
      { status: 400 }
    );
  }

  const validation = validateSqlSafety(sql);

  if (!validation.valid) {
    await createAuditLog({
      actorUsername: session!.username,
      actorRole: session!.role,
      operationType: "governed_execution",
      executionStatus: "blocked",
      metadata: {
        sql,
        blockedReason: validation.blockedReason,
        riskLevel: validation.riskLevel,
      },
    });

    return NextResponse.json(
      { error: validation.blockedReason || "SQL blocked by governance." },
      { status: 403 }
    );
  }

  const approval = verifyOwnerApprovalToken(
    approvalToken,
    session!.username,
    sql
  );

  if (!approval.valid) {
    return NextResponse.json(
      { error: approval.reason || "Invalid approval token." },
      { status: 403 }
    );
  }

  if (approval.requiresConfirmation && !confirmed) {
    return NextResponse.json(
      {
        error:
          "This operation requires explicit OWNER confirmation before execution.",
        requiresConfirmation: true,
      },
      { status: 409 }
    );
  }

  const startedAt = Date.now();

  try {
    const client = getOwnerExecutionClient();
    const { data, error } = await client.rpc("execute_owner_sql", {
      p_sql: sql,
    });

    if (error) {
      throw new Error(error.message || "SQL execution failed.");
    }

    const rows = Array.isArray(data) ? data : [];
    const executionTimeMs = Date.now() - startedAt;

    let affectedRows: number | null = null;
    if (
      rows.length === 1 &&
      rows[0] &&
      typeof rows[0] === "object" &&
      "affected_rows" in rows[0] &&
      typeof (rows[0] as { affected_rows?: unknown }).affected_rows === "number"
    ) {
      affectedRows = (rows[0] as { affected_rows: number }).affected_rows;
    }

    await createAuditLog({
      actorUsername: session!.username,
      actorRole: session!.role,
      operationType: "governed_execution",
      executionStatus: "completed",
      affectedRows,
      metadata: {
        sql,
        riskLevel: validation.riskLevel,
        executionTimeMs,
        requiresConfirmation: validation.requiresConfirmation,
        confirmed,
      },
    });

    return NextResponse.json({
      success: true,
      execution: {
        rows,
        rowCount: affectedRows ?? rows.length,
        columns:
          rows.length > 0 && rows[0]
            ? Object.keys(rows[0] as Record<string, unknown>)
            : [],
        executionTimeMs,
        riskLevel: validation.riskLevel,
        requiresConfirmation: validation.requiresConfirmation,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Execution failed.";

    await createAuditLog({
      actorUsername: session!.username,
      actorRole: session!.role,
      operationType: "governed_execution",
      executionStatus: "failed",
      metadata: {
        sql,
        riskLevel: validation.riskLevel,
        error: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
