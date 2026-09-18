const STEPS = [
  {
    n: "01",
    title: "Ask",
    body: "Type a plain-English question about the employee database — no SQL required.",
  },
  {
    n: "02",
    title: "Generate",
    body: "Groq routes your question to openai/gpt-oss-120b, which drafts a single read-only PostgreSQL query against the verified schema.",
  },
  {
    n: "03",
    title: "Query",
    body: "The generated SQL is independently validated, then executed against your real Supabase PostgreSQL database.",
  },
  {
    n: "04",
    title: "Understand",
    body: "The real rows come back. DataMind shows the SQL, the data, and — when it fits — a chart built strictly from that data.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-ink-800 bg-ink-900 py-28">
      <div className="section">
        <p className="eyebrow mb-4">How it works</p>
        <h2 className="max-w-2xl font-display text-3xl text-ink-100 sm:text-4xl">
          Four steps between your question and a real answer.
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-ink-800 bg-ink-800 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="animate-fade-up bg-ink-900 p-8"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <span className="font-display text-3xl italic text-accent-400">{step.n}</span>
              <h3 className="mt-4 text-sm font-semibold uppercase tracking-widest2 text-ink-100">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
