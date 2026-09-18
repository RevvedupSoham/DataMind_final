export type ChartType = "bar" | "line" | "pie";

export interface VisualizationConfig {
  shouldVisualize: boolean;
  chartType: ChartType | null;
  xField: string | null;
  yField: string | null;
  title: string | null;
}
