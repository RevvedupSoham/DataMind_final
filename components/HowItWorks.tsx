const STEPS = [
  {
    n: "01",
    title: "Ask",
    body: "Write the question exactly as you would say it. No SQL syntax or database knowledge is required.",
    tag: "INPUT",
  },
  {
    n: "02",
    title: "Translate",
    body: "Groq uses the verified schema and user role to turn the question into a PostgreSQL statement.",
    tag: "LLM",
  },
  {
    n: "03",
    title: "Validate + authorize",
    body: "DataMind independently checks the statement, then enforces the logged-in employee's permitted scope.",
    tag: "CONTROL",
  },
  {
    n: "04",
    title: "Execute + explain",
    body: "Authorized SQL runs against Supabase PostgreSQL. You receive the real rows, SQL, and a suitable visualization when available.",
    tag: "DATABASE",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-ink-800 bg-ink-900 py-24 sm:py-28">
      <div className="section">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 max-w-md font-display text-3xl leading-tight text-ink-100 sm:text-4xl">
              The model translates.
              <br />
              <span className="italic text-accent-400">The database answers.</span>
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-6 text-ink-500">
              Every answer follows the same governed path. The LLM never becomes the
              source of truth, and the frontend never decides what a user is allowed to see.
            </p>
          </div>

          <div className="border-l border-ink-800">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="group grid grid-cols-[48px_1fr_auto] gap-4 border-b border-ink-800 px-5 py-6 first:border-t sm:grid-cols-[60px_1fr_auto] sm:px-7"
              >
                <span className="font-display text-xl italic text-accent-400">{step.n}</span>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-100">{step.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-ink-500">{step.body}</p>
                </div>
                <span className="self-start border border-ink-700 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-600 group-hover:border-accent-500/40 group-hover:text-accent-400">
                  {step.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
