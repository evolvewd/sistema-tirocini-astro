/**
 * Verifica JWT Supabase lato server e restituisce user_id (sub).
 * Richiede SUPABASE_JWT_SECRET in .env (Supabase Dashboard → Project → API → JWT Secret).
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = import.meta.env.SUPABASE_JWT_SECRET;

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Estrae e verifica il Bearer token dall'header Authorization.
 * Restituisce l'user_id (uuid) se il token è valido, altrimenti null.
 */
export function getUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return getUserIdFromJwt(token);
}

/**
 * Verifica il JWT Supabase e restituisce sub (user id).
 */
export function getUserIdFromJwt(token: string): string | null {
  if (!JWT_SECRET) {
    console.warn("SUPABASE_JWT_SECRET non impostato: impossibile verificare token");
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}
