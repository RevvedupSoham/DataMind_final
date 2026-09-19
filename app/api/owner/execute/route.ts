import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { requireOwner } from "@/lib/auth/authorization";
import { validateSqlSafety } from "@/lib/owner/sql-safety";
import { executePrivilegedQuery } from "@/lib/database/supabase";
import { createAuditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

const session = await verifySessionToken(token);

try {
    requireOwner(session);
  } catch {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 403 }
    );
  }

let body: unknown;

try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

const sql = (body as { sql?: string })?.sql;

if (!sql || typeof sql !== "string") {
    return NextResponse.json(
      { error: "SQL is required." },
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
      {
        error:
          validation.blockedReason ||
          "SQL blocked by governance.",
      },
      {
        status: 403,
      }
    );
  }

const startedAt = Date.now();

try {
    const result = await executePrivilegedQuery(
      sql,
      "admin",
      0
    );

const executionTimeMs = Date.now() - startedAt;

await createAuditLog({
      actorUsername: session!.username,
      actorRole: session!.role,
      operationType: "governed_execution",
      executionStatus: "completed",
      affectedRows: result.rowCount,
      metadata: {
        sql,
        riskLevel: validation.riskLevel,
        executionTimeMs,
        requiresConfirmation:
          validation.requiresConfirmation,
      },
    });

return NextResponse.json({
      success: true,
      execution: {
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.columns,
        executionTimeMs,
        riskLevel: validation.riskLevel,
        requiresConfirmation:
          validation.requiresConfirmation,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Execution failed.";

await createAuditLog({
      actorUsername: session!.username,
      actorRole: session!.role,
      operationType: "governed_execution",
      executionStatus: "failed",
      metadata: {
        sql,
        error: message,
      },
    });

return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
