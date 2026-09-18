import { NextRequest, NextResponse } from "next/server";
import { generateSqlFromQuestion, LlmError } from "@/lib/llm/groq";
import { validateSql } from "@/lib/sql/validator";
import { executeReadonlyQuery, DatabaseError } from "@/lib/database/supabase";
import { getVisualizationOptions, isVisualizationRenderable } from "@/lib/visualization/engine";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { QueryErrorResponse, QueryPendingConfirmation, QueryResponse } from "@/types/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 500;

function errorResponse(
  stage: QueryErrorResponse["error"]["stage"],
  message: string,
  status: number
) {
  return NextResponse.json<QueryErrorResponse>({ error: { stage, message } }, { status });
}

export async function POST(req: NextRequest) {
  // Middleware already blocks unauthenticated requests to /api/* routes,
  // but this route re-verifies the session itself rather than trusting
  // that middleware ran — the role decision below is security-sensitive.
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return errorResponse("auth", "Please log in.", 401);
  }
  const allowWrites = session.role === "admin";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("validation", "Request body must be valid JSON.", 400);
  }

  const question = (body as { question?: unknown })?.question;

  if (typeof question !== "string" || question.trim().length === 0) {
    return errorResponse("validation", "Please enter a question before asking DataMind.", 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return errorResponse(
      "validation",
      `Questions are limited to ${MAX_QUESTION_LENGTH} characters.`,
      400
    );
  }

  // 1. Natural language -> SQL, via Groq (openai/gpt-oss-120b). The system
  //    prompt itself differs by role (see lib/sql/schema.ts), but the real
  //    permission boundary is the validator in step 2, not this prompt.
  let generated;
  try {
    generated = await generateSqlFromQuestion(question.trim(), allowWrites);
  } catch (err) {
    if (err instanceof LlmError) {
      console.error("[DataMind] LLM error:", err.message);
      return errorResponse("llm", err.message, 502);
    }
    console.error("[DataMind] Unexpected LLM failure:", err);
    return errorResponse("llm", "An unexpected error occurred while generating SQL.", 500);
  }

  // 2. Independent server-side safety validation. This NEVER trusts the LLM,
  //    and allowWrites here comes only from the verified session role above
  //    — never from anything in the request body.
  const validation = validateSql(generated.sql, { allowWrites });
  if (!validation.ok || !validation.sql) {
    console.warn("[DataMind] Rejected unsafe SQL:", generated.sql, "-", validation.reason);
    return errorResponse(
      "sql_safety",
      validation.reason || "This query could not be safely executed. Please rephrase your question.",
      422
    );
  }

  // 3. If this is a write statement, stop here and hand it back for the
  //    admin to explicitly confirm — DataMind never silently modifies data
  //    from a single natural-language turn, even for admins.
  if (validation.isWrite) {
    const pending: QueryPendingConfirmation = {
      pending: true,
      question: question.trim(),
      sql: validation.sql,
      explanation: generated.explanation,
    };
    return NextResponse.json(pending, { status: 200 });
  }

  // 4. Execute the read-only statement against the real Supabase Postgres database.
  let result;
  try {
    result = await executeReadonlyQuery(validation.sql);
  } catch (err) {
    if (err instanceof DatabaseError) {
      console.error("[DataMind] Database error:", err.message);
      return errorResponse("database", err.message, 502);
    }
    console.error("[DataMind] Unexpected database failure:", err);
    return errorResponse("database", "The query could not be executed. Please try again.", 500);
  }

  // 5. Determine every chart type that's genuinely valid for the real
  //    returned data — computed together now so switching views on the
  //    frontend is instant, not a second round trip per chart type.
  const visualizations = getVisualizationOptions(result, question).filter((config) =>
    isVisualizationRenderable(config, result)
  );

  const response: QueryResponse = {
    question: question.trim(),
    sql: validation.sql,
    explanation: generated.explanation,
    result,
    visualizations,
  };

  return NextResponse.json<QueryResponse>(response, { status: 200 });
}
