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

  if (numericFields.length === 0) return [];

  // Prefer a numeric measure that is not the likely x-axis field.
  // For results such as year + employee_count, this lets the year drive
  // the line chart while employee_count becomes the plotted measure.
  const numericX = numericFields.find((field) => {
    const values = result.rows
      .map((row) => row[field])
      .filter((value) => value !== null && value !== undefined)
      .map(Number)
      .filter(Number.isFinite);
    const distinct = new Set(values).size;
    return distinct >= 2 && distinct <= Math.min(100, result.rowCount);
  });

  const yField = numericFields.find((field) => field !== numericX) ?? numericFields[0];
  if (!yField) return [];

  const title = titleize(question);
  let xField: string;
  let candidateTypes: ChartType[];

  const firstDate = dateFields[0];

  if (firstDate) {
    // Dates represent ordered progression, so line is the primary
    // visualization. Bar remains available for discrete date buckets.
    xField = firstDate;
    candidateTypes = ["line", "bar"];
  } else {
    const firstString = stringFields[0];

    if (firstString) {
      xField = firstString;
      const distinctCategories = new Set(
        result.rows
          .map((r) => r[xField])
          .filter((value) => value !== null && value !== undefined)
          .map(String)
      ).size;

      if (distinctCategories < 2 || distinctCategories > 25) return [];

      // Categorical results can be compared with bars. A pie is exposed
      // only when the number of categories is small enough to remain readable.
      candidateTypes = distinctCategories <= 8 ? ["bar", "pie"] : ["bar"];
    } else if (numericX && numericX !== yField) {
      // Aggregated years/month numbers often arrive as integers rather than
      // dates. Treat a low-cardinality numeric x-axis as an ordered series so
      // questions such as "plot hiring over the last five years" get a line.
      xField = numericX;
      candidateTypes = ["line", "bar"];
    } else {
      return [];
    }
  }

  // Reorder so a chart type explicitly requested by the question appears
  // first. This changes display order only, never authorization or data.
  const wantsPie = /\bpie\b|\bshare\b|\bproportion\b/i.test(question);
  const wantsLine = /\bline\b|\btrend\b|\bover time\b|\bplot\b|\bhistory\b|\bgrowth\b/i.test(question);
  const wantsBar = /\bbar chart\b|\bcompare\b|\bcomparison\b/i.test(question);

  const priority: ChartType[] = wantsPie
    ? ["pie"]
    : wantsLine
      ? ["line"]
      : wantsBar
        ? ["bar"]
        : [];

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
