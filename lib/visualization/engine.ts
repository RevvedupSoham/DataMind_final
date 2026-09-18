import type { QueryResult } from "@/types/query";
import type { VisualizationConfig, ChartType } from "@/types/visualization";

const SUPPORTED_TYPES: ChartType[] = ["bar", "line", "pie"];

/**
 * Determines every chart type that is genuinely valid for a query result —
 * not just one. This runs entirely on the actual returned rows/columns; it
 * never invents data. All valid options are computed together in this one
 * pass so the frontend can offer them as switchable views (table/bar/line/
 * pie) without a second round trip — the user still picks which one to
 * look at, DataMind just doesn't make them wait for each one individually.
 *
 * Heuristics:
 * - Needs at least 2 rows and at least one categorical/temporal field plus
 *   one numeric field, or nothing is chartable.
 * - A date/time-like x field -> line chart (trend), plus bar as a secondary
 *   option (bucketed comparison over the same field also reads fine).
 * - A low-cardinality categorical field (<= 8 distinct values) -> both bar
 *   and pie are offered. Between 9 and 25 distinct values -> bar only (pie
 *   gets unreadable much past 8 slices).
 * - More than 25 distinct categories, or no numeric measure, or a single
 *   row -> no chart options at all (table only).
 *
 * The order of the returned array reflects which option the question's
 * own wording suggests first (e.g. "pie chart of..." puts pie first), but
 * every entry is independently valid — order is only a display hint.
 */
export function getVisualizationOptions(result: QueryResult, question: string): VisualizationConfig[] {
  if (result.rowCount < 2 || result.columns.length < 2) return [];

  const numericFields = result.columns.filter((c) => result.columnTypes[c] === "number");
  const dateFields = result.columns.filter((c) => result.columnTypes[c] === "date");
  const stringFields = result.columns.filter((c) => result.columnTypes[c] === "string");

  const yField = numericFields[0];
  if (!yField) return [];

  const title = titleize(question);
  let xField: string;
  let candidateTypes: ChartType[];

  const firstDate = dateFields[0];
  if (firstDate) {
    xField = firstDate;
    candidateTypes = ["line", "bar"];
  } else {
    const firstString = stringFields[0];
    if (!firstString) return [];
    xField = firstString;

    const distinctCategories = new Set(result.rows.map((r) => String(r[xField]))).size;
    if (distinctCategories < 2 || distinctCategories > 25) return [];

    candidateTypes = distinctCategories <= 8 ? ["bar", "pie"] : ["bar"];
  }

  // Reorder so a chart type the question explicitly asks for comes first,
  // purely as a display-order hint for which tab is selected by default.
  const wantsPie = /\bpie\b|\bshare\b|\bproportion\b/i.test(question);
  const wantsLine = /\btrend\b|\bover time\b|\bplot\b|\bhistory\b|\bgrowth\b/i.test(question);
  const wantsBar = /\bbar chart\b|\bcompare\b|\bcomparison\b/i.test(question);

  const priority: ChartType[] = wantsPie ? ["pie"] : wantsLine ? ["line"] : wantsBar ? ["bar"] : [];
  const ordered = [
    ...priority.filter((t) => candidateTypes.includes(t)),
    ...candidateTypes.filter((t) => !priority.includes(t)),
  ];

  return ordered
    .filter((chartType) => SUPPORTED_TYPES.includes(chartType))
    .map((chartType) => ({
      shouldVisualize: true,
      chartType,
      xField,
      yField,
      title,
    }));
}

function titleize(question: string): string {
  const trimmed = question.trim().replace(/[.?!]+$/, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Validates a config against an actual result before rendering, defensively. */
export function isVisualizationRenderable(
  config: VisualizationConfig,
  result: QueryResult
): boolean {
  if (!config.shouldVisualize || !config.chartType || !config.xField || !config.yField) {
    return false;
  }
  if (!SUPPORTED_TYPES.includes(config.chartType)) return false;
  if (!result.columns.includes(config.xField) || !result.columns.includes(config.yField)) {
    return false;
  }
  if (result.columnTypes[config.yField] !== "number") return false;
  return true;
}
