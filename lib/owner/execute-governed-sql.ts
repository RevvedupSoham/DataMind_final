import "server-only";

import { createClient } from "@supabase/supabase-js";
import { validateSqlSafety } from "@/lib/owner/sql-safety";

export interface GovernedExecutionResult {
  success: boolean;
  rows: unknown[];
  rowCount: number;
  executionTimeMs: number;
  message: string;
}

export async function executeGovernedSql(
  sql: string
): Promise<GovernedExecutionResult> {
  const validation = validateSqlSafety(sql);

  if (!validation.valid) {
    throw new Error(
      validation.blockedReason || "Blocked by DataMind governance."
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const startedAt = Date.now();

  const { data, error } = await client.rpc("execute_owner_sql", {
    p_sql: sql,
  });

  if (error) {
    throw new Error(error.message || "SQL execution failed.");
  }

  const rows = Array.isArray(data) ? data : [];
  let affectedRows = rows.length;

  if (
    rows.length === 1 &&
    rows[0] &&
    typeof rows[0] === "object" &&
    "affected_rows" in rows[0] &&
    typeof (rows[0] as { affected_rows?: unknown }).affected_rows === "number"
  ) {
    affectedRows = (rows[0] as { affected_rows: number }).affected_rows;
  }

  return {
    success: true,
    rows,
    rowCount: affectedRows,
    executionTimeMs: Date.now() - startedAt,
    message: "Governed OWNER SQL execution completed successfully.",
  };
}
