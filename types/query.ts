import type { VisualizationConfig } from "./visualization";

/** A raw natural-language question submitted by the user. */
export interface UserQuery {
  question: string;
}

/** Structured output requested from the LLM. */
export interface GeneratedSQL {
  sql: string;
  explanation: string;
}

/** A single generic result row. Column names are dynamic — determined by the query. */
export type QueryResultRow = Record<string, unknown>;

export interface QueryResult {
  rows: QueryResultRow[];
  rowCount: number;
  columns: string[];
  /** Best-effort per-column type, inferred from the returned values. */
  columnTypes: Record<string, "number" | "date" | "boolean" | "string" | "null">;
}

export type QueryStatus =
  | "idle"
  | "generating_sql"
  | "running_query"
  | "preparing_results"
  | "success"
  | "needs_confirmation"
  | "error";

export interface QueryError {
  stage: "validation" | "llm" | "sql_safety" | "database" | "auth" | "unknown";
  message: string;
}

export interface QueryResponse {
  question: string;
  sql: string;
  explanation: string;
  result: QueryResult;
  /**
   * Every chart type that is genuinely valid for this result, computed
   * together in the same request. Empty means table-only. The frontend
   * shows one at a time, switched via buttons — this array is what makes
   * that switch instant instead of a second round trip per chart type.
   */
  visualizations: VisualizationConfig[];
  /** True when this response is the result of an executed write statement. */
  isWrite?: boolean;
}

/**
 * Returned instead of QueryResponse when an authenticated admin's question
 * translated into a write statement (INSERT/UPDATE/DELETE/CREATE/DROP/
 * ALTER/TRUNCATE). The statement is shown for review but is NOT executed
 * until the admin explicitly confirms via POST /api/query/confirm.
 */
export interface QueryPendingConfirmation {
  pending: true;
  question: string;
  sql: string;
  explanation: string;
}

/** Shape returned by POST /api/query on failure. */
export interface QueryErrorResponse {
  error: QueryError;
}
