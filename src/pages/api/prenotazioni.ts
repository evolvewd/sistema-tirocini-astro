import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../lib/supabase-server";
import { getUserIdFromAuthHeader } from "../../lib/supabase-auth";
import { isAdminRequest } from "../../lib/admin-auth";
import { sendPrenotazioneConfirmEmail } from "../../lib/send-email";

interface PrenotazionePayload {
  email: string;
  cognome: string;
  nome: string;
  annoCorso: string;
  modalita: string;
  numeroTirocinio: string;
  mese: string;
  slotAssegnato: string;
  oreRecupero: string;
  qtaOre?: string;
  note?: string;
}

function validatePrenotazioneData(data: PrenotazionePayload): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Email non valida");
  }
  if (!data.cognome?.trim() || data.cognome.trim().length < 2) {
    errors.push("Cognome deve essere di almeno 2 caratteri");
  }
  if (!data.nome?.trim() || data.nome.trim().length < 2) {
    errors.push("Nome deve essere di almeno 2 caratteri");
  }
  const required = ["annoCorso", "modalita", "numeroTirocinio", "mese", "slotAssegnato", "oreRecupero"] as const;
  for (const field of required) {
    if (!data[field]?.toString().trim()) {
      errors.push(`${field} è obbligatorio`);
    }
  }
  if (data.oreRecupero === "Sì" && (!data.qtaOre || parseFloat(data.qtaOre) < 0.5)) {
    errors.push("Quantità ore da recuperare obbligatoria (minimo 0.5)");
  }
  return { isValid: errors.length === 0, errors };
}

/** Mappa riga DB → formato legacy per il frontend */
function toLegacy(p: {
  id: string;
  data_prenotazione: string;
  email: string;
  cognome: string;
  nome: string;
  anno_corso: string;
  modalita: string;
  numero_tirocinio: string;
  mese: string;
  slot_assegnato: number;
  ore_recupero: string;
  qta_ore: string | null;
  note: string | null;
}) {
  return {
    id: p.id,
    dataPrenotazione: p.data_prenotazione,
    email: p.email,
    cognome: p.cognome,
    nome: p.nome,
    annoCorso: p.anno_corso,
    modalita: p.modalita,
    numeroTirocinio: p.numero_tirocinio,
    mese: p.mese,
    slotAssegnato: String(p.slot_assegnato),
    oreRecupero: p.ore_recupero || "No",
    qtaOre: p.qta_ore ?? "",
    note: p.note ?? "",
  };
}

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const isAdmin = await isAdminRequest(request, {
      queryAdminToken: url.searchParams.get("adminToken"),
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createSupabaseServerClient();
    const { data: rows, error } = await supabase
      .from("prenotazioni")
      .select("*")
      .order("data_prenotazione", { ascending: false });

    if (error) {
      console.error("Error fetching prenotazioni:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Errore nel caricamento delle prenotazioni",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = (rows ?? []).map(toLegacy);
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in prenotazioni GET:", err);
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
    const authHeader = request.headers.get("Authorization");
    const userId = await getUserIdFromAuthHeader(authHeader);

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Devi effettuare l'accesso per prenotare. Iscriviti o accedi.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await request.json()) as PrenotazionePayload;
    const validation = validatePrenotazioneData(body);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.errors.join(", "),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createSupabaseServerClient();
    const slotId = parseInt(body.slotAssegnato, 10);
    if (Number.isNaN(slotId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Sede non valida" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { count: duplicateCount } = await supabase
      .from("prenotazioni")
      .select("id", { count: "exact", head: true })
      .eq("email", body.email.trim());

    if (duplicateCount && duplicateCount > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Questa email ha già effettuato una prenotazione!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: slotRow } = await supabase
      .from("slots")
      .select("id, posti_totali, nome")
      .eq("id", slotId)
      .single();

    if (!slotRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Sede non trovata" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { count: occupati } = await supabase
      .from("prenotazioni")
      .select("id", { count: "exact", head: true })
      .eq("slot_assegnato", slotId);

    if ((occupati ?? 0) >= slotRow.posti_totali) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Spiacente, questa sede non ha più posti disponibili!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: inserted, error } = await supabase
      .from("prenotazioni")
      .insert({
        user_id: userId,
        email: body.email.trim(),
        cognome: body.cognome.trim(),
        nome: body.nome.trim(),
        anno_corso: body.annoCorso,
        modalita: body.modalita,
        numero_tirocinio: body.numeroTirocinio,
        mese: body.mese,
        slot_assegnato: slotId,
        ore_recupero: body.oreRecupero,
        qta_ore: body.oreRecupero === "Sì" ? (body.qtaOre ?? "").trim() || null : null,
        note: body.note?.trim() || null,
      })
      .select("id, data_prenotazione")
      .single();

    if (error) {
      console.error("Error inserting prenotazione:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Errore nel salvataggio della prenotazione",
          details: error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const sedeNome = slotRow?.nome ?? "Sede tirocinio";
    const timeZoneRome = "Europe/Rome";
    const dataPrenotazioneStr = inserted.data_prenotazione
      ? new Date(inserted.data_prenotazione).toLocaleString("it-IT", {
          timeZone: timeZoneRome,
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleString("it-IT", { timeZone: timeZoneRome });

    sendPrenotazioneConfirmEmail({
      to: body.email.trim(),
      nome: body.nome.trim(),
      cognome: body.cognome.trim(),
      sedeNome,
      dataPrenotazione: dataPrenotazioneStr,
    })
      .then((ok) => {
        if (ok) console.log("[prenotazioni] Email conferma inviata a", body.email.trim());
        else console.warn("[prenotazioni] Email conferma non inviata (Resend non configurato o errore)");
      })
      .catch((err) => console.error("[prenotazioni] Errore invio email conferma:", err));

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: inserted.id, message: "Prenotazione creata con successo" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in prenotazioni POST:", err);
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
