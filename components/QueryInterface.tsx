"use client";

import { useEffect, useRef, useState } from "react";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { SQLViewer } from "@/components/SQLViewer";
import { ResultView } from "@/components/ResultView";
import { ASK_EVENT } from "@/lib/ask-bridge";
import type { QueryErrorResponse, QueryPendingConfirmation, QueryResponse, QueryStatus } from "@/types/query";
import type { UserRole } from "@/types/auth";

const STATUS_LABELS: Record<Extract<QueryStatus, "generating_sql" | "running_query" | "preparing_results">, string> = {
  generating_sql: "Generating SQL…",
  running_query: "Running database query…",
  preparing_results: "Preparing results…",
};

const HISTORY_KEY = "datamind:history";
const MAX_HISTORY = 8;

type EmployeeProfile = {
  employee: { id: number; name: string; hireDate: string; managerId: number | null };
  department: { id: number; name: string; location: string };
  manager: { id: number; name: string } | null;
  address: { city: string; state: string; pinCode: string | number } | null;
  salary: { amount: number | string; currency: string; effectiveFrom: string } | null;
  directReports: number;
};

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(question: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([question, ...loadHistory().filter((q) => q !== question)].slice(0, MAX_HISTORY)),
    );
  } catch {}
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
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setHistory(loadHistory()), []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.role) setRole(data.role as UserRole);
        if (data?.username) setUsername(data.username);
        if (data?.profile) setProfile(data.profile as EmployeeProfile);
        else setProfileError("Your profile could not be loaded.");
      })
      .catch(() => {
        if (!cancelled) setProfileError("Your profile could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => { cancelled = true; };
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

  useEffect(() => () => {
    if (cycleRef.current) clearInterval(cycleRef.current);
  }, []);

  const isPending = status === "generating_sql" || status === "running_query" || status === "preparing_results";

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || isPending || confirming) return;

    setError(null);
    setResponse(null);
    setPending(null);
    setStatus("generating_sql");

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
        setError(errBody?.error?.message || "The request could not be completed.");
        setStatus("error");
        return;
      }

      if ((data as QueryPendingConfirmation)?.pending) {
        setPending(data as QueryPendingConfirmation);
        setStatus("needs_confirmation");
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }

      setResponse(data as QueryResponse);
      setStatus("success");
      saveHistory(trimmed);
      setHistory(loadHistory());
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
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

  return (
    <section id="ask" className="border-t border-ink-800 bg-ink-950 py-24 sm:py-28">
      <div className="section">
        <div className="flex flex-col gap-4 border-b border-ink-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Query workspace</p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-ink-100 sm:text-4xl">
              Ask the database.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-500">
              One question in. Validated SQL and real rows out.
            </p>
          </div>
          {role && (
            <div className="flex items-center gap-3">
              <span className="text-[9px] uppercase tracking-[0.2em] text-ink-600">Current scope</span>
              <span className={"border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] " +
                (role === "admin" ? "border-accent-500/40 text-accent-400" : "border-ink-700 text-ink-400")}>
                {role === "admin" ? "ADMIN · CONTROLLED ACCESS" : "MEMBER · READ ONLY"}
              </span>
            </div>
          )}
        </div>

        {profileLoading && (
          <div className="mt-8 border border-ink-800 bg-ink-900/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border border-ink-700 border-t-accent-400" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-600">Loading your workspace context…</span>
            </div>
          </div>
        )}

        {!profileLoading && profile && (
          <div className="mt-8 border border-ink-800 bg-ink-900">
            <div className="flex flex-col gap-5 border-b border-ink-800 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-display text-2xl text-ink-100">{profile.employee.name}</p>
                  <span className="border border-ink-700 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                    {role === "admin" ? "ADMIN" : "MEMBER"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-600">
                  Signed in as {username || "authenticated user"} · Employee #{profile.employee.id}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink-700">Access scope</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent-400">
                  {role === "admin" ? "Your reporting hierarchy" : "Your employee record"}
                </p>
              </div>
            </div>

            <div className="grid divide-y divide-ink-800 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {[
                ["Department", profile.department.name],
                ["Location", profile.department.location],
                ["Manager", profile.manager?.name || "Not assigned"],
                [role === "admin" ? "Direct reports" : "Joined", role === "admin"
                  ? String(profile.directReports)
                  : new Date(profile.employee.hireDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
              ].map(([label, value]) => (
                <div key={label} className="px-5 py-4 sm:px-6">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-ink-700">{label}</p>
                  <p className="mt-1 text-sm text-ink-200">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-800 px-5 py-3 sm:px-6">
              {profile.address && (
                <span className="text-[10px] text-ink-600">
                  Address · {profile.address.city}, {profile.address.state} {profile.address.pinCode}
                </span>
              )}
              {profile.salary && (
                <span className="text-[10px] text-ink-600">
                  Current salary · {profile.salary.currency} {Number(profile.salary.amount).toLocaleString("en-IN")}
                </span>
              )}
              <span className="ml-auto text-[9px] uppercase tracking-[0.16em] text-ink-700">
                Loaded from PostgreSQL
              </span>
            </div>
          </div>
        )}

        {!profileLoading && profileError && (
          <div className="mt-8 border border-amber-800/50 bg-amber-950/10 px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400">Workspace profile</p>
            <p className="mt-1 text-xs text-ink-500">{profileError} Your database query workspace is still available.</p>
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_260px] lg:items-start">
          <div>
            <form onSubmit={(e) => { e.preventDefault(); submit(question); }}>
              <div className="border border-ink-700 bg-ink-900 transition-colors focus-within:border-accent-400">
                <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-600">natural language</span>
                  <span className="text-[10px] text-ink-700">{question.length}/500</span>
                </div>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(question);
                    }
                  }}
                  placeholder={role === "admin"
                    ? "e.g. Which managers have 50 or more employees under them?"
                    : "e.g. What department do I work in?"}
                  rows={4}
                  maxLength={500}
                  disabled={isPending || confirming}
                  className="min-h-[150px] w-full resize-none bg-transparent px-5 py-5 text-base leading-7 text-ink-100 placeholder:text-ink-600 focus:outline-none disabled:opacity-60 sm:text-lg"
                />
                <div className="flex flex-col gap-3 border-t border-ink-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-ink-700">Enter to run · Shift + Enter for a new line</span>
                  <button type="submit" disabled={isPending || confirming || !question.trim()} className="btn-primary">
                    {isPending ? STATUS_LABELS[status as keyof typeof STATUS_LABELS] : "Run query ↗"}
                  </button>
                </div>
              </div>
            </form>

            <SuggestedQuestions
              role={role}
              onSelect={(q) => { setQuestion(q); submit(q); }}
              disabled={isPending || confirming}
            />

            {history.length > 0 && (
              <div className="mt-7 border-t border-ink-900 pt-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-700">Recent questions</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {history.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isPending || confirming}
                      onClick={() => { setQuestion(q); submit(q); }}
                      className="text-left text-xs text-ink-600 underline decoration-ink-800 underline-offset-4 transition-colors hover:text-accent-400 disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="border-l border-ink-800 pl-0 lg:pl-7">
            {role === "member" ? (
              <>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-700">Member workspace</p>
                <div className="mt-4 border-y border-ink-800 py-4">
                  <p className="text-sm font-semibold text-ink-100">Your data, your scope.</p>
                  <p className="mt-2 text-xs leading-5 text-ink-600">
                    Personal employee data is scoped to the employee linked to your signed session.
                    You can read your permitted information and approved general aggregates, but you cannot modify data.
                  </p>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ["01", "Personal", "My details, department, address"],
                    ["02", "Compensation", "My current salary"],
                    ["03", "History", "My permitted job history"],
                    ["04", "General", "Approved department / workforce counts"],
                  ].map(([n, title, body]) => (
                    <div key={n} className="border-b border-ink-900 pb-3">
                      <div className="flex gap-3">
                        <span className="font-mono text-[9px] text-accent-400">{n}</span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-300">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-ink-600">{body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-700">
                  READ ONLY / EMPLOYEE-SCOPED
                </p>
              </>
            ) : (
              <>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-700">What happens next</p>
                <ol className="mt-4 space-y-4">
                  {[
                    ["01", "Translate", "Groq drafts SQL"],
                    ["02", "Validate", "Safety + access checks"],
                    ["03", "Execute", "Real PostgreSQL"],
                    ["04", "Return", "Rows + visualization"],
                  ].map(([n, title, body]) => (
                    <li key={n} className="border-b border-ink-900 pb-4">
                      <div className="flex gap-3">
                        <span className="font-mono text-[9px] text-accent-400">{n}</span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-300">{title}</p>
                          <p className="mt-1 text-xs leading-5 text-ink-600">{body}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>

        {isPending && (
          <div className="mt-10 border border-ink-800 bg-ink-900 px-6 py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="h-7 w-7 shrink-0 animate-spin rounded-full border-2 border-ink-700 border-t-accent-400" />
              <div>
                <p className="text-sm font-semibold text-ink-100">{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</p>
                <p className="mt-1 text-xs text-ink-600">DataMind is processing the request through its governed query path.</p>
              </div>
            </div>
          </div>
        )}

        {status === "error" && error && (
          <div className="mt-10 border border-red-900/50 bg-red-950/15 px-6 py-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-400">Request rejected / failed</p>
            <p className="mt-2 text-sm leading-6 text-ink-300">{error}</p>
            <button type="button" onClick={() => submit(question)} className="btn-ghost mt-4" disabled={!question.trim()}>
              Retry
            </button>
          </div>
        )}

        {status === "needs_confirmation" && pending && (
          <div ref={resultRef} className="mt-10 space-y-5 scroll-mt-28">
            <div className="border border-amber-800/60 bg-amber-950/10 px-6 py-6">
              <div className="flex items-start gap-4">
                <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center border border-amber-700/60 text-amber-400">!</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">Change request / review required</p>
                  <p className="mt-2 text-sm leading-6 text-ink-300">{pending.explanation}</p>
                </div>
              </div>
            </div>
            <SQLViewer sql={pending.sql} explanation="" />
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={confirmPending} disabled={confirming} className="btn-primary">
                {confirming ? "Applying…" : "Confirm & run change"}
              </button>
              <button type="button" onClick={cancelPending} disabled={confirming} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {status === "success" && response && (
          <div ref={resultRef} className="mt-10 space-y-5 scroll-mt-28">
            <div className="border-l-2 border-accent-400 pl-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-600">Question</p>
              <p className="mt-1 text-base text-ink-100 sm:text-lg">{response.question}</p>
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
