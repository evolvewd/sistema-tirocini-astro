import type { APIRoute } from "astro";
import { googleAuth } from "../../../lib/google-auth";

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const prenotazioneId = params.id;
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token || !validateAdminToken(token)) {
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

    if (!prenotazioneId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ID prenotazione mancante",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Implementazione reale eliminazione da Google Sheets
    const SPREADSHEET_ID = import.meta.env.GOOGLE_SPREADSHEET_ID;

    try {
      // 1. Leggi tutto il foglio Prenotazioni
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Prenotazioni!A:M`;
      const readResponse = await googleAuth.makeAuthenticatedRequest(readUrl);

      if (!readResponse.ok) {
        throw new Error(`Errore lettura foglio: ${readResponse.status}`);
      }

      const readData = await readResponse.json();

      if (!readData.values || readData.values.length <= 1) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Foglio vuoto o prenotazione non trovata",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 2. Filtra direttamente rimuovendo la riga con l'ID corrispondente
      const originalCount = readData.values.length;
      const newValues = readData.values.filter(
        (row: string[], index: number) => {
          // Mantieni l'header (index 0) e rimuovi la riga con l'ID corrispondente
          if (index === 0) return true; // Header
          return row[0] !== prenotazioneId;
        }
      );

      // Verifica se è stata rimossa almeno una riga
      if (newValues.length === originalCount) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Prenotazione non trovata nel foglio",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 4. Trova il numero di riga effettivo da cancellare (1-indexed)
      let rowToDelete = -1;
      for (let i = 1; i < readData.values.length; i++) {
        if (readData.values[i][0] === prenotazioneId) {
          rowToDelete = i + 1; // Google Sheets è 1-indexed, +1 perché includiamo l'header
          break;
        }
      }

      if (rowToDelete === -1) {
        throw new Error("Riga da cancellare non trovata");
      }


      // 5. Prima ottieni l'ID del foglio "Prenotazioni"
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
      const metadataResponse = await googleAuth.makeAuthenticatedRequest(metadataUrl);
      
      if (!metadataResponse.ok) {
        throw new Error(`Errore ottenimento metadati: ${metadataResponse.status}`);
      }
      
      const metadata = await metadataResponse.json();
      const prenotazioniSheet = metadata.sheets.find(
        (sheet: any) => sheet.properties.title === "Prenotazioni"
      );
      
      if (!prenotazioniSheet) {
        throw new Error("Foglio 'Prenotazioni' non trovato");
      }
      
      const sheetId = prenotazioniSheet.properties.sheetId;

      // 6. Usa batchUpdate per cancellare la riga specifica
      const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
      const updateResponse = await googleAuth.makeAuthenticatedRequest(
        batchUpdateUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId, // ID dinamico del foglio Prenotazioni
                    dimension: "ROWS",
                    startIndex: rowToDelete - 1, // 0-indexed per l'API
                    endIndex: rowToDelete, // Esclusivo
                  },
                },
              },
            ],
          }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error(
          `Errore aggiornamento foglio: ${updateResponse.status}`
        );
      }


      return new Response(
        JSON.stringify({
          success: true,
          message: "Prenotazione eliminata con successo",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Errore eliminazione prenotazione:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Errore nell'eliminazione dal foglio Google",
          details:
            error instanceof Error ? error.message : "Errore sconosciuto",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error deleting prenotazione:", error);
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

function validateAdminToken(token: string): boolean {
  return token?.startsWith("admin_") && token.length > 10;
}
