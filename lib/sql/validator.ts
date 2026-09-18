import "server-only";
import { FORBIDDEN_KEYWORDS, FORBIDDEN_KEYWORDS_ADMIN } from "@/lib/sql/schema";

export interface ValidationResult {
  ok: boolean;
  sql?: string;
  reason?: string;
  /** True if the validated statement is a write (DML/DDL) rather than a read. */
  isWrite?: boolean;
}

const MAX_SQL_LENGTH = 4000;

// Matches a leading SELECT or WITH (including WITH RECURSIVE) statement.
const ALLOWED_READ_START = /^\s*(select|with)\b/i;

// Additionally allowed as a leading statement type for admin (write-enabled) requests.
const ALLOWED_WRITE_START = /^\s*(insert|update|delete|create|drop|alter|truncate)\b/i;

// A forbidden keyword must appear as a standalone SQL token, not as a
// substring of an identifier (e.g. "updated_at" must not trigger UPDATE).
function containsForbiddenKeyword(
  sql: string,
  keywords: readonly string[]
): string | null {
  for (const keyword of keywords) {
    const pattern = new RegExp(`(^|[^a-zA-Z0-9_])${keyword}([^a-zA-Z0-9_]|$)`, "i");
    if (pattern.test(sql)) return keyword;
  }
  return null;
}

/**
 * Strips SQL comments (line and block) so that keyword/statement checks
 * cannot be evaded by hiding forbidden tokens inside comments, and so that
 * a comment cannot be used to smuggle a second statement past a naive
 * semicolon check (e.g. "SELECT 1; -- ) DROP TABLE x").
 *
 * This is used only for ANALYSIS. We never execute the stripped version —
 * we still execute (a trimmed copy of) the original validated SQL, since
 * comments themselves are harmless once we've confirmed nothing dangerous
 * is hiding inside them.
 */
function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inSingleQuote) {
      out += ch;
      if (ch === "'" && next === "'") {
        out += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingleQuote = false;
      i += 1;
      continue;
    }

    if (inDoubleQuote) {
      out += ch;
      if (ch === '"') inDoubleQuote = false;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      out += ch;
      i += 1;
      continue;
    }

    // Line comment
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }

    // Block comment (handles nesting defensively, Postgres nests these)
    if (ch === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth += 1;
          i += 2;
          continue;
        }
        if (sql[i] === "*" && sql[i + 1] === "/") {
          depth -= 1;
          i += 2;
          continue;
        }
        i += 1;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * Counts top-level statement-terminating semicolons outside of string
 * literals, ignoring a single optional trailing semicolon.
 */
function hasMultipleStatements(sql: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let semicolons = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inSingleQuote) {
      if (ch === "'" && sql[i + 1] === "'") {
        i += 1;
        continue;
      }
      if (ch === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (ch === '"') inDoubleQuote = false;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = true;
      continue;
    }
    if (ch === ";") semicolons += 1;
  }

  const trimmed = sql.trim();
  const endsWithSemicolon = trimmed.endsWith(";");
  const effectiveCount = endsWithSemicolon ? semicolons - 1 : semicolons;
  return effectiveCount > 0;
}

/**
 * Independent, server-side SQL safety validator.
 *
 * This is the actual security boundary for DataMind (PROJECT section 9).
 * It does NOT trust:
 *   - the LLM's system prompt instructions
 *   - the LLM's own claim that the query is safe
 *   - the presence/absence of any particular phrasing in the user's question
 *   - a client-supplied role (allowWrites is decided server-side by the
 *     caller from a verified session, never from request input)
 *
 * It only trusts what it can verify about the literal SQL string itself.
 *
 * @param options.allowWrites When true (admin sessions only), permits a
 * single INSERT/UPDATE/DELETE/CREATE/DROP/ALTER/TRUNCATE statement in
 * addition to SELECT/WITH. GRANT/REVOKE/MERGE/CALL/EXECUTE and other
 * privilege-escalation or server-admin operations remain forbidden
 * regardless of this flag — there is no role that unlocks them.
 */
