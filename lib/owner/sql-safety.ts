const HARD_BLOCK_PATTERNS = [
  /\b(grant|revoke|merge|call|execute|vacuum|copy|listen|notify|comment)\b/i,
  /\balter\s+system\b/i,
  /\b(create|alter|drop)\s+(role|user|policy|trigger|function|procedure|extension)\b/i,
  /\bdrop\s+database\b/i,
  /\bcopy\b.*\bprogram\b/i,
  /\bpg_sleep\s*\(/i,
  /\b(pg_read_file|pg_ls_dir|pg_reload_conf|lo_import|lo_export|dblink_exec|pg_terminate_backend|pg_cancel_backend)\b/i,
  /\b(information_schema\.role|pg_catalog\.pg_authid)\b/i,
  /\b(admin_users|member_users|owner_users)\b/i,
];

export interface SqlValidationResult {
  valid: boolean;
  blockedReason?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
}

function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  let quote: "'" | '"' | null = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (quote) {
      out += ch;
      if (ch === quote && next === quote) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      continue;
    }

    out += ch;
    i++;
  }

  return out.trim();
}

function hasMultipleStatements(sql: string): boolean {
  let quote: "'" | '"' | null = null;
  let count = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (quote) {
      if (ch === quote && sql[i + 1] === quote) {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === ";") {
      count++;
    }
  }

  return count > (sql.trim().endsWith(";") ? 1 : 0);
}

export function validateSqlSafety(sql: string): SqlValidationResult {
  if (typeof sql !== "string") {
    return {
      valid: false,
      blockedReason: "Generated SQL was not a string.",
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  const normalized = sql.trim();

  if (!normalized) {
    return {
      valid: false,
      blockedReason: "Generated SQL was empty.",
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  if (normalized.length > 8000) {
    return {
      valid: false,
      blockedReason: "Generated SQL exceeded the maximum allowed length.",
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  const analysisSql = stripComments(normalized);

  if (hasMultipleStatements(analysisSql)) {
    return {
      valid: false,
      blockedReason: "Multiple SQL statements are not allowed.",
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  const statement = analysisSql.replace(/;\s*$/, "").trim();

  if (/^with\b/i.test(statement) && /\b(insert|update|delete|create|alter|drop|truncate)\b/i.test(statement)) {
    return {
      valid: false,
      blockedReason:
        "WITH statements containing write or schema operations are blocked. Submit a single explicit operation.",
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  if (!/^(select|with|insert|update|delete|create|alter|drop|truncate)\b/i.test(statement)) {
    return {
      valid: false,
      blockedReason:
        "Only SELECT, WITH, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, or TRUNCATE are allowed.",
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  for (const pattern of HARD_BLOCK_PATTERNS) {
    if (pattern.test(statement)) {
      return {
        valid: false,
        blockedReason: "This database operation is blocked by DataMind governance.",
        riskLevel: "critical",
        requiresConfirmation: true,
      };
    }
  }

  if (/^(update|delete)\b/i.test(statement) && !/\bwhere\b/i.test(statement)) {
    return {
      valid: false,
      blockedReason:
        "UPDATE/DELETE without a WHERE clause is blocked. Specify the target rows explicitly.",
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  if (/^truncate\b/i.test(statement)) {
    return {
      valid: true,
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  if (/^drop\b/i.test(statement)) {
    return {
      valid: true,
      riskLevel: "critical",
      requiresConfirmation: true,
    };
  }

  if (/^(delete|update|alter)\b/i.test(statement)) {
    return {
      valid: true,
      riskLevel: "high",
      requiresConfirmation: true,
    };
  }

  if (/^(insert|create)\b/i.test(statement)) {
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
