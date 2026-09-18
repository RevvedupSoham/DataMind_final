export type UserRole = "admin" | "member";

export interface SessionPayload {
  username: string;
  role: UserRole;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. */
  exp: number;
}

export interface LoginRequestBody {
  username: string;
  password: string;
  /**
   * Which login panel the user selected — "admin" or "member". This
   * directly determines which table/RPC is checked (verify_admin_login
   * against admin_users, or verify_member_login against member_users —
   * see auth_setup.sql and lib/database/supabase.ts). It is not a
   * UX-only hint: the two panels are structurally separate, so there is
   * no cross-table fallback or comparison happening anywhere.
   */
  panel: UserRole;
}

export interface SessionUser {
  username: string;
  role: UserRole;
}
