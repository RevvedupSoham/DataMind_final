import type { SessionPayload, UserRole } from "@/types/auth";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function requireAuthenticatedUser(
  session: SessionPayload | null
): SessionPayload {
  if (!session) {
    throw new AuthorizationError("Authentication required.");
  }

  return session;
}

export function requireRole(
  session: SessionPayload | null,
  allowedRoles: UserRole[]
): SessionPayload {
  const authenticatedSession = requireAuthenticatedUser(session);

  if (!allowedRoles.includes(authenticatedSession.role)) {
    throw new AuthorizationError(
      `Role ${authenticatedSession.role} is not authorized.`
    );
  }

  return authenticatedSession;
}

export function requireOwner(
  session: SessionPayload | null
): SessionPayload {
  return requireRole(session, ["owner"]);
}

export function requireAdminOrOwner(
  session: SessionPayload | null
): SessionPayload {
  return requireRole(session, ["admin", "owner"]);
}

export function canExecutePrivilegedSql(role: UserRole): boolean {
  return role === "admin" || role === "owner";
}
