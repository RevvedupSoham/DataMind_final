"use client";

import { askDatabase } from "@/lib/ask-bridge";

const EXAMPLES = [
  {
    title: "Second-Highest Salary",
    body: "Ranking and windowed comparisons within a department.",
    q: "In finance, who earns the second highest salary?",
  },
  {
    title: "Multi-Department Employees",
    body: "Detecting employees allocated across more than one department.",
    q: "Who is working in more than one department?",
  },
  {
    title: "Manager Hierarchies",
    body: "Recursive traversal of direct and indirect reports.",
    q: "Which managers have 50 or more employees under them, direct or indirect?",
  },
  {
    title: "Department Headcount",
    body: "Grouped counts across the organization.",
    q: "How many people work in each department?",
  },
  {
    title: "City Distribution",
    body: "Geographic aggregation from employee addresses.",
    q: "Which city has the most employees?",
  },
];

export function Examples({ onSelect = askDatabase }: { onSelect?: (q: string) => void }) {
  return (
    <section id="examples" className="border-t border-ink-800 bg-ink-900 py-28">
      <div className="section">
        <p className="eyebrow mb-4">Capabilities</p>
        <h2 className="max-w-2xl font-display text-3xl text-ink-100 sm:text-4xl">
          Built for real organizational questions.
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.title}
              onClick={() => onSelect?.(ex.q)}
              className="group flex flex-col items-start rounded-sm border border-ink-800 bg-ink-950 p-7 text-left transition-colors duration-200 hover:border-accent-500/60"
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest2 text-accent-400">
                {ex.title}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">{ex.body}</p>
              <span className="mt-5 text-sm text-ink-300 transition-colors group-hover:text-ink-100">
                “{ex.q}”
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
