export type UserRole = "owner" | "admin" | "member";

export interface SessionPayload {
  username: string;
  role: UserRole;
  /** Employee ID for admin/member; null for owner. */
  employeeId: number | null;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. */
  exp: number;
}

export interface LoginRequestBody {
  username: string;
  password: string;
  panel: UserRole;
}

export interface SessionUser {
  username: string;
  role: UserRole;
  employeeId: number | null;
}
