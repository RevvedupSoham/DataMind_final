import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_SECONDS,
  verifySessionToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refreshes an active session. The client calls this only while the user
 * has been active recently. The cookie remains a browser-session cookie,
 * while the signed token gets another 30 minutes from the latest heartbeat.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  const refreshedToken = await createSessionToken(
    session.username,
    session.role,
    session.employeeId
  );

  const response = NextResponse.json({
    authenticated: true,
    username: session.username,
    role: session.role,
    employeeId: session.employeeId,
    timeoutMinutes: SESSION_IDLE_TIMEOUT_SECONDS / 60,
  });

  response.cookies.set(SESSION_COOKIE_NAME, refreshedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return response;
}
