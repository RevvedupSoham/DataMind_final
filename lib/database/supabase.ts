import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { QueryResult, QueryResultRow } from "@/types/query";

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedConfig = "";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Supabase now recommends the server-only secret key. Keep the legacy
  // service-role variable as a fallback so existing setups keep working.
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secretKey) {
    throw new DatabaseError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY) in .env.local."
    );
  }

  const config = `${url}\n${secretKey}`;
  if (cachedClient && cachedConfig === config) return cachedClient;

  try {
    cachedClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    cachedConfig = config;
    return cachedClient;
  } catch (error) {
    console.error("[DataMind] Failed to initialize Supabase client:", error);
    throw new DatabaseError("The Supabase connection settings are invalid.");
  }
}

function inferColumnType(value: unknown): "number" | "date" | "boolean" | "string" | "null" {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) return "date";
    return "string";
  }
  return "string";
}

function inferColumnTypes(rows: QueryResultRow[], columns: string[]) {
  const types: QueryResult["columnTypes"] = {};
  for (const col of columns) {
    const sample = rows.find((row) => row[col] !== null && row[col] !== undefined);
    types[col] = sample ? inferColumnType(sample[col]) : "null";
  }
  return types;
}

/**
 * Executes a validated read-only SQL statement through the Supabase RPC
 * function created by setup.sql. The secret/service-role key is used only on
 * the server and this module is explicitly server-only.
 */
export async function executeReadonlyQuery(sql: string): Promise<QueryResult> {
  const client = getServiceClient();

  let data: unknown;
  let error: { message?: string; code?: string; details?: string } | null = null;

  try {
    const response = await client.rpc("execute_readonly_sql", { query: sql });
    data = response.data;
    error = response.error;
  } catch (err) {
    console.error("[DataMind] Supabase RPC/network error:", err);
    throw new DatabaseError(
      "DataMind could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL, the server API key, and your network connection."
    );
  }

  if (error) {
    console.error("[DataMind] Supabase execution error:", error);

    const message = error.message ?? "unknown Supabase error";
    if (/execute_readonly_sql|function .* does not exist|404/i.test(message)) {
      throw new DatabaseError(
        "The Supabase read-only function is missing. Open Supabase SQL Editor and run setup.sql once."
      );
    }

    throw new DatabaseError(
      "Supabase rejected the database query. Check that setup.sql has been run and that the database schema matches DataMind."
    );
  }

  const rows = (Array.isArray(data) ? data : []) as QueryResultRow[];
  const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];

  return {
    rows,
    rowCount: rows.length,
    columns,
    columnTypes: inferColumnTypes(rows, columns),
  };
}

/**
 * Executes an admin-authorized statement (including DDL/DML) through the
 * `execute_privileged_sql` RPC (see auth_setup.sql). This must ONLY ever be
 * called after the route handler has verified, from a signed session
 * cookie, that the request is from an authenticated admin — this function
 * itself does not and cannot re-check that.
 *
 * For a SELECT/WITH statement this behaves like executeReadonlyQuery. For a
 * write statement (INSERT/UPDATE/DELETE/CREATE/DROP/ALTER/TRUNCATE) it
 * returns an empty result set — there are no rows to show, only the fact
 * that the statement ran.
 */
export async function executePrivilegedQuery(sql: string): Promise<QueryResult> {
  const client = getServiceClient();

  let data: unknown;
  let error: { message?: string; code?: string; details?: string } | null = null;

  try {
    const response = await client.rpc("execute_privileged_sql", { query: sql });
    data = response.data;
    error = response.error;
  } catch (err) {
    console.error("[DataMind] Supabase privileged RPC/network error:", err);
    throw new DatabaseError(
      "DataMind could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL, the server API key, and your network connection."
    );
  }

  if (error) {
    console.error("[DataMind] Supabase privileged execution error:", error);

    const message = error.message ?? "unknown Supabase error";
    if (/execute_privileged_sql|function .* does not exist|404/i.test(message)) {
      throw new DatabaseError(
        "The Supabase admin execution function is missing. Open the SQL Editor and run auth_setup.sql once."
      );
    }
    if (/not permitted|restricted|disallowed|Multiple statements|Unrecognized/i.test(message)) {
      throw new DatabaseError(message);
    }

    throw new DatabaseError(
      "Supabase rejected the statement. Check that auth_setup.sql has been run and that the statement is valid for the current schema."
    );
  }

  const rows = (Array.isArray(data) ? data : []) as QueryResultRow[];
  const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];

  return {
    rows,
    rowCount: rows.length,
    columns,
    columnTypes: inferColumnTypes(rows, columns),
  };
}

/**
 * Lightweight server-side connection test used by /api/health.
 * It verifies that the configured credentials can call the DataMind RPC.
 */
export async function checkDatabaseConnection(): Promise<void> {
  await executeReadonlyQuery("SELECT 1 AS connected");
}

/**
 * Verifies a username/password for ONE specific panel — "admin" or
 * "member" — against that panel's own table only.
 *
 * There is no shared users table and no role column being compared here.
 * An "admin" panel call runs verify_admin_login, which queries
 * admin_users only; a "member" panel call runs verify_member_login,
 * which queries member_users only (see auth_setup.sql). An admin's
 * credentials are structurally invisible to the member check and vice
 * versa — not just filtered out after a lookup, but never queried at all.
 *
 * Returns the granted role ("admin" | "member") on success — which is
 * simply the panel that was checked, since success is only possible
 * against that panel's own table — or null on any failure (unknown
 * user, wrong password, missing setup).
 */
export async function verifyCredentials(
  username: string,
  password: string,
  panel: "admin" | "member"
): Promise<"admin" | "member" | null> {
  const client = getServiceClient();

  const rpcName = panel === "admin" ? "verify_admin_login" : "verify_member_login";

  const { data, error } = await client.rpc(rpcName, {
    p_username: username,
    p_password: password,
  });

  if (error) {
    console.error(`[DataMind] ${rpcName} RPC error:`, error.message);
    return null;
  }

  return data === true ? panel : null;
}
