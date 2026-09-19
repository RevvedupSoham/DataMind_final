import { NextRequest, NextResponse } from "next/server";

import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { requireOwner } from "@/lib/auth/authorization";
import { buildOperationPlan } from "@/lib/owner/operation-planner";
import { createAuditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  const session = await verifySessionToken(token);

  try {
    requireOwner(session);
  } catch {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 403,
      }
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON body.",
      },
      {
        status: 400,
      }
    );
  }

  const prompt = (body as { prompt?: string })?.prompt;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json(
      {
        error: "Prompt is required.",
      },
      {
        status: 400,
      }
    );
  }

  const plan = await buildOperationPlan(prompt);

  await createAuditLog({
    actorUsername: session!.username,
    actorRole: session!.role,
    operationType: "operation_plan_generated",
    executionStatus: plan.allowed ? "planned" : "blocked",
    metadata: {
      prompt,
      generatedSql: plan.generatedSql,
      riskLevel: plan.riskLevel,
      operationType: plan.operationType,
    },
  });

  return NextResponse.json({
    success: true,
    plan,
  });
}
