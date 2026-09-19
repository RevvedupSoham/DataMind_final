import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, verifyOwnerCredentials } from "@/lib/database/supabase";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { LoginRequestBody } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const { username, password, panel } = (body as Partial<LoginRequestBody>) ?? {};

  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter a username and password." }, { status: 400 });
  }
  if (panel !== "owner" && panel !== "admin" && panel !== "member") {
    return NextResponse.json({ error: "Select Owner, Admin, or Member before signing in." }, { status: 400 });
  }

  let role: "owner" | "admin" | "member";
  let employeeId: number | null;

  if (panel === "owner") {
    if (!(await verifyOwnerCredentials(username.trim(), password))) {
      return NextResponse.json({ error: "Incorrect Owner username or password." }, { status: 401 });
    }
    role = "owner";
    employeeId = null;
  } else {
    const result = await verifyCredentials(username.trim(), password, panel);
    if (!result) return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    role = result.role;
    employeeId = result.employeeId;
    if (!employeeId) {
      return NextResponse.json({ error: "Your account is not mapped to an employee. Contact your administrator." }, { status: 403 });
    }
  }

  const token = await createSessionToken(username.trim(), role, employeeId);
  const response = NextResponse.json({ username: username.trim(), role, employeeId });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
  });
  return response;
}
