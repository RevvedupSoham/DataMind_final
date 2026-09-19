import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getEmployeeProfile } from "@/lib/database/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (session.employeeId === null) {
    return NextResponse.json({ error: { message: "Owner accounts do not have an employee profile." } }, { status: 400 });
  }

  try {
    const profile = await getEmployeeProfile(session.employeeId);

    return NextResponse.json({
      authenticated: true,
      username: session.username,
      role: session.role,
      employeeId: session.employeeId,
      profile,
    });
  } catch (error) {
    console.error("[DataMind] Profile route error:", error);
    return NextResponse.json(
      { error: { message: "Could not load your employee profile." } },
      { status: 500 }
    );
  }
}
