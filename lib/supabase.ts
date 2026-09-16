import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client using the service role key — never import this from a
 * "use client" component. Used by API routes to write orders.
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }
  return createClient(url, key);
}
