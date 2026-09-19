import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("[DataMind] GEMINI_API_KEY is not configured.");
}

const genAI = new GoogleGenerativeAI(apiKey || "missing-key");

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

export async function generateSqlFromPrompt(
  prompt: string
): Promise<string> {
  const result = await model.generateContent(`
You are the SQL execution engine for DataMind.

Rules:
- Output ONLY PostgreSQL SQL
- No markdown
- No explanations
- Single operation only
- Prefer explicit column definitions
- PostgreSQL compatible
- Never output multiple unrelated statements

User request:
${prompt}
  `);

  return result.response.text().trim();
}
