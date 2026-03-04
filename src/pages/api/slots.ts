import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../lib/supabase-server";

function validateAdminToken(token: string | null): boolean {
  if (!token) return false;
  const t = token.replace(/^Bearer\s+/i, "").trim();
  return t.startsWith("admin_") && t.length > 10;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const supabase = createSupabaseServerClient();
    const adminToken = url.searchParams.get("adminToken");
    const isAdminRequest = validateAdminToken(adminToken);

    const { data: slotsRows, error } = await supabase
      .from("slots")
      .select("id, nome, posti_totali")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching slots:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Errore nel caricamento delle sedi",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const allSlots = (slotsRows ?? []).map((row) => ({
      id: row.id,
      nome: row.nome,
      tipo: "Sede tirocinio",
      postiTotali: row.posti_totali,
    }));

    if (isAdminRequest) {
      return new Response(
        JSON.stringify({ success: true, data: allSlots }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: prenotazioniRows } = await supabase
      .from("prenotazioni")
      .select("slot_assegnato");

    const countBySlot: Record<number, number> = {};
    (prenotazioniRows ?? []).forEach((p) => {
      const id = Number(p.slot_assegnato);
      countBySlot[id] = (countBySlot[id] ?? 0) + 1;
    });

    const availableSlots = allSlots.filter((slot) => {
      const occupati = countBySlot[slot.id] ?? 0;
      return slot.postiTotali - occupati > 0;
    });

    return new Response(
      JSON.stringify({ success: true, data: availableSlots }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in slots GET:", err);
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { nome, postiTotali, adminToken } = body as {
      nome?: string;
      postiTotali?: number;
      adminToken?: string;
    };

    if (!validateAdminToken(adminToken ?? null)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!nome?.trim() || postiTotali == null || postiTotali < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "Dati non validi" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("slots")
      .insert({ nome: nome.trim(), posti_totali: postiTotali })
      .select("id, nome, posti_totali")
      .single();

    if (error) {
      console.error("Error creating slot:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Errore nella creazione della sede",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: data.id,
          nome: data.nome,
          postiTotali: data.posti_totali,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in slots POST:", err);
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
