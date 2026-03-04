import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase-server";

function validateAdminToken(token: string | null): boolean {
  if (!token) return false;
  const t = token.replace(/^Bearer\s+/i, "").trim();
  return t.startsWith("admin_") && t.length > 10;
}

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const prenotazioneId = params.id;
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!validateAdminToken(token ?? null)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!prenotazioneId) {
      return new Response(
        JSON.stringify({ success: false, error: "ID prenotazione mancante" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("prenotazioni")
      .delete()
      .eq("id", prenotazioneId);

    if (error) {
      if (error.code === "PGRST116") {
        return new Response(
          JSON.stringify({ success: false, error: "Prenotazione non trovata" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      console.error("Error deleting prenotazione:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Errore nell'eliminazione della prenotazione",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Prenotazione eliminata con successo" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in prenotazioni DELETE:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Errore interno del server",
        details: err instanceof Error ? err.message : "",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
