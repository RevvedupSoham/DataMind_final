"use client";

import { useState } from "react";

export function SQLViewer({ sql, explanation }: { sql: string; explanation?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fail silently,
      // the SQL is still visible and selectable for manual copy.
    }
  }

  return (
    <div className="rounded-sm border border-ink-800 bg-ink-950">
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest2 text-ink-400">
          Generated SQL
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-semibold uppercase tracking-widest2 text-accent-400 transition-colors hover:text-accent-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto px-5 py-4 text-sm leading-relaxed">
        <code className="font-mono text-accent-300">{sql}</code>
      </pre>
      {explanation ? (
        <p className="border-t border-ink-800 px-5 py-3 text-sm leading-relaxed text-ink-400">
          {explanation}
        </p>
      ) : null}
    </div>
  );
}
