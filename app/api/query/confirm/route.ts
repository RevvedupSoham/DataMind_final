import { NextRequest, NextResponse } from "next/server";
import { validateSql } from "@/lib/sql/validator";
import { executePrivilegedQuery, DatabaseError, AuthorizationError } from "@/lib/database/supabase";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { QueryErrorResponse, QueryResponse } from "@/types/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(
  stage: QueryErrorResponse["error"]["stage"],
  message: string,
  status: number
) {
  return NextResponse.json<QueryErrorResponse>({ error: { stage, message } }, { status });
}

/**
 * Executes a write statement that was previously returned by POST /api/query
 * as a pending confirmation. This is the ONLY route that ever calls
 * executePrivilegedQuery, and it re-verifies both the session (must be
 * admin) and the SQL itself (via validateSql) rather than trusting the
 * client's copy of what /api/query originally returned.
 * 
 * Now also enforces employee-level authorization via employeeId.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return errorResponse("auth", "Please log in.", 401);
  }
  if (session.role !== "admin") {
    return errorResponse("auth", "Only admin accounts can confirm and run write statements.", 403);
  }

  const { role, employeeId } = session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("validation", "Request body must be valid JSON.", 400);
  }

  const { sql, explanation, question } = (body as {
    sql?: unknown;
    explanation?: unknown;
    question?: unknown;
  }) ?? {};

  if (typeof sql !== "string" || !sql.trim()) {
    return errorResponse("validation", "No statement was provided to confirm.", 400);
  }

  // Re-validate independently — never execute a client-supplied string
  // without running it through the same safety boundary as a freshly
  // generated statement.
  const validation = validateSql(sql, { allowWrites: true });
  if (!validation.ok || !validation.sql) {
    return errorResponse(
      "sql_safety",
      validation.reason || "This statement could not be safely executed.",
      422
    );
  }

  let result;
  try {
    result = await executePrivilegedQuery(validation.sql, role, employeeId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      console.warn("[DataMind] Authorization error on write:", err.message);
      return errorResponse("authorization", err.message, 403);
    }
    if (err instanceof DatabaseError) {
      console.error("[DataMind] Privileged execution error:", err.message);
      return errorResponse("database", err.message, 502);
    }
    console.error("[DataMind] Unexpected privileged execution failure:", err);
    return errorResponse("database", "The statement could not be executed. Please try again.", 500);
  }

  const response: QueryResponse = {
    question: typeof question === "string" ? question : "",
    sql: validation.sql,
    explanation: typeof explanation === "string" ? explanation : "",
    result,
    visualizations: [],
    isWrite: true,
  };

  return NextResponse.json<QueryResponse>(response, { status: 200 });
}
