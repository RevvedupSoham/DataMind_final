export const SUGGESTED_QUESTIONS = [
  "In finance, who earns the second highest salary?",
  "Who is working in more than one department?",
  "Which managers have 50 or more employees under them, direct or indirect?",
  "How many people work in each department?",
  "Which city has the most employees?",
];

export function SuggestedQuestions({
  onSelect,
  disabled,
}: {
  onSelect: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2.5">
      {SUGGESTED_QUESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(q)}
          className="rounded-full border border-ink-700 px-4 py-2 text-xs text-ink-300 transition-colors duration-150 hover:border-accent-400 hover:text-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
