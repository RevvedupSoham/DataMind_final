import { NextResponse } from "next/server";
import { checkDatabaseConnection, DatabaseError } from "@/lib/database/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseConnection();
    return NextResponse.json({ ok: true, database: "connected" });
  } catch (error) {
    const message =
      error instanceof DatabaseError
        ? error.message
        : "The database health check failed.";

    return NextResponse.json(
      { ok: false, database: "disconnected", message },
      { status: 503 }
    );
  }
}
