import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  cachedClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

export interface AuditLogInput {
  actorUsername: string;
  actorRole: string;
  operationType: string;
  operationTarget?: string | null;
  executionStatus: string;
  affectedRows?: number | null;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(
  input: AuditLogInput
): Promise<void> {
  const client = getClient();

  const { error } = await client
    .from("audit_logs")
    .insert({
      actor_username: input.actorUsername,
      actor_role: input.actorRole,
      operation_type: input.operationType,
      operation_target: input.operationTarget ?? null,
      execution_status: input.executionStatus,
      affected_rows: input.affectedRows ?? null,
      metadata: input.metadata ?? {},
    });

  if (error) {
    console.error("[DataMind] Failed to create audit log", error);
  }
}
