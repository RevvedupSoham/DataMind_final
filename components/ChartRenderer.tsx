"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QueryResult } from "@/types/query";
import type { VisualizationConfig } from "@/types/visualization";

const PIE_COLORS = ["#4fd6c6", "#22b8a8", "#7fe3d8", "#188f83", "#a1aeb4", "#5a6b73", "#46545c", "#77878f"];

function toChartData(result: QueryResult, xField: string, yField: string) {
  return result.rows.map((row) => ({
    [xField]: row[xField] === null || row[xField] === undefined ? "—" : String(row[xField]),
    [yField]: typeof row[yField] === "number" ? row[yField] : Number(row[yField]) || 0,
  }));
}

const tooltipStyle = {
  background: "#0a0d0f",
  border: "1px solid #20282d",
  borderRadius: 2,
  color: "#e4e9eb",
  fontSize: 12,
};

export function ChartRenderer({
  config,
  result,
}: {
  config: VisualizationConfig;
  result: QueryResult;
}) {
  if (!config.shouldVisualize || !config.chartType || !config.xField || !config.yField) {
    return null;
  }

  const xField = config.xField;
  const yField = config.yField;
  const data = toChartData(result, xField, yField);

  return (
    <div className="rounded-sm border border-ink-800 bg-ink-950 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest2 text-ink-400">
          {config.title ?? "Visualization"}
        </span>
        <span className="rounded-full border border-ink-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">
          {config.chartType}
        </span>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {config.chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#20282d" vertical={false} />
              <XAxis
                dataKey={xField}
                stroke="#5a6b73"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#20282d" }}
              />
              <YAxis stroke="#5a6b73" fontSize={11} tickLine={false} axisLine={{ stroke: "#20282d" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(79,214,198,0.08)" }} />
              <Bar dataKey={yField} fill="#4fd6c6" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : config.chartType === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#20282d" vertical={false} />
              <XAxis
                dataKey={xField}
                stroke="#5a6b73"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#20282d" }}
              />
              <YAxis stroke="#5a6b73" fontSize={11} tickLine={false} axisLine={{ stroke: "#20282d" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey={yField}
                stroke="#4fd6c6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#4fd6c6" }}
              />
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Pie
                data={data}
                dataKey={yField}
                nameKey={xField}
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={(entry) => String(entry[xField])}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
