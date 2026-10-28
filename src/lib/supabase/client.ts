import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseEnv } from "@/lib/env";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

/**
 * The single Supabase client. Uses the publishable key only (nothing secret in the client).
 * Throws MissingEnvError with a clear message when VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const env = parseEnv(import.meta.env);
  client = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Implicit flow: the reset link from the email may open in another browser than the one that asked
      // for it (installed iOS PWA vs Safari). PKCE would need the code verifier from the original browser.
      flowType: "implicit",
    },
  });
  return client;
}
