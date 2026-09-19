"use client";

import { useMemo, useState } from "react";

interface OperationPlan {
  operationType: string;
  generatedSql: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
  allowed: boolean;
  explanation: string;
}

const riskStyles: Record<string, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
};

export default function OwnerControlRoomPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<OperationPlan | null>(null);

  const riskClass = useMemo(() => {
    if (!plan) {
      return riskStyles.low;
    }

    return riskStyles[plan.riskLevel] || riskStyles.low;
  }, [plan]);

  async function generatePlan() {
    if (!prompt.trim()) {
      setError("Enter a database operation prompt.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/owner/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Failed to generate execution plan.");
        setLoading(false);
        return;
      }

      setPlan(data.plan);
    } catch {
      setError("Unable to contact DataMind planning services.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex flex-col gap-5 border-b border-ink-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-accent-400">
              Owner Control Room
            </p>

            <h1 className="mt-4 font-display text-5xl tracking-tight">
              Governed Database Administration
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-ink-500">
              Natural-language database administration with authorization-aware
              planning, SQL safety enforcement, audit logging, and execution
              governance.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Protected", "RBAC"],
              ["Audited", "Execution"],
              ["Validated", "SQL Safety"],
              ["Governed", "Operations"],
            ].map(([title, subtitle]) => (
              <div
                key={title}
                className="border border-ink-800 bg-ink-900/70 px-5 py-4"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                  {title}
                </p>
                <p className="mt-2 text-lg font-semibold text-ink-100">
                  {subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="border border-ink-800 bg-ink-900/70 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                  Ask Database
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Operation Planning Workspace
                </h2>
              </div>

              <div className="rounded-full border border-ink-700 px-4 py-2 text-xs uppercase tracking-[0.18em] text-ink-400">
                Natural Language → SQL → Governance
              </div>
            </div>

            <div className="mt-6 border border-ink-700 bg-ink-950 p-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Create projects table with project_name, status, owner_id, and created_at fields."
                className="min-h-[220px] w-full resize-none bg-transparent text-sm leading-7 text-ink-100 outline-none placeholder:text-ink-700"
              />
            </div>

            {error && (
              <div className="mt-5 border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={generatePlan}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? "Generating Plan..." : "Generate Execution Plan"}
              </button>

              <button className="border border-ink-700 px-5 py-3 text-sm text-ink-300 transition-colors hover:border-accent-400 hover:text-ink-100">
                Open SQL Console
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="border border-ink-800 bg-ink-900/70 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                    SQL Governance
                  </p>

                  <h2 className="mt-2 text-xl font-semibold">
                    Risk Assessment
                  </h2>
                </div>

                {plan && (
                  <div className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${riskClass}`}>
                    {plan.riskLevel} risk
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-4">
                <div className="border border-ink-800 bg-ink-950 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
                    Operation Type
                  </p>

                  <p className="mt-2 text-sm text-ink-100">
                    {plan?.operationType || "Waiting for execution plan"}
                  </p>
                </div>

                <div className="border border-ink-800 bg-ink-950 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
                    Confirmation Workflow
                  </p>

                  <p className="mt-2 text-sm text-ink-100">
                    {plan
                      ? plan.requiresConfirmation
                        ? "Manual execution confirmation required"
                        : "Safe auto-approved operation"
                      : "No operation planned yet"}
                  </p>
                </div>

                <div className="border border-ink-800 bg-ink-950 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
                    Validation Status
                  </p>

                  <p className="mt-2 text-sm text-ink-100">
                    {plan
                      ? plan.allowed
                        ? "SQL validation passed"
                        : "Blocked by governance rules"
                      : "Awaiting validation"}
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-ink-800 bg-ink-900/70 p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                Audit Activity
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Execution Timeline
              </h2>

              <div className="mt-6 space-y-4">
                {[
                  "Owner authentication success logged",
                  "RBAC route validation enabled",
                  "SQL governance rules active",
                  "Operation planning API connected",
                ].map((entry) => (
                  <div
                    key={entry}
                    className="flex items-start gap-3 border border-ink-800 bg-ink-950 p-4"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-accent-400" />

                    <div>
                      <p className="text-sm text-ink-100">{entry}</p>
                      <p className="mt-1 text-xs text-ink-600">
                        Audit subsystem active
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="border border-ink-800 bg-ink-900/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                  Generated SQL
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Query Preview
                </h2>
              </div>

              {plan && (
                <div className="rounded-full border border-ink-700 px-4 py-2 text-xs uppercase tracking-[0.16em] text-ink-400">
                  Preview Mode
                </div>
              )}
            </div>

            <div className="mt-6 overflow-x-auto border border-ink-800 bg-[#06111A] p-5">
              <pre className="text-sm leading-7 text-accent-300">
                <code>
                  {plan?.generatedSql || "-- Generated SQL will appear here after planning"}
                </code>
              </pre>
            </div>

            {plan && (
              <div className="mt-5 border border-ink-800 bg-ink-950 p-4 text-sm leading-7 text-ink-400">
                {plan.explanation}
              </div>
            )}
          </section>

          <section className="border border-ink-800 bg-ink-900/70 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                Schema Explorer
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Database Discovery
              </h2>
            </div>

            <div className="mt-6 grid gap-4">
              {[
                ["employee", "Core employee records and reporting hierarchy"],
                ["department", "Department structure and locations"],
                ["salary", "Compensation and payroll metadata"],
                ["audit_logs", "Governance and execution audit history"],
              ].map(([table, description]) => (
                <div
                  key={table}
                  className="border border-ink-800 bg-ink-950 p-4 transition-colors hover:border-accent-400"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm text-accent-300">
                      {table}
                    </p>

                    <span className="rounded-full border border-ink-700 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-ink-500">
                      Table
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-ink-500">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
