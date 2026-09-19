const BLOCKED_PATTERNS = [
  /drop\s+database/i,
  /truncate\s+/i,
  /grant\s+superuser/i,
  /revoke\s+all/i,
  /alter\s+system/i,
  /copy\s+.*program/i,
  /pg_sleep/i,
  /information_schema\.role/i,
];

export interface SqlValidationResult {
  valid: boolean;
  blockedReason?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
}

export function validateSqlSafety(
  sql: string
): SqlValidationResult {
  const normalized = sql.trim();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        valid: false,
        blockedReason: "Blocked privileged or dangerous SQL pattern.",
        riskLevel: "critical",
        requiresConfirmation: true,
      };
    }
  }

  const lower = normalized.toLowerCase();

  if (
    lower.startsWith("delete") ||
    lower.startsWith("update") ||
    lower.startsWith("alter")
  ) {
    return {
      valid: true,
      riskLevel: "high",
      requiresConfirmation: true,
    };
  }

  if (
    lower.startsWith("insert") ||
    lower.startsWith("create")
  ) {
    return {
      valid: true,
      riskLevel: "medium",
      requiresConfirmation: true,
    };
  }

  return {
    valid: true,
    riskLevel: "low",
    requiresConfirmation: false,
  };
}
