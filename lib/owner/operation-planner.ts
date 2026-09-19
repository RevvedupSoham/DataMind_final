import { generateSqlFromPrompt } from "@/lib/owner/sql-generator";
import { validateSqlSafety } from "@/lib/owner/sql-safety";

export interface OperationPlan {
  operationType: string;
  generatedSql: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
  allowed: boolean;
  explanation: string;
}

function inferOperationType(sql: string): string {
  const lower = sql.toLowerCase();

  if (lower.startsWith("select")) {
    return "query";
  }

  if (lower.startsWith("insert")) {
    return "insert";
  }

  if (lower.startsWith("update")) {
    return "update";
  }

  if (lower.startsWith("delete")) {
    return "delete";
  }

  if (lower.startsWith("create")) {
    return "schema_create";
  }

  if (lower.startsWith("alter")) {
    return "schema_alter";
  }

  if (lower.startsWith("drop")) {
    return "schema_drop";
  }

  return "custom";
}

export async function buildOperationPlan(
  naturalLanguagePrompt: string
): Promise<OperationPlan> {
  const generatedSql = await generateSqlFromPrompt(
    naturalLanguagePrompt
  );

  const validation = validateSqlSafety(generatedSql);

  return {
    operationType: inferOperationType(generatedSql),
    generatedSql,
    riskLevel: validation.riskLevel,
    requiresConfirmation: validation.requiresConfirmation,
    allowed: validation.valid,
    explanation: validation.valid
      ? "Governed execution plan generated successfully."
      : validation.blockedReason || "Operation blocked.",
  };
}
