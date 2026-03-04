/**
 * Ottiene l'user_id dal token Supabase inviato dal client.
 * Usa l'API Auth di Supabase (GET /auth/v1/user) così il token è validato
 * da Supabase indipendentemente dall'algoritmo (ECC o HS256).
 */

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Estrae il Bearer token dall'header Authorization.
 */
export function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return Promise.resolve(null);
  const token = authHeader.slice(7).trim();
  if (!token) return Promise.resolve(null);
  return getUserIdFromSupabaseToken(token);
}

/**
 * Chiede a Supabase chi è l'utente per questo token (valido per ECC e HS256).
 */
async function getUserIdFromSupabaseToken(token: string): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY non impostati");
    return null;
  }
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}
