"use client";

import { useState } from "react";

interface OperationPlan {
  operationType: string;
  generatedSql: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  allowed: boolean;
  explanation: string;
  approvalToken?: string;
}

const STAGES = [
  ["01", "reasoning", "Understand intent"],
  ["02", "planning", "Generate governed SQL"],
  ["03", "validation", "Validate policies"],
  ["04", "awaiting_confirmation", "Await confirmation"],
  ["05", "executing", "Execute against DB"],
  ["06", "completed", "Persist audit"],
];

export default function OwnerControlRoomPage() {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [executionStage, setExecutionStage] = useState("idle");
  const [timeline, setTimeline] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function resetRunState() {
    setPlan(null);
    setResult(null);
    setError(null);
    setConfirmed(false);
    setTimeline([]);
  }

  async function generatePlan() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      resetRunState();
      setExecutionStage("failed");
      setError("Enter an OWNER operation before starting execution.");
      return;
    }

    setLoading(true);
    resetRunState();
    setExecutionStage("reasoning");
    setTimeline(["Understanding owner intent", "Generating governed SQL", "Validating governance policies"]);

    try {
      const response = await fetch("/api/owner/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; plan?: OperationPlan };

      if (!response.ok || !data.plan) throw new Error(data.error || "Planning failed.");

      setPlan(data.plan);
      setTimeline((current) => [...current, "Execution plan generated successfully"]);
      setExecutionStage(data.plan.requiresConfirmation ? "awaiting_confirmation" : "ready_to_execute");
    } catch (err) {
      setPlan(null);
      setExecutionStage("failed");
      setTimeline((current) => [...current, "Execution plan generation failed"]);
      setError(err instanceof Error ? err.message : "Planning failed.");
    } finally {
      setLoading(false);
    }
  }

  async function executePlan() {
    if (!plan?.generatedSql || !plan.allowed) {
      setError("No executable OWNER operation is available.");
      return;
    }

    if (plan.requiresConfirmation && !confirmed) {
      setError("Confirm the operation before execution.");
      setExecutionStage("awaiting_confirmation");
      return;
    }

    setLoading(true);
    setError(null);
    setExecutionStage("executing");
    setTimeline((current) => [...current, "Executing SQL against PostgreSQL"]);

    try {
      const response = await fetch("/api/owner/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: plan.generatedSql, approvalToken: plan.approvalToken, confirmed }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        requiresConfirmation?: boolean;
        execution?: { rowCount?: number };
      };

      if (!response.ok) {
        setExecutionStage(response.status === 409 && data.requiresConfirmation ? "awaiting_confirmation" : "failed");
        throw new Error(data.error || "Execution failed.");
      }

      setExecutionStage("completed");
      setTimeline((current) => [...current, "Database execution completed successfully", "Audit log persisted"]);
      setResult(`Execution completed successfully. Rows affected: ${data.execution?.rowCount ?? 0}`);
    } catch (err) {
      setExecutionStage((current) => current === "awaiting_confirmation" ? current : "failed");
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      setLoading(false);
    }
  }

  const activeIndex = STAGES.findIndex(([, key]) => key === executionStage);
  const executeLabel = plan?.requiresConfirmation ? "Confirm & Execute Operation" : "Execute Operation";

  return (
    <main className="min-h-screen overflow-hidden bg-ink-950 pb-20 pt-24 text-ink-100">
      <div className="section">
        <div className="flex flex-col gap-10 border-b border-ink-800 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">OWNER / CONTROL ROOM</p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[.92] tracking-[-.035em] sm:text-6xl lg:text-7xl">
              Governed execution.
              <br />
              <span className="italic text-accent-400">Nothing runs unseen.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-ink-500">
              Translate an operational instruction into SQL, validate it through the server-side governance layer,
              review the generated statement, then explicitly authorize live execution when required.
            </p>
          </div>
          <div className="border-l border-ink-800 pl-5 text-right">
            <p className="text-[9px] uppercase tracking-[.2em] text-ink-600">Runtime</p>
            <p className="mt-2 font-mono text-xs uppercase text-accent-400">{executionStage.replaceAll("_", " ")}</p>
          </div>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden border border-ink-800 bg-ink-800 lg:grid-cols-6">
          {STAGES.map(([n, key, label], index) => {
            const done = activeIndex > index || executionStage === "completed";
            const active = key === executionStage;
            return (
              <div key={key} className={`relative bg-ink-950 p-4 transition-colors duration-500 ${active ? "bg-accent-500/[.07]" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-accent-400">{n}</span>
                  <span className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${done || active ? "bg-accent-400 shadow-[0_0_12px_rgba(79,214,198,.5)]" : "bg-ink-700"}`} />
                </div>
                <p className="mt-5 text-[9px] font-semibold uppercase tracking-[.14em] text-ink-400">{label}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="motion-panel border border-ink-800 bg-ink-900/70">
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-ink-500">01 / Operation intent</span>
              <span className="font-mono text-[9px] text-ink-700">OWNER ONLY</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Create a table named project with an id and a name"
              className="min-h-[240px] w-full resize-none bg-transparent px-5 py-6 text-base leading-7 text-ink-100 outline-none placeholder:text-ink-600 sm:text-lg"
              disabled={loading}
            />
            <div className="flex flex-col gap-4 border-t border-ink-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[9px] uppercase tracking-[.16em] text-ink-700">Natural language → governed SQL</span>
              <button onClick={generatePlan} disabled={loading} className="btn-primary">
                {loading ? "Working…" : "Generate execution plan ↗"}
              </button>
            </div>
          </section>

          <section className="border border-ink-800 bg-ink-950">
            <div className="border-b border-ink-800 px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-ink-500">02 / Lifecycle</span>
            </div>
            <div className="p-5">
              {timeline.length === 0 ? (
                <div className="flex min-h-[250px] items-end border-l border-ink-800 pl-5 pb-2">
                  <p className="text-sm leading-6 text-ink-600">The control room is waiting for an operation.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {timeline.map((entry, index) => (
                    <div key={`${entry}-${index}`} className="flex gap-4">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-400" />
                      <div>
                        <p className="text-sm text-ink-200">{entry}</p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[.16em] text-ink-700">event / {String(index + 1).padStart(2, "0")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {plan && (
          <section className="mt-6 grid gap-px overflow-hidden border border-ink-800 bg-ink-800 lg:grid-cols-[.72fr_1.28fr]">
            <div className="bg-ink-950 p-6 sm:p-8">
              <p className="text-[9px] font-semibold uppercase tracking-[.2em] text-ink-600">03 / Governance</p>
              <p className="mt-4 font-display text-3xl text-ink-100">{plan.operationType}</p>
              <p className="mt-4 text-sm leading-7 text-ink-500">{plan.explanation}</p>
              <div className="mt-8 grid grid-cols-2 border-t border-ink-800 pt-5">
                <div><p className="text-[9px] uppercase tracking-[.16em] text-ink-700">Risk</p><p className="mt-1 text-sm uppercase text-accent-400">{plan.riskLevel}</p></div>
                <div><p className="text-[9px] uppercase tracking-[.16em] text-ink-700">Permission</p><p className="mt-1 text-sm uppercase text-ink-300">{plan.allowed ? "Allowed" : "Blocked"}</p></div>
              </div>
            </div>

            <div className="bg-ink-950 p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[9px] font-semibold uppercase tracking-[.2em] text-ink-600">Generated SQL</p>
                <span className="font-mono text-[9px] text-accent-400">REVIEW BEFORE EXECUTION</span>
              </div>
              <pre className="scroll-thin mt-5 max-h-72 overflow-auto border border-ink-800 bg-black/40 p-5 text-sm leading-6 text-accent-300"><code>{plan.generatedSql}</code></pre>

              {plan.allowed && plan.requiresConfirmation && (
                <label className="mt-5 flex items-start gap-3 border border-amber-800/50 bg-amber-950/10 p-4 text-sm leading-6 text-amber-200">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={loading} className="mt-1 h-4 w-4 accent-cyan-500" />
                  <span>I reviewed the generated SQL and understand that this operation will change the live database.</span>
                </label>
              )}

              {plan.allowed && (
                <button onClick={executePlan} disabled={loading || (plan.requiresConfirmation && !confirmed)} className="btn-primary mt-5 w-full sm:w-auto">
                  {loading ? "Executing…" : executeLabel}
                </button>
              )}
            </div>
          </section>
        )}

        {result && <div className="mt-6 border-l-2 border-accent-400 bg-accent-500/[.05] px-5 py-4 text-sm text-accent-300">{result}</div>}
        {error && <div className="mt-6 border-l-2 border-red-400 bg-red-950/15 px-5 py-4 text-sm leading-6 text-red-300">{error}</div>}
      </div>
    </main>
  );
}
