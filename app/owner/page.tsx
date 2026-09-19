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

export default function OwnerControlRoomPage() {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [executionStage, setExecutionStage] = useState("idle");
  const [timeline, setTimeline] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function generatePlan() {
    setLoading(true);
    setError(null);
    setResult(null);
    setConfirmed(false);

    setExecutionStage("reasoning");

    setTimeline([
      "Understanding owner intent",
      "Generating governed SQL",
      "Validating governance policies",
    ]);

    try {
      const response = await fetch("/api/owner/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Planning failed.");
      }

      setPlan(data.plan);

      setTimeline((current) => [
        ...current,
        "Execution plan generated successfully",
      ]);

      setExecutionStage("awaiting_confirmation");
    } catch (err) {
      setExecutionStage("failed");

      setError(
        err instanceof Error
          ? err.message
          : "Planning failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function executePlan() {
    if (!plan?.generatedSql) {
      setError("No generated SQL available.");
      return;
    }

    setExecutionStage("executing");

    setTimeline((current) => [
      ...current,
      "Executing SQL against PostgreSQL",
      "Persisting audit logs",
    ]);

    try {
      const response = await fetch("/api/owner/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: plan.generatedSql,
          approvalToken: plan.approvalToken,
          confirmed,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Execution failed.");
      }

      setExecutionStage("completed");

      setTimeline((current) => [
        ...current,
        "Database execution completed successfully",
      ]);

      setResult(
        `Execution completed successfully. Rows affected: ${data.execution?.rowCount ?? 0}`
      );
    } catch (err) {
      setExecutionStage("failed");

      setError(
        err instanceof Error
          ? err.message
          : "Execution failed."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#071018] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
            OWNER Runtime Console
          </p>

          <h1 className="mt-4 text-5xl font-semibold text-white">
            Governed Real-Time Execution Engine
          </h1>
        </div>

        <div className="rounded-xl border border-cyan-900 bg-[#0B1720] p-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Create a table named project with an id and a name"
            className="min-h-[220px] w-full resize-none bg-transparent text-white outline-none"
          />

          <div className="mt-6 flex gap-4">
            <button
              onClick={generatePlan}
              disabled={loading}
              className="rounded-lg bg-cyan-500 px-5 py-3 font-medium text-black"
            >
              {loading ? "Generating..." : "Begin Governed Execution"}
            </button>

            {plan?.generatedSql && (
              <div className="flex flex-col gap-3">
                {plan.requiresConfirmation && (
                  <label className="flex max-w-xl items-start gap-3 text-sm text-cyan-100">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-cyan-500"
                    />
                    <span>
                      I reviewed the generated SQL and understand that this
                      operation will change the live database.
                    </span>
                  </label>
                )}
                <button
                  onClick={executePlan}
                  disabled={plan.requiresConfirmation && !confirmed}
                  className="rounded-lg border border-cyan-500 px-5 py-3 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {plan.requiresConfirmation ? "Confirm & Execute Operation" : "Execute Operation"}
                </button>
              </div>
            )}
          </div>
        </div>

        {plan && !plan.allowed && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-red-200">
            {plan.explanation}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-cyan-900 bg-[#0B1720] p-6">
            <h2 className="text-2xl font-semibold text-white">
              Execution Lifecycle
            </h2>

            <div className="mt-6 space-y-3">
              {timeline.map((entry) => (
                <div
                  key={entry}
                  className="flex items-center gap-3 rounded-lg border border-cyan-950 bg-black/30 p-4"
                >
                  <div className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <p>{entry}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-cyan-700 bg-cyan-500/10 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
                Runtime State
              </p>

              <p className="mt-2 text-2xl font-semibold capitalize text-white">
                {executionStage.replaceAll("_", " ")}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-cyan-900 bg-[#0B1720] p-6">
            <h2 className="text-2xl font-semibold text-white">
              Generated SQL
            </h2>

            <pre className="mt-6 overflow-x-auto rounded-lg border border-cyan-950 bg-black p-5 text-cyan-300">
              <code>
                {plan?.generatedSql || "-- Awaiting generated SQL"}
              </code>
            </pre>

            {result && (
              <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
                {result}
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {error}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
