/**
 * Client Supabase per il browser (auth + lettura dati con RLS).
 * Usare solo in contesti dove import.meta.env è disponibile (Astro pages/components).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_ANON_KEY devono essere impostati in .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
