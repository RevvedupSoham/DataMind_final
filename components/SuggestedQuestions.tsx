import type { UserRole } from "@/types/auth";

const MEMBER_QUESTIONS = [
  "What department do I work in?",
  "What is my current salary?",
  "Show my job history.",
  "How many people work in each department?",
];

const ADMIN_QUESTIONS = [
  "Which managers have 50 or more employees under them, direct or indirect?",
  "Who is working in more than one department?",
  "In finance, who earns the second highest salary?",
  "Which city has the most employees?",
  "How many people work in each department?",
];

export function SuggestedQuestions({
  onSelect,
  disabled,
  role,
}: {
  onSelect: (q: string) => void;
  disabled?: boolean;
  role?: UserRole | null;
}) {
  const questions = role === "admin" ? ADMIN_QUESTIONS : MEMBER_QUESTIONS;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600">Try a question</p>
        <span className="hidden text-[9px] uppercase tracking-[0.18em] text-ink-700 sm:block">
          {role === "admin" ? "admin scope" : "member scope"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            className="rounded-full border border-ink-700 px-3.5 py-2 text-left text-xs text-ink-400 transition-all hover:border-accent-500/60 hover:bg-accent-500/[0.04] hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
