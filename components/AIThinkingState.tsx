interface AIThinkingStateProps {
  title?: string;
  steps?: string[];
}

const defaultSteps = [
  "Understanding your request and intent",
  "Analyzing permissions and governance policies",
  "Generating optimized PostgreSQL queries",
  "Validating SQL safety and execution risk",
  "Preparing execution and formatting results",
];

export function AIThinkingState({
  title = "Thinking...",
  steps = defaultSteps,
}: AIThinkingStateProps) {
  return (
    <div className="overflow-hidden border border-accent-500/30 bg-gradient-to-br from-[#07141C] via-[#081A24] to-[#051018] p-6 shadow-[0_0_60px_rgba(0,255,200,0.08)]">
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-accent-400/40 bg-accent-500/10">
          <div className="absolute inset-0 animate-ping rounded-full border border-accent-400/20" />
          <div className="h-5 w-5 rounded-full bg-accent-400" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-accent-400">
            DataMind AI Engine
          </p>

          <h3 className="mt-2 text-2xl font-semibold text-ink-100">
            {title}
          </h3>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-4 border border-ink-800 bg-black/20 px-4 py-3"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-accent-400/40 text-xs font-semibold text-accent-300">
              {index + 1}
            </div>

            <div className="flex-1">
              <p className="text-sm text-ink-200">{step}</p>
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
  );
}
