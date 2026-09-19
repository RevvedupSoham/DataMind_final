import { NextRequest, NextResponse } from "next/server";

import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { requireOwner } from "@/lib/auth/authorization";
import { buildOperationPlan } from "@/lib/owner/operation-planner";
import { createOwnerApprovalToken } from "@/lib/owner/approval";
import { createAuditLog } from "@/lib/audit/logger";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  try {
    requireOwner(session);
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = (body as { prompt?: string })?.prompt?.trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (prompt.length > 4000) {
    return NextResponse.json(
      { error: "Prompt is too long." },
      { status: 400 }
    );
  }

  try {
    const plan = await buildOperationPlan(prompt);

    if (!plan.allowed) {
      await createAuditLog({
        actorUsername: session!.username,
        actorRole: session!.role,
        operationType: "operation_plan_generated",
        executionStatus: "blocked",
        metadata: {
          prompt,
          generatedSql: plan.generatedSql,
          riskLevel: plan.riskLevel,
          operationType: plan.operationType,
          explanation: plan.explanation,
        },
      });

      return NextResponse.json({ success: true, plan }, { status: 200 });
    }

    const approvalToken = createOwnerApprovalToken(
      session!.username,
      plan.generatedSql,
      plan.requiresConfirmation
    );

    await createAuditLog({
      actorUsername: session!.username,
      actorRole: session!.role,
      operationType: "operation_plan_generated",
      executionStatus: plan.requiresConfirmation ? "awaiting_confirmation" : "planned",
      metadata: {
        prompt,
        generatedSql: plan.generatedSql,
        riskLevel: plan.riskLevel,
        operationType: plan.operationType,
        requiresConfirmation: plan.requiresConfirmation,
      },
    });

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        approvalToken,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Planning failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
