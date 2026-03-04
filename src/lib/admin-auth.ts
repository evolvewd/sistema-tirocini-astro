/**
 * Verifica se la richiesta è autorizzata come admin:
 * - token legacy (admin_xxx) da Authorization o query, oppure
 * - Bearer JWT Supabase con email uguale a PUBLIC_ADMIN_EMAIL
 */

import { getEmailFromAuthHeader } from "./supabase-auth";

const ADMIN_EMAIL = (import.meta.env.PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();

function isLegacyAdminToken(token: string | null): boolean {
  if (!token) return false;
  const t = token.replace(/^Bearer\s+/i, "").trim();
  return t.startsWith("admin_") && t.length > 10;
}

/**
 * Restituisce true se la richiesta è autorizzata come admin (token legacy o JWT admin).
 */
export async function isAdminRequest(
  request: Request,
  options?: { queryAdminToken?: string | null }
): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  const legacyToken = authHeader ?? options?.queryAdminToken ?? null;

  if (isLegacyAdminToken(legacyToken)) return true;

  if (authHeader?.startsWith("Bearer ")) {
    const email = await getEmailFromAuthHeader(authHeader);
    if (ADMIN_EMAIL && email?.toLowerCase() === ADMIN_EMAIL) return true;
  }

  return false;
}
