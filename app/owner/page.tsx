"use client";

import { useState } from "react";

interface OperationPlan {
  operationType: string;
  generatedSql: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  allowed: boolean;
  explanation: string;
}

export default function OwnerControlRoomPage() {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [executionStage, setExecutionStage] = useState("idle");
  const [timeline, setTimeline] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generatePlan() {
    setLoading(true);
    setExecutionStage("reasoning");
    setTimeline([
      "Understanding owner intent",
      "Analyzing schema and governance",
      "Generating SQL execution strategy",
    ]);

    const response = await fetch("/api/owner/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();

    setPlan(data.plan);
    setExecutionStage("awaiting_confirmation");
    setTimeline((current) => [
      ...current,
      "Governance validation completed",
      "Awaiting owner confirmation",
    ]);
    setLoading(false);
  }

  async function executePlan() {
    if (!plan) return;

    setExecutionStage("executing");
    setTimeline((current) => [
      ...current,
      "Executing governed operation",
      "Writing audit logs",
    ]);

    const response = await fetch("/api/owner/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: plan.generatedSql }),
    });

    const data = await response.json();

    setExecutionStage("completed");
    setTimeline(data.timeline || []);
    setResult(data.result?.message || "Execution completed.");
  }

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent-400">
            OWNER Runtime Console
          </p>
          <h1 className="mt-4 text-5xl font-semibold">
            Governed Real-Time Execution Engine
          </h1>
        </div>

        <div className="border border-ink-800 bg-ink-900/70 p-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Create a projects table with governance tracking"
            className="min-h-[220px] w-full resize-none bg-transparent outline-none"
          />

          <div className="mt-6 flex gap-4">
            <button onClick={generatePlan} className="btn-primary">
              {loading ? "Thinking..." : "Begin Governed Execution"}
            </button>

            {plan && (
              <button
                onClick={executePlan}
                className="border border-accent-400 px-5 py-3"
              >
                Execute Approved Operation
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="border border-ink-800 bg-ink-900/70 p-6">
            <h2 className="text-2xl font-semibold">Execution Lifecycle</h2>

            <div className="mt-6 space-y-4">
              {timeline.map((entry) => (
                <div
                  key={entry}
                  className="flex items-center gap-3 border border-ink-800 bg-black/20 p-4"
                >
                  <div className="h-2.5 w-2.5 rounded-full bg-accent-400" />
                  <p>{entry}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 border border-accent-500/30 bg-accent-500/5 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-accent-300">
                Runtime State
              </p>
              <p className="mt-2 text-2xl font-semibold capitalize">
                {executionStage.replaceAll("_", " ")}
              </p>
            </div>
          </section>

          <section className="border border-ink-800 bg-ink-900/70 p-6">
            <h2 className="text-2xl font-semibold">Generated SQL</h2>

            <pre className="mt-6 overflow-x-auto border border-ink-800 bg-[#06111A] p-5 text-accent-300">
              <code>
                {plan?.generatedSql || "-- SQL execution strategy will appear here"}
              </code>
            </pre>

            {result && (
              <div className="mt-6 border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
                {result}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
