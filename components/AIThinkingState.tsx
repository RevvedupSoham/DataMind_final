interface AIThinkingStateProps {
  title?: string;
  currentStage?: string;
  steps?: string[];
}

const defaultSteps = [
  "Understanding intent and context",
  "Analyzing authorization boundaries",
  "Generating optimized SQL strategy",
  "Validating governance and safety",
  "Preparing intelligent response",
];

export function AIThinkingState({
  title = "Thinking...",
  currentStage,
  steps = defaultSteps,
}: AIThinkingStateProps) {
  return (
    <div className="relative overflow-hidden border border-accent-500/20 bg-gradient-to-br from-[#06121A] via-[#071923] to-[#051018] p-6 shadow-[0_0_80px_rgba(0,255,200,0.08)] transition-all duration-500 animate-fade-in">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,255,200,0.08),transparent_45%)]" />

      <div className="relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-accent-400/30 bg-accent-500/10">
            <div className="absolute inset-0 animate-ping rounded-full border border-accent-400/20" />
            <div className="h-5 w-5 animate-pulse rounded-full bg-accent-400" />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-accent-400">
              DataMind Intelligence Engine
            </p>

            <h3 className="mt-2 text-3xl font-semibold text-ink-100">
              {title}
            </h3>

            <p className="mt-2 text-sm text-ink-500">
              {currentStage || "Coordinating AI planning and governed execution"}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {steps.map((step, index) => (
            <div
              key={step}
              className="group flex items-center gap-4 border border-ink-800 bg-black/20 px-4 py-4 transition-all duration-300 hover:border-accent-400/30 hover:bg-accent-500/5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-accent-400/30 text-xs font-semibold text-accent-300">
                {index + 1}
              </div>

              <div className="flex-1">
                <p className="text-sm text-ink-200 transition-colors duration-300 group-hover:text-ink-100">
                  {step}
                </p>
              </div>

              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
