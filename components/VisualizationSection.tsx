"use client";

import { askDatabase } from "@/lib/ask-bridge";

const CHART_EXAMPLES = [
  { label: "Pie", q: "Show me a pie chart of employees by department" },
  { label: "Bar", q: "Compare average salary across departments as a bar chart" },
  { label: "Line", q: "Plot hiring over the last five years" },
];

export function VisualizationSection({ onSelect = askDatabase }: { onSelect?: (q: string) => void }) {
  return (
    <section className="border-t border-ink-800 bg-ink-900 py-24 sm:py-28">
      <div className="section">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow">Visualization</p>
            <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight text-ink-100 sm:text-4xl">
              The table is the truth.
              <br />
              <span className="italic text-accent-400">The chart is the lens.</span>
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-6 text-ink-500">
              When the returned data supports a comparison, distribution, or trend,
              DataMind can offer a bar, line, or pie representation. The chart uses
              the same rows shown in the result, not a second or fabricated dataset.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {CHART_EXAMPLES.map((c) => (
                <button key={c.label} type="button" onClick={() => onSelect?.(c.q)}
                  className="border border-ink-700 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-400 transition-colors hover:border-accent-500/60 hover:text-accent-400">
                  {c.label} example ↗
                </button>
              ))}
            </div>
          </div>

          <div className="border border-ink-800 bg-ink-950">
            <div className="grid grid-cols-3 border-b border-ink-800">
              {[["01", "Real rows"], ["02", "Valid config"], ["03", "Chart"]].map(([n, label]) => (
                <div key={n} className="border-r border-ink-800 px-4 py-4 last:border-r-0">
                  <span className="font-mono text-[9px] text-accent-400">{n}</span>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{label}</p>
                </div>
              ))}
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex h-56 items-end gap-3 border-b border-ink-800 px-2">
                {[35, 58, 44, 78, 52, 68].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div className="w-full bg-accent-500/60" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-700">conceptual view</span>
                <span className="text-right text-[10px] text-ink-600">actual charts appear after a real query</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t border-ink-800 bg-ink-950 py-24 text-center sm:py-28">
      <div className="section">
        <p className="eyebrow">The point is simple</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl leading-tight text-ink-100 sm:text-4xl">
          Your database already has the answers.
          <br />
          <span className="italic text-accent-400">Ask the question.</span>
        </h2>
        <a href="#ask" className="btn-primary mt-9 inline-flex">Try DataMind ↗</a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950 py-9">
      <div className="section flex flex-col gap-3 text-center text-[10px] uppercase tracking-[0.14em] text-ink-700 sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <span className="font-display text-sm italic normal-case tracking-normal text-ink-300">DataMind</span>
        <span>Powered by your database. Not fabricated answers.</span>
        <span>© {new Date().getFullYear()} DataMind</span>
      </div>
    </footer>
  );
}
