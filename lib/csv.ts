import type { QueryResult } from "@/types/query";

function csvEscapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  // Quote any field containing a comma, quote, or newline, per RFC 4180.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a QueryResult into CSV text. This works purely off the data the
 * user already has in front of them in the result table — it does not
 * re-query anything, so it can never surface more than what was already
 * returned under the user's own session/role.
 */
export function resultToCsv(result: QueryResult): string {
  const header = result.columns.map(csvEscapeCell).join(",");
  const rows = result.rows.map((row) =>
    result.columns.map((col) => csvEscapeCell(row[col])).join(",")
  );
  return [header, ...rows].join("\r\n");
}

/** Triggers a browser download of the given text content as a named file. */
export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Builds a safe, timestamped filename for a downloaded result. */
export function csvFileNameFor(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "datamind-result";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${slug}-${stamp}.csv`;
}
