export type ExecutionStage =
  | "idle"
  | "reasoning"
  | "generating_sql"
  | "validating"
  | "awaiting_confirmation"
  | "executing"
  | "auditing"
  | "completed"
  | "failed";

export interface ExecutionEvent {
  stage: ExecutionStage;
  label: string;
  timestamp: string;
  status: "pending" | "active" | "completed" | "failed";
}

export function buildExecutionTimeline(): ExecutionEvent[] {
  const now = new Date().toISOString();

  return [
    {
      stage: "reasoning",
      label: "Analyzing owner intent and operational context",
      timestamp: now,
      status: "completed",
    },
    {
      stage: "generating_sql",
      label: "Generating governed SQL execution strategy",
      timestamp: now,
      status: "completed",
    },
    {
      stage: "validating",
      label: "Validating SQL governance and RBAC policy",
      timestamp: now,
      status: "completed",
    },
    {
      stage: "awaiting_confirmation",
      label: "Awaiting governed execution approval",
      timestamp: now,
      status: "active",
    },
  ];
}
