import { generateOwnerSqlFromPrompt } from "@/lib/llm/groq";

export async function generateSqlFromPrompt(
  prompt: string
): Promise<string> {
  const generated = await generateOwnerSqlFromPrompt(prompt);
  return generated.sql.trim();
}
