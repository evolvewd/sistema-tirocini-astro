/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** URL progetto Supabase (client + server) */
  readonly PUBLIC_SUPABASE_URL: string;
  /** Chiave anon Supabase (client + server) */
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  /** Usare solo lato server (API routes); non esporre al client */
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  /** JWT Secret (Supabase Dashboard → API) per verificare token lato server */
  readonly SUPABASE_JWT_SECRET?: string;
  /** Password pannello admin */
  readonly ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
