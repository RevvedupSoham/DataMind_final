import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/database/supabase";
import {
  createSessionToken,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import type { LoginRequestBody } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { username, password, panel } = (body as Partial<LoginRequestBody>) ?? {};

  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter a username and password." }, { status: 400 });
  }

  if (panel !== "admin" && panel !== "member") {
    return NextResponse.json({ error: "Select Admin or Member before signing in." }, { status: 400 });
  }

  // The panel selected on the login screen determines which table gets
  // checked — verify_admin_login only ever queries admin_users, and
  // verify_member_login only ever queries member_users (see
  // auth_setup.sql). There is no cross-table fallback: if the credentials
  // don't match a row in that specific table, this fails, even if the same
  // username/password would succeed against the other table.
  const role = await verifyCredentials(username.trim(), password, panel);

  if (!role) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const token = await createSessionToken(username.trim(), role);

  const response = NextResponse.json({ username: username.trim(), role });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
