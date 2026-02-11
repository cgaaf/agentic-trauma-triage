import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";

let client: SupabaseClient | null = null;

/**
 * Returns a server-only Supabase client using the service role key.
 * Bypasses RLS — appropriate for server-side data loading only.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL environment variable");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}
