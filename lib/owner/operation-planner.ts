import { validateSqlSafety } from "@/lib/owner/sql-safety";

export interface OperationPlan {
  operationType: string;
  generatedSql: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
  allowed: boolean;
  explanation: string;
}

function inferOperationType(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes("create table")) {
    return "schema_create";
  }

  if (lower.includes("delete")) {
    return "delete";
  }

  if (lower.includes("update")) {
    return "update";
  }

  return "query";
}

function generateSql(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes("show all employees")) {
    return "SELECT * FROM employee LIMIT 100;";
  }

  if (lower.includes("create projects table")) {
    return `
      CREATE TABLE projects (
        project_id SERIAL PRIMARY KEY,
        project_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
  }

  return "SELECT NOW();";
}

export function buildOperationPlan(
  naturalLanguagePrompt: string
): OperationPlan {
  const generatedSql = generateSql(naturalLanguagePrompt);

  const validation = validateSqlSafety(generatedSql);

  return {
    operationType: inferOperationType(naturalLanguagePrompt),
    generatedSql,
    riskLevel: validation.riskLevel,
    requiresConfirmation: validation.requiresConfirmation,
    allowed: validation.valid,
    explanation: validation.valid
      ? "Operation passed SQL safety validation."
      : validation.blockedReason || "Operation blocked.",
  };
}
