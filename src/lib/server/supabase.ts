import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";

let client: SupabaseClient | null = null;

/**
 * Returns a server-only Supabase client using the secret key.
 * Bypasses RLS — server-side only; never expose to the client.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL environment variable");
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY environment variable");

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}
