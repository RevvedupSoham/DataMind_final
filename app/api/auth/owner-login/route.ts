import { NextRequest, NextResponse } from "next/server";

import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

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

  const ownerUsername = process.env.OWNER_USERNAME;
  const ownerPassword = process.env.OWNER_PASSWORD;

  if (!ownerUsername || !ownerPassword) {
    return NextResponse.json(
      {
        error: "Owner authentication is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    username.trim() !== ownerUsername ||
    password !== ownerPassword
  ) {
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
    username.trim(),
    "owner",
    null
  );

  const response = NextResponse.json({
    username: username.trim(),
    role: "owner",
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return response;
}
