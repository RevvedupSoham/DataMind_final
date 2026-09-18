export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-ink-800 bg-ink-950">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute right-[-12%] top-[10%] h-[520px] w-[520px] rounded-full bg-accent-500/[0.07] blur-[130px]" />
        <div className="absolute bottom-0 left-0 h-px w-1/2 bg-gradient-to-r from-accent-400/50 to-transparent" />
      </div>

      <div className="section relative z-10 grid min-h-[calc(100vh-72px)] items-center gap-14 pb-20 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:pb-24 lg:pt-36">
        <div>
          <div className="animate-fade-up flex items-center gap-3">
            <span className="eyebrow">Natural language / PostgreSQL</span>
            <span className="h-px w-10 bg-ink-700" />
            <span className="font-mono text-[9px] text-ink-600">v1.0</span>
          </div>

          <h1 className="animate-fade-up mt-7 max-w-4xl font-display text-[3.25rem] leading-[0.98] tracking-[-0.03em] text-ink-100 sm:text-6xl lg:text-[5.5rem]">
            Ask your database
            <br />
            <span className="italic text-accent-400">in plain English.</span>
          </h1>

          <p className="animate-fade-up mt-8 max-w-xl text-base leading-7 text-ink-400 sm:text-lg" style={{ animationDelay: "0.08s" }}>
            DataMind translates a question into PostgreSQL, validates it independently,
            checks the user&apos;s data scope, and returns the answer from the real database.
          </p>

          <div className="animate-fade-up mt-10 flex flex-wrap gap-3" style={{ animationDelay: "0.16s" }}>
            <a href="#ask" className="btn-primary">Start asking <span aria-hidden>↗</span></a>
            <a href="#how-it-works" className="btn-ghost">See the process</a>
          </div>

          <div className="animate-fade-up mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink-800 pt-5" style={{ animationDelay: "0.24s" }}>
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink-500"><span className="h-1.5 w-1.5 rounded-full bg-accent-400" />Real PostgreSQL</span>
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink-500"><span className="h-1.5 w-1.5 rounded-full bg-accent-400" />Employee-level access</span>
            <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink-500"><span className="h-1.5 w-1.5 rounded-full bg-accent-400" />SQL transparency</span>
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "0.18s" }}>
          <div className="relative border border-ink-800 bg-ink-900/70">
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">Query path</span>
              <span className="font-mono text-[9px] text-accent-400">SOURCE OF TRUTH / DB</span>
            </div>

            <div className="divide-y divide-ink-800">
              {[
                ["01", "Question", "natural language"],
                ["02", "SQL", "Groq translation"],
                ["03", "Access", "role + employee scope"],
                ["04", "Database", "PostgreSQL"],
                ["05", "Result", "rows + optional chart"],
              ].map(([n, title, meta], index) => (
                <div key={n} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-800/40">
                  <span className="font-mono text-[10px] text-ink-600">{n}</span>
                  <span className="h-1.5 w-1.5 rounded-full border border-accent-400/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-100">{title}</p>
                    <p className="mt-0.5 text-xs text-ink-600">{meta}</p>
                  </div>
                  {index < 4 && <span className="text-ink-700">↓</span>}
                </div>
              ))}
            </div>

            <div className="border-t border-ink-800 px-5 py-4">
              <p className="font-mono text-[10px] leading-5 text-ink-600">LLM translates. PostgreSQL answers.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
