import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { QueryResult, QueryResultRow } from "@/types/query";

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
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
 * Executes a validated read-only SQL statement with authorization enforcement.
 * Uses execute_authorized_sql RPC which enforces employee-level access policies.
 */
export async function executeReadonlyQuery(
  sql: string,
  role: "admin" | "member",
  employeeId: number
): Promise<QueryResult> {
  const client = getServiceClient();

  let data: unknown;
  let error: { message?: string; code?: string; details?: string } | null = null;

  try {
    const response = await client.rpc("execute_authorized_sql", { 
      p_sql: sql,
      p_role: role,
      p_employee_id: employeeId
    });
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
    
    // Check for authorization errors
    if (message.includes("cannot access") || 
        message.includes("requires admin") || 
        message.includes("restricted") ||
        message.includes("authorization")) {
      throw new AuthorizationError(message);
    }
    
    if (/execute_authorized_sql|function .* does not exist|404/i.test(message)) {
      throw new DatabaseError(
        "The Supabase authorization function is missing. Open Supabase SQL Editor and run auth_setup.sql once."
      );
    }

    throw new DatabaseError(
      "Supabase rejected the database query. Check that auth_setup.sql has been run and that the database schema matches DataMind."
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
 * `execute_privileged_sql` RPC with authorization enforcement.
 */
export async function executePrivilegedQuery(
  sql: string,
  role: "admin" | "member",
  employeeId: number
): Promise<QueryResult> {
  if (role !== "admin") {
    throw new AuthorizationError("Write operations require admin access.");
  }

  const client = getServiceClient();

  let data: unknown;
  let error: { message?: string; code?: string; details?: string } | null = null;

  try {
    const response = await client.rpc("execute_privileged_sql", { 
      p_sql: sql,
      p_role: role,
      p_employee_id: employeeId
    });
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
    
    // Check for authorization errors
    if (message.includes("cannot access") || 
        message.includes("requires admin") || 
        message.includes("restricted") ||
        message.includes("authorization")) {
      throw new AuthorizationError(message);
    }
    
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
 * Loads the authenticated employee's compact profile for the post-login
 * workspace. The employeeId comes only from the verified server session.
 */
export async function getEmployeeProfile(employeeId: number) {
  const client = getServiceClient();

  const { data: employee, error: employeeError } = await client
    .from("employee")
    .select("id, name, hire_date, manager_id, dept_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError || !employee) {
    console.error("[DataMind] Employee profile lookup failed:", employeeError?.message);
    throw new DatabaseError("Could not load the authenticated employee profile.");
  }

  const [{ data: department }, { data: manager }, { data: address }, { data: salary }] =
    await Promise.all([
      client.from("department").select("id, name, location").eq("id", employee.dept_id).maybeSingle(),
      employee.manager_id
        ? client.from("employee").select("id, name").eq("id", employee.manager_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      client.from("address").select("city, state, pin_code").eq("employee_id", employeeId).maybeSingle(),
      client
        .from("salary")
        .select("amount, currency, effective_from")
        .eq("employee_id", employeeId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!department) {
    throw new DatabaseError("Could not load the employee department.");
  }

  let reportCount = 0;
  try {
    const { count } = await client
      .from("employee")
      .select("id", { count: "exact", head: true })
      .eq("manager_id", employeeId);
    reportCount = count ?? 0;
  } catch {
    // Profile rendering should remain useful even if the optional count fails.
  }

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      hireDate: employee.hire_date,
      managerId: employee.manager_id,
    },
    department: {
      id: department.id,
      name: department.name,
      location: department.location,
    },
    manager: manager ? { id: manager.id, name: manager.name } : null,
    address: address
      ? { city: address.city, state: address.state, pinCode: address.pin_code }
      : null,
    salary: salary
      ? { amount: salary.amount, currency: salary.currency, effectiveFrom: salary.effective_from }
      : null,
    directReports: reportCount,
  };
}

/**
 * Lightweight server-side connection test used by /api/health.
 * It verifies that the configured credentials can call the DataMind RPC.
 */
export async function checkDatabaseConnection(): Promise<void> {
  const client = getServiceClient();
  // Use a simple query that doesn't require authorization
  const { error } = await client.rpc("execute_readonly_sql", { 
    query: "SELECT 1 AS connected" 
  });
  if (error) {
    throw new DatabaseError("Database connection check failed");
  }
}

/**
 * Verifies a username/password for ONE specific panel — "admin" or
 * "member" — against that panel's own table only, and returns the
 * employee_id if authentication succeeds.
 *
 * Returns { role, employeeId } on success, or null on failure.
 */
export async function verifyCredentials(
  username: string,
  password: string,
  panel: "admin" | "member"
): Promise<{ role: "admin" | "member"; employeeId: number } | null> {
  const client = getServiceClient();

  const rpcName = panel === "admin" ? "verify_admin_login" : "verify_member_login";

  const { data, error } = await client.rpc(rpcName, {
    p_username: username,
    p_password: password,
  });

  if (error) {
    console.error(`[DataMind] ${rpcName} RPC error:`, error.message);

    if (/function .* does not exist|could not find the function|schema cache/i.test(error.message)) {
      throw new DatabaseError(
        "DataMind authentication is not initialized. Run auth_setup.sql in the Supabase SQL Editor, then try again."
      );
    }

    throw new DatabaseError(
      "DataMind could not verify the credentials because the authentication database is unavailable."
    );
  }

  // The RPC now returns employee_id (int4) on success, NULL on failure
  if (typeof data === "number" && data > 0) {
    return { role: panel, employeeId: data };
  }

  return null;
}

/**
 * Gets all employee IDs in an admin's reporting hierarchy
 * (self + all direct and indirect reports, with cycle protection)
 */
export async function getAdminHierarchy(employeeId: number): Promise<number[]> {
  const client = getServiceClient();
  
  const { data, error } = await client.rpc("get_hierarchy", {
    p_employee_id: employeeId
  });
  
  if (error) {
    console.error("[DataMind] get_hierarchy RPC error:", error.message);
    throw new DatabaseError("Failed to retrieve employee hierarchy");
  }
  
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.map((row: { employee_id: number }) => row.employee_id);
}
