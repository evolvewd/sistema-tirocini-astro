import type { APIRoute } from "astro";
import { googleAuth } from "../../lib/google-auth";

// Configurazione Google Sheets
const SPREADSHEET_ID = import.meta.env.GOOGLE_SPREADSHEET_ID;

interface PrenotazioneData {
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const data: PrenotazioneData = await request.json();

    // Validazione
    const validation = validatePrenotazioneData(data);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.errors.join(", "),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Controlla email duplicata
    const isDuplicate = await checkDuplicateEmail(data.email);
    if (isDuplicate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Questa email ha già effettuato una prenotazione!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Controlla disponibilità slot
    const isAvailable = await checkSlotAvailability(data.slotAssegnato);
    if (!isAvailable) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Spiacente, questa sede non ha più posti disponibili!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Salva prenotazione
    const result = await savePrenotazione(data);

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in prenotazioni API:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Errore interno del server",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // Get prenotazioni (per admin) - supporta sia header che query param
    const authHeader = request.headers.get("Authorization");
    const adminToken = authHeader || url.searchParams.get("adminToken");

    if (!adminToken || !validateAdminToken(adminToken)) {
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

    const prenotazioni = await getPrenotazioni();

    return new Response(
      JSON.stringify({
        success: true,
        data: prenotazioni,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting prenotazioni:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Errore nel caricamento delle prenotazioni",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// === UTILITY FUNCTIONS ===

function validatePrenotazioneData(data: PrenotazioneData) {
  const errors: string[] = [];

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Email non valida");
  }

  if (!data.cognome || data.cognome.trim().length < 2) {
    errors.push("Cognome deve essere di almeno 2 caratteri");
  }

  if (!data.nome || data.nome.trim().length < 2) {
    errors.push("Nome deve essere di almeno 2 caratteri");
  }

  const required = [
    "annoCorso",
    "modalita",
    "numeroTirocinio",
    "mese",
    "slotAssegnato",
    "oreRecupero",
  ];
  for (const field of required) {
    if (!data[field as keyof PrenotazioneData]) {
      errors.push(`${field} è obbligatorio`);
    }
  }

  if (
    data.oreRecupero === "Sì" &&
    (!data.qtaOre || parseFloat(data.qtaOre) < 0.5)
  ) {
    errors.push("Quantità ore da recuperare è obbligatoria (minimo 0.5)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

async function checkDuplicateEmail(email: string): Promise<boolean> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Prenotazioni!C:C`;
    const response = await googleAuth.makeAuthenticatedRequest(url);

    if (!response.ok) {
      console.error("Error checking duplicate email - HTTP:", response.status);
      return false; // In caso di errore, non bloccare la prenotazione
    }

    const data = await response.json();

    if (data.values) {
      return data.values.some(
        (row: string[], index: number) => index > 0 && row[0] === email
      );
    }

    return false;
  } catch (error) {
    console.error("Error checking duplicate email:", error);
    return false; // In caso di errore, non bloccare la prenotazione
  }
}

async function checkSlotAvailability(slotId: string): Promise<boolean> {
  try {
    // 1. Ottieni i dati dello slot per conoscere i posti totali
    const slotsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Slots!A:C`;
    const slotsResponse = await googleAuth.makeAuthenticatedRequest(slotsUrl);
    
    if (!slotsResponse.ok) {
      console.error("Error fetching slots for availability check:", slotsResponse.status);
      return false;
    }
    
    const slotsData = await slotsResponse.json();
    if (!slotsData.values || slotsData.values.length <= 1) {
      return false;
    }
    
    // Trova lo slot specifico
    const slot = slotsData.values
      .slice(1) // Salta header
      .find((row: string[]) => row[0] === slotId);
    
    if (!slot) {
      return false; // Slot non trovato
    }
    
    const postiTotali = parseInt(slot[2]) || 0;
    if (postiTotali <= 0) {
      return false; // Slot senza posti
    }
    
    // 2. Conta le prenotazioni esistenti per questo slot
    const prenotazioniUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Prenotazioni!A:M`;
    const prenotazioniResponse = await googleAuth.makeAuthenticatedRequest(prenotazioniUrl);
    
    if (!prenotazioniResponse.ok) {
      console.error("Error fetching prenotazioni for availability check:", prenotazioniResponse.status);
      return false;
    }
    
    const prenotazioniData = await prenotazioniResponse.json();
    if (!prenotazioniData.values || prenotazioniData.values.length <= 1) {
      return true; // Nessuna prenotazione esistente, slot disponibile
    }
    
    // Conta prenotazioni per questo slot (colonna I = slotAssegnato)
    const prenotazioniCount = prenotazioniData.values
      .slice(1) // Salta header
      .filter((row: string[]) => row[9] === slotId).length; // Colonna I (0-indexed = 9)
    
    const disponibili = postiTotali - prenotazioniCount;
    
    
    return disponibili > 0;
  } catch (error) {
    console.error("Error checking slot availability:", error);
    return false;
  }
}

async function savePrenotazione(data: PrenotazioneData) {
  try {
    const id = Date.now();
    const timestamp = new Date().toISOString();

    const row = [
      id,
      timestamp,
      data.email,
      data.cognome,
      data.nome,
      data.annoCorso,
      data.modalita,
      data.numeroTirocinio,
      data.mese,
      data.slotAssegnato,
      data.oreRecupero,
      data.qtaOre || "",
      data.note || "",
    ];

    // Append row to Google Sheets
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Prenotazioni!A:M:append?valueInputOption=RAW`;
    const response = await googleAuth.makeAuthenticatedRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      throw new Error("Errore salvataggio prenotazione");
    }

    return { id, message: "Prenotazione creata con successo" };
  } catch (error) {
    console.error("Error saving prenotazione:", error);
    throw error;
  }
}

async function getPrenotazioni() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Prenotazioni!A:M`;
    const response = await googleAuth.makeAuthenticatedRequest(url);
    const data = await response.json();

    if (!data.values || data.values.length <= 1) {
      return [];
    }

    return data.values.slice(1).map((row: string[]) => ({
      id: row[0],
      dataPrenotazione: row[1],
      email: row[2],
      cognome: row[3],
      nome: row[4],
      annoCorso: row[5],
      modalita: row[6],
      numeroTirocinio: row[7],
      mese: row[8],
      slotAssegnato: row[9],
      oreRecupero: row[10] || "No",
      qtaOre: row[11] || "",
      note: row[12] || "",
    }));
  } catch (error) {
    console.error("Error getting prenotazioni:", error);
    throw error;
  }
}

function validateAdminToken(token: string): boolean {
  // Valida token generati dal login admin
  return token?.startsWith("admin_") && token.length > 10;
}
