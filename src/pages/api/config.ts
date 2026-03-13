import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../lib/supabase-server";
import { isAdminRequest } from "../../lib/admin-auth";

const CONFIG_ID = "main";

/** GET: legge stato prenotazioni (pubblico, per mostrare messaggio "chiuse" agli studenti) */
export const GET: APIRoute = async () => {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("config")
      .select("prenotazioni_aperte")
      .eq("id", CONFIG_ID)
      .single();

    if (error) {
      console.error("Error fetching config:", error);
      return new Response(
        JSON.stringify({
          success: false,
          prenotazioni_aperte: false,
          error: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        prenotazioni_aperte: data?.prenotazioni_aperte ?? false,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in config GET:", err);
    return new Response(
      JSON.stringify({
        success: false,
        prenotazioni_aperte: false,
        error: err instanceof Error ? err.message : "Errore interno",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

/** PATCH: aggiorna stato prenotazioni (solo admin) */
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const isAdmin = await isAdminRequest(request);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await request.json()) as { prenotazioni_aperte?: boolean };
    const prenotazioni_aperte = Boolean(body.prenotazioni_aperte);

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("config")
      .update({ prenotazioni_aperte })
      .eq("id", CONFIG_ID)
      .select("prenotazioni_aperte")
      .single();

    if (error) {
      console.error("Error updating config:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        prenotazioni_aperte: data?.prenotazioni_aperte ?? false,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in config PATCH:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Errore interno",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
