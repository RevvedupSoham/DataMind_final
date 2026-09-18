"use client";

import { askDatabase } from "@/lib/ask-bridge";

const CHART_EXAMPLES = [
  { label: "Pie", q: "Show me a pie chart of employees by department" },
  { label: "Bar", q: "Compare average salary across departments as a bar chart" },
  { label: "Line", q: "Plot hiring over the last five years" },
];

export function VisualizationSection({ onSelect = askDatabase }: { onSelect?: (q: string) => void }) {
  return (
    <section className="border-t border-ink-800 bg-ink-950 py-28">
      <div className="section grid grid-cols-1 gap-16 md:grid-cols-2 md:items-center">
        <div>
          <p className="eyebrow mb-4">From answers to insight</p>
          <h2 className="font-display text-3xl text-ink-100 sm:text-4xl">
            DataMind chooses the chart. You never have to.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-400">
            When a question implies a comparison, a distribution, or a trend,
            DataMind inspects the real returned columns and automatically
            renders a bar, line, or pie chart — built strictly from your
            database&apos;s own results.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {CHART_EXAMPLES.map((c) => (
              <button
                key={c.label}
                onClick={() => onSelect?.(c.q)}
                className="rounded-sm border border-ink-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest2 text-ink-300 transition-colors hover:border-accent-400 hover:text-accent-400"
              >
                {c.label} — “{c.q}”
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-ink-800 bg-ink-900 p-8">
          <div className="flex items-end gap-3">
            {[38, 62, 44, 80, 56, 70].map((h, i) => (
              <div
                key={i}
                className="w-full rounded-t-sm bg-accent-500/70"
                style={{ height: `${h * 2}px` }}
              />
            ))}
          </div>
          <p className="mt-6 text-xs uppercase tracking-widest2 text-ink-500">
            Illustrative only — real charts render from your query results.
          </p>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t border-ink-800 bg-ink-900 py-28 text-center">
      <div className="section">
        <p className="eyebrow mb-4">Ready when you are</p>
        <h2 className="mx-auto max-w-2xl font-display text-3xl text-ink-100 sm:text-4xl">
          Your database already has the answers.
          <br />
          <span className="italic text-accent-400">Ask the question.</span>
        </h2>
        <a href="#ask" className="btn-primary mt-10 inline-flex">
          Try DataMind
        </a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-950 py-10">
      <div className="section flex flex-col items-center justify-between gap-4 text-xs text-ink-500 sm:flex-row">
        <span className="font-display italic text-ink-300">DataMind</span>
        <span>Powered by your database. Not fabricated answers.</span>
        <span>© {new Date().getFullYear()} DataMind</span>
      </div>
    </footer>
  );
}
