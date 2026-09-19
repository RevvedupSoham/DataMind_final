"use client";

import { useEffect, useState } from "react";
import { ResultTable } from "@/components/ResultTable";
import { ChartRenderer } from "@/components/ChartRenderer";
import { resultToCsv, downloadTextFile, csvFileNameFor } from "@/lib/csv";
import type { QueryResult } from "@/types/query";
import type { ChartType, VisualizationConfig } from "@/types/visualization";
import type { UserRole } from "@/types/auth";

const CHART_LABELS: Record<ChartType, string> = { bar: "Bar", line: "Line", pie: "Pie" };
type ActiveView = "table" | ChartType;

export function ResultView({ result, visualizations, isWrite, question, role }: {
  result: QueryResult;
  visualizations: VisualizationConfig[];
  isWrite?: boolean;
  question: string;
  role: UserRole | null;
}) {
  const [activeView, setActiveView] = useState<ActiveView>("table");

  useEffect(() => setActiveView("table"), [result]);

  const canDownload = role === "admin" && result.rowCount > 0;
  const activeConfig = activeView === "table" ? null : visualizations.find((v) => v.chartType === activeView) ?? null;

  function handleDownload() { downloadTextFile(csvFileNameFor(question), resultToCsv(result)); }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-ink-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-600">{isWrite ? "Database change result" : "Query result"}</p>
          <p className="mt-1 text-sm text-ink-400">{result.rowCount.toLocaleString()} row{result.rowCount === 1 ? "" : "s"} · {result.columns.length} column{result.columns.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-ink-700 p-1">
            <button type="button" onClick={() => setActiveView("table")} className={`px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] transition-all duration-300 ${activeView === "table" ? "bg-ink-700 text-ink-100" : "text-ink-500 hover:text-ink-100"}`}>Table</button>
            {visualizations.map((v) => (
              <button key={v.chartType} type="button" onClick={() => v.chartType && setActiveView(v.chartType)} className={`px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] transition-all duration-300 ${activeView === v.chartType ? "bg-accent-500 text-ink-950" : "text-ink-500 hover:text-ink-100"}`}>
                {v.chartType ? CHART_LABELS[v.chartType] : ""}
              </button>
            ))}
          </div>
          {canDownload && <button type="button" onClick={handleDownload} className="flex items-center gap-2 border border-ink-700 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-400 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-400 hover:text-accent-400">CSV ↗</button>}
        </div>
      </div>
      <div key={activeView} className="query-result">
        {activeView === "table" ? <ResultTable result={result} isWrite={isWrite} /> : activeConfig ? <ChartRenderer config={activeConfig} result={result} /> : <ResultTable result={result} isWrite={isWrite} />}
      </div>
    </div>
  );
}