export function validateSql(
  rawSql: unknown,
  options: { allowWrites?: boolean } = {}
): ValidationResult {
  const { allowWrites = false } = options;

  if (typeof rawSql !== "string") {
    return { ok: false, reason: "Generated SQL was not a string." };
  }

  const sql = rawSql.trim();

  if (sql.length === 0) {
    return { ok: false, reason: "Generated SQL was empty." };
  }

  if (sql.length > MAX_SQL_LENGTH) {
    return { ok: false, reason: "Generated SQL exceeded the maximum allowed length." };
  }

  const withoutComments = stripComments(sql).trim();

  if (withoutComments.length === 0) {
    return { ok: false, reason: "Generated SQL contained no executable statement." };
  }

  const isReadStatement = ALLOWED_READ_START.test(withoutComments);
  const isWriteStatement = allowWrites && ALLOWED_WRITE_START.test(withoutComments);

  if (!isReadStatement && !isWriteStatement) {
    return {
      ok: false,
      reason: allowWrites
        ? "Only SELECT, WITH, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, or TRUNCATE statements are allowed."
        : "Only SELECT and WITH (including WITH RECURSIVE) statements are allowed. This account does not have write access.",
    };
  }

  if (hasMultipleStatements(withoutComments)) {
    return { ok: false, reason: "Multiple SQL statements are not allowed." };
  }

  // GRANT/REVOKE/MERGE/CALL/EXECUTE and the other always-forbidden keywords
  // are checked for every request, admin or not.
  const alwaysForbidden = allowWrites ? FORBIDDEN_KEYWORDS_ADMIN : FORBIDDEN_KEYWORDS;
  const forbidden = containsForbiddenKeyword(withoutComments, alwaysForbidden);
  if (forbidden) {
    return { ok: false, reason: `Forbidden keyword detected: ${forbidden}.` };
  }

  // Extra guard for admin writes: an UPDATE/DELETE with no WHERE clause
  // affects every row in the table. Require an explicit WHERE, or an
  // explicit acknowledgement phrase, to avoid a single ambiguous NL
  // request accidentally wiping a whole table.
  if (isWriteStatement) {
    const isUnqualifiedUpdateOrDelete =
      /^\s*(update|delete)\b/i.test(withoutComments) && !/\bwhere\b/i.test(withoutComments);
    if (isUnqualifiedUpdateOrDelete) {
      return {
        ok: false,
        reason:
          "This UPDATE/DELETE has no WHERE clause and would affect every row in the table. Rephrase the request to specify which row(s) to change, or explicitly say you want to affect all rows.",
      };
    }
  }

  // Reject statements that try to call/invoke arbitrary functions via
  // PERFORM, or that reference pg_catalog write helpers / superuser-only
  // functions sometimes used to escalate (defense in depth beyond the
  // keyword list above).
  const dangerousFunctionPattern =
    /\b(pg_read_file|pg_ls_dir|pg_reload_conf|lo_import|lo_export|dblink_exec|pg_terminate_backend|pg_cancel_backend)\b/i;
  if (dangerousFunctionPattern.test(withoutComments)) {
    return { ok: false, reason: "Use of a restricted database function was detected." };
  }

  // Reject stacked/backtick command injection attempts and shell-like
  // metacharacters that have no legitimate purpose in a read-only query.
  if (/\\g|\\!|xp_cmdshell/i.test(withoutComments)) {
    return { ok: false, reason: "Disallowed control sequence detected." };
  }

  // Normalize: execute the original (comment-preserving) trimmed SQL, with
  // any single trailing semicolon removed for safe embedding.
  const finalSql = sql.replace(/;\s*$/, "");

  return { ok: true, sql: finalSql, isWrite: isWriteStatement };
}
