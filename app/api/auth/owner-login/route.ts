import { NextRequest, NextResponse } from "next/server";

import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

import { createAuditLog } from "@/lib/audit/logger";
import { verifyOwnerCredentials } from "@/lib/database/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Request body must be valid JSON.",
      },
      {
        status: 400,
      }
    );
  }

  const { username, password } =
    (body as {
      username?: string;
      password?: string;
    }) ?? {};

  if (!username || !password) {
    return NextResponse.json(
      {
        error: "Enter owner credentials.",
      },
      {
        status: 400,
      }
    );
  }

  const owner = await verifyOwnerCredentials(
    username.trim(),
    password
  );

  if (!owner) {
    await createAuditLog({
      actorUsername: username.trim(),
      actorRole: "owner",
      operationType: "owner_login",
      executionStatus: "failed",
      metadata: {
        reason: "invalid_credentials",
      },
    });

    return NextResponse.json(
      {
        error: "Invalid owner credentials.",
      },
      {
        status: 401,
      }
    );
  }

  const token = await createSessionToken(
    owner.username,
    "owner",
    null
  );

  await createAuditLog({
    actorUsername: owner.username,
    actorRole: "owner",
    operationType: "owner_login",
    executionStatus: "success",
  });

  const response = NextResponse.json({
    username: owner.username,
    displayName: owner.display_name,
    role: "owner",
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });

  return response;
}
