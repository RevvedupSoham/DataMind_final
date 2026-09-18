"use client";

import { useEffect, useRef, useState } from "react";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { SQLViewer } from "@/components/SQLViewer";
import { ResultView } from "@/components/ResultView";
import { ASK_EVENT } from "@/lib/ask-bridge";
import type {
  QueryErrorResponse,
  QueryPendingConfirmation,
  QueryResponse,
  QueryStatus,
} from "@/types/query";
import type { UserRole } from "@/types/auth";

const STATUS_LABELS: Record<Extract<QueryStatus, "generating_sql" | "running_query" | "preparing_results">, string> = {
  generating_sql: "Generating SQL…",
  running_query: "Running database query…",
  preparing_results: "Preparing results…",
};

const HISTORY_KEY = "datamind:history";
const MAX_HISTORY = 8;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(question: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadHistory().filter((q) => q !== question);
    const next = [question, ...existing].slice(0, MAX_HISTORY);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // localStorage can be unavailable (private browsing, quota) — history is
    // a convenience only, so we fail silently.
  }
}

export function QueryInterface() {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [pending, setPending] = useState<QueryPendingConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.role) setRole(data.role as UserRole);
      })
      .catch(() => {
        /* role badge is a nice-to-have; failing silently is fine here */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleExternalAsk(e: Event) {
      const q = (e as CustomEvent<string>).detail;
      if (typeof q === "string" && q.trim()) {
        setQuestion(q);
        submit(q);
      }
    }
    window.addEventListener(ASK_EVENT, handleExternalAsk);
    return () => window.removeEventListener(ASK_EVENT, handleExternalAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
    };
  }, []);

  const isPending = status === "generating_sql" || status === "running_query" || status === "preparing_results";

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || isPending || confirming) return;

    setError(null);
    setResponse(null);
    setPending(null);
    setStatus("generating_sql");

    // Cycle through the real pipeline phases while the single request is in
    // flight. This reflects the actual stages the server performs in order
    // (LLM generation -> DB execution -> result/visualization prep) — it is
    // not a fabricated progress percentage, just a label of what stage the
    // request is most likely in.
    const phases: QueryStatus[] = ["generating_sql", "running_query", "preparing_results"];
    let phaseIndex = 0;
    cycleRef.current = setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, phases.length - 1);
      setStatus(phases[phaseIndex]!);
    }, 1100);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errBody = data as QueryErrorResponse;
        setError(errBody?.error?.message || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      if ((data as QueryPendingConfirmation)?.pending) {
        setPending(data as QueryPendingConfirmation);
        setStatus("needs_confirmation");
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }

      setResponse(data as QueryResponse);
      setStatus("success");
      saveHistory(trimmed);
      setHistory(loadHistory());
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError("Could not reach DataMind. Check your connection and try again.");
      setStatus("error");
    } finally {
      if (cycleRef.current) {
        clearInterval(cycleRef.current);
        cycleRef.current = null;
      }
    }
  }

  async function confirmPending() {
    if (!pending || confirming) return;
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch("/api/query/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      const data = await res.json();

      if (!res.ok) {
        const errBody = data as QueryErrorResponse;
        setError(errBody?.error?.message || "The statement could not be executed.");
        setStatus("error");
        setPending(null);
        return;
      }

      setResponse(data as QueryResponse);
      setPending(null);
      setStatus("success");
    } catch {
      setError("Could not reach DataMind. Check your connection and try again.");
      setStatus("error");
      setPending(null);
    } finally {
      setConfirming(false);
    }
  }

  function cancelPending() {
    setPending(null);
    setStatus("idle");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(question);
  }

  return (
    <section id="ask" className="border-t border-ink-800 bg-ink-950 py-28">
      <div className="section">
        <div className="mb-4 flex items-center justify-between">
          <p className="eyebrow">Ask database</p>
          {role && (
            <span
              className={`rounded-sm border px-3 py-1 text-xs font-semibold uppercase tracking-widest2 ${
                role === "admin"
                  ? "border-accent-500/40 text-accent-400"
                  : "border-ink-700 text-ink-400"
              }`}
            >
              {role === "admin" ? "Admin · read & write" : "Member · read only"}
            </span>
          )}
        </div>
        <h2 className="max-w-2xl font-display text-3xl text-ink-100 sm:text-4xl">
          Ask a question. Get the real answer.
        </h2>

        <form onSubmit={handleSubmit} className="mt-10">
          <div className="rounded-sm border border-ink-700 bg-ink-900 p-2 transition-colors focus-within:border-accent-400">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(question);
                }
              }}
              placeholder={
                role === "admin"
                  ? "e.g. How many people work in each department? Or: add a new department called Legal in Kolkata."
                  : "e.g. How many people work in each department?"
              }
              rows={3}
              maxLength={500}
              disabled={isPending || confirming}
              className="w-full resize-none bg-transparent px-4 py-3 text-base text-ink-100 placeholder:text-ink-500 focus:outline-none disabled:opacity-60"
            />
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-xs text-ink-500">{question.length}/500</span>
              <button type="submit" disabled={isPending || confirming || !question.trim()} className="btn-primary">
                {isPending ? STATUS_LABELS[status as keyof typeof STATUS_LABELS] : "Ask Database"}
              </button>
            </div>
          </div>
        </form>

        <SuggestedQuestions onSelect={(q) => { setQuestion(q); submit(q); }} disabled={isPending || confirming} />

        {history.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-widest2 text-ink-600">Recent</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {history.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isPending || confirming}
                  onClick={() => { setQuestion(q); submit(q); }}
                  className="text-xs text-ink-500 underline decoration-ink-700 underline-offset-4 transition-colors hover:text-accent-400 disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {isPending && (
          <div className="mt-12 animate-fade-in rounded-sm border border-ink-800 bg-ink-900 px-6 py-8 text-center">
            <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-ink-700 border-t-accent-400" />
            <p className="text-sm text-ink-300">{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</p>
          </div>
        )}

        {status === "error" && error && (
          <div className="mt-12 animate-fade-in rounded-sm border border-red-900/50 bg-red-950/20 px-6 py-6">
            <p className="text-sm font-semibold uppercase tracking-widest2 text-red-400">
              Something went wrong
            </p>
            <p className="mt-2 text-sm text-ink-300">{error}</p>
            <button
              type="button"
              onClick={() => submit(question)}
              className="btn-ghost mt-4"
              disabled={!question.trim()}
            >
              Retry
            </button>
          </div>
        )}

        {status === "needs_confirmation" && pending && (
          <div ref={resultRef} className="mt-12 animate-fade-in space-y-6 scroll-mt-28">
            <div className="rounded-sm border border-amber-900/50 bg-amber-950/10 px-6 py-6">
              <p className="text-sm font-semibold uppercase tracking-widest2 text-amber-400">
                This will change your data — review before running
              </p>
              <p className="mt-2 text-sm text-ink-300">{pending.explanation}</p>
            </div>

            <SQLViewer sql={pending.sql} explanation="" />

            <div className="flex flex-wrap gap-4">
              <button type="button" onClick={confirmPending} disabled={confirming} className="btn-primary">
                {confirming ? "Running…" : "Confirm & Run"}
              </button>
              <button type="button" onClick={cancelPending} disabled={confirming} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === "success" && response && (
          <div ref={resultRef} className="mt-12 animate-fade-in space-y-6 scroll-mt-28">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest2 text-ink-600">Question</p>
              <p className="mt-2 text-lg text-ink-100">{response.question}</p>
            </div>

            <SQLViewer sql={response.sql} explanation={response.explanation} />

            <ResultView
              result={response.result}
              visualizations={response.visualizations}
              isWrite={response.isWrite}
              question={response.question}
              role={role}
            />
          </div>
        )}
      </div>
    </section>
  );
}
