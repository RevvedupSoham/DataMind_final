import "server-only";

import { createClient } from "@supabase/supabase-js";

import { verifyPassword } from "@/lib/auth/password";

interface OwnerUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
}

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials are missing.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifyOwnerCredentials(
  username: string,
  password: string
): Promise<OwnerUser | null> {
  const client = getClient();

  const { data, error } = await client
    .from("owner_users")
    .select("id, username, password_hash, display_name")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const owner = data as OwnerUser;

  const validPassword = verifyPassword(
    password,
    owner.password_hash
  );

  if (!validPassword) {
    return null;
  }

  return owner;
}
