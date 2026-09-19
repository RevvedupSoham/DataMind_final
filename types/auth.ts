export type UserRole = "owner" | "admin" | "member";

export interface SessionPayload {
  username: string;
  role: UserRole;
  /**
   * Employee ID this user is mapped to.
   * OWNER users are intentionally outside employee hierarchy scope,
   * so this field is nullable for owner sessions.
   */
  employeeId: number | null;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. */
  exp: number;
}

export interface LoginRequestBody {
  username: string;
  password: string;
  /**
   * Explicit authentication panel.
   * OWNER authentication is isolated from employee-scoped auth tables.
   */
  panel: UserRole;
}

export interface SessionUser {
  username: string;
  role: UserRole;
  employeeId: number | null;
}

export interface OwnerUserRecord {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  created_at: string;
}
