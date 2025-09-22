import type { APIRoute } from "astro";
import { googleAuth } from "../../lib/google-auth";

const SPREADSHEET_ID = import.meta.env.GOOGLE_SPREADSHEET_ID;

export const GET: APIRoute = async ({ url }) => {
  try {
    if (!SPREADSHEET_ID) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configurazione mancante: GOOGLE_SPREADSHEET_ID non trovata",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Controlla se è una richiesta admin (con token)
    const adminToken = url.searchParams.get("adminToken");
    const isAdminRequest = adminToken && validateAdminToken(adminToken);

    // Leggi dati usando OAuth2
    const data = await googleAuth.readSheet(SPREADSHEET_ID, "Slots!A:C");

    if (!data || data.length <= 1) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          message: "Nessun slot trovato nel foglio Google",
          suggestion: "Aggiungere sedi di tirocinio nel foglio Google Sheets",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Mappa i dati dal foglio (A: ID, B: Nome, C: Posti Totali)
    const allSlots = data
      .slice(1) // Salta la riga header
      .map((row: string[]) => ({
        id: parseInt(row[0]) || 0,
        nome: row[1] || "",
        tipo: "Sede tirocinio", // Valore di default
        postiTotali: parseInt(row[2]) || 0,
      }))
      .filter((slot: any) => slot.id > 0 && slot.nome);

    // Se è una richiesta admin, restituisci tutti gli slot
    if (isAdminRequest) {
      return new Response(
        JSON.stringify({
          success: true,
          data: allSlots,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Per gli studenti, filtra solo le sedi disponibili
    const availableSlots = await filterAvailableSlots(allSlots);

    return new Response(
      JSON.stringify({
        success: true,
        data: availableSlots,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching slots:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Errore interno del server",
        details: error instanceof Error ? error.message : "Errore sconosciuto",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { nome, postiTotali, adminToken } = await request.json();

    // Validazione admin
    if (!validateAdminToken(adminToken)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validazione dati
    if (!nome || !postiTotali || postiTotali < 1) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dati non validi",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!SPREADSHEET_ID) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configurazione mancante: GOOGLE_SPREADSHEET_ID non trovata",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Salva nuovo slot usando OAuth2
    const id = Date.now();
    const row = [id, nome, postiTotali]; // Solo 3 colonne: ID, Nome, Posti

    await googleAuth.writeSheet(SPREADSHEET_ID, "Slots!A:C", [row]);

    return new Response(
      JSON.stringify({
        success: true,
        data: { id, nome, postiTotali },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating slot:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Errore nella creazione della sede",
        details: error instanceof Error ? error.message : "Errore sconosciuto",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

async function filterAvailableSlots(allSlots: any[]): Promise<any[]> {
  try {
    // Ottieni le prenotazioni esistenti
    const prenotazioniUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Prenotazioni!A:M`;
    const prenotazioniResponse = await googleAuth.makeAuthenticatedRequest(prenotazioniUrl);
    
    if (!prenotazioniResponse.ok) {
      console.error("Error fetching prenotazioni for slot filtering:", prenotazioniResponse.status);
      return allSlots; // In caso di errore, restituisci tutti gli slot
    }
    
    const prenotazioniData = await prenotazioniResponse.json();
    if (!prenotazioniData.values || prenotazioniData.values.length <= 1) {
      return allSlots; // Nessuna prenotazione, tutti gli slot sono disponibili
    }
    
    // Conta prenotazioni per ogni slot
    const prenotazioniPerSlot: { [key: string]: number } = {};
    prenotazioniData.values
      .slice(1) // Salta header
      .forEach((row: string[]) => {
        const slotId = row[9]; // Colonna I (slotAssegnato)
        if (slotId) {
          prenotazioniPerSlot[slotId] = (prenotazioniPerSlot[slotId] || 0) + 1;
        }
      });
    
    // Filtra solo gli slot con posti disponibili
    const availableSlots = allSlots.filter(slot => {
      const prenotazioniCount = prenotazioniPerSlot[slot.id] || 0;
      const disponibili = slot.postiTotali - prenotazioniCount;
      
      
      return disponibili > 0;
    });
    
    
    return availableSlots;
  } catch (error) {
    console.error("Error filtering available slots:", error);
    return allSlots; // In caso di errore, restituisci tutti gli slot
  }
}

function validateAdminToken(token: string): boolean {
  // Valida token generati dal login admin
  return token?.startsWith("admin_") && token.length > 10;
}
