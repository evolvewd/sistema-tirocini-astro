/**
 * Client Supabase per le API routes (server-side).
 * Usa SERVICE_ROLE_KEY per bypassare RLS (solo lato server, mai esporre al client).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("PUBLIC_SUPABASE_URL deve essere impostato in .env");
}

/** Client con privilegi completi: usare solo nelle API routes. */
export function createSupabaseServerClient() {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY deve essere impostato in .env per le API routes"
    );
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
