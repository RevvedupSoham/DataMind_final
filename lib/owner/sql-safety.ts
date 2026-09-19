const HARD_BLOCK_PATTERNS = [
  /grant\s+superuser/i,
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

  for (const pattern of HARD_BLOCK_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        valid: false,
        blockedReason:
          "Blocked by DataMind governance protections.",
        riskLevel: "critical",
        requiresConfirmation: true,
      };
    }
  }

  const lower = normalized.toLowerCase();

  if (
    lower.startsWith("drop") ||
    lower.startsWith("truncate")
  ) {
    return {
      valid: true,
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

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
