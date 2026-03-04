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
  /** Email dell'unico utente che vede il tab Amministrazione (client-side) */
  readonly PUBLIC_ADMIN_EMAIL?: string;
  /** Resend: API key per email transazionali (conferma prenotazione) */
  readonly RESEND_API_KEY?: string;
  /** Resend: indirizzo mittente (es. "Sistema Tirocini <onboarding@resend.dev>") */
  readonly RESEND_FROM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
