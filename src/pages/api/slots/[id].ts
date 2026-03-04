import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { isAdminRequest } from "../../../lib/admin-auth";

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const slotId = params.id;
    const isAdmin = await isAdminRequest(request);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!slotId) {
      return new Response(
        JSON.stringify({ success: false, error: "ID slot mancante" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const id = parseInt(slotId, 10);
    if (Number.isNaN(id)) {
      return new Response(
        JSON.stringify({ success: false, error: "ID slot non valido" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createSupabaseServerClient();

    const { count } = await supabase
      .from("prenotazioni")
      .select("id", { count: "exact", head: true })
      .eq("slot_assegnato", id);

    if (count && count > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Impossibile eliminare: esistono prenotazioni per questa sede",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase.from("slots").delete().eq("id", id);

    if (error) {
      console.error("Error deleting slot:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Errore nell'eliminazione della sede",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Sede eliminata con successo" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in slots DELETE:", err);
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
