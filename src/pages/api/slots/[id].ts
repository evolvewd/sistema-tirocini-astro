import type { APIRoute } from "astro";
import { googleAuth } from "../../../lib/google-auth";

const SPREADSHEET_ID = import.meta.env.GOOGLE_SPREADSHEET_ID;

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const slotId = params.id;
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

    if (!slotId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ID slot mancante",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Implementazione reale eliminazione da Google Sheets
    try {
      // 1. Leggi tutto il foglio per trovare la riga da eliminare
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Slots!A:C`;
      const readResponse = await googleAuth.makeAuthenticatedRequest(readUrl);

      if (!readResponse.ok) {
        throw new Error(`Errore lettura foglio: ${readResponse.status}`);
      }

      const readData = await readResponse.json();

      if (!readData.values || readData.values.length <= 1) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Foglio vuoto o slot non trovato",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }


      // 3. Filtra direttamente rimuovendo la riga con l'ID corrispondente
      const originalCount = readData.values.length;
      const newValues = readData.values.filter(
        (row: string[], index: number) => {
          // Mantieni l'header (index 0) e rimuovi la riga con l'ID corrispondente
          if (index === 0) return true; // Header
          const keep = parseInt(row[0]) !== parseInt(slotId);
          return keep;
        }
      );


      // Verifica se è stata rimossa almeno una riga
      if (newValues.length === originalCount) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Slot non trovato nel foglio",
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
        if (parseInt(readData.values[i][0]) === parseInt(slotId)) {
          rowToDelete = i + 1; // Google Sheets è 1-indexed, +1 perché includiamo l'header
          break;
        }
      }

      if (rowToDelete === -1) {
        throw new Error("Riga da cancellare non trovata");
      }


      // 5. Prima ottieni l'ID del foglio "Slots"
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
      const metadataResponse = await googleAuth.makeAuthenticatedRequest(
        metadataUrl
      );

      if (!metadataResponse.ok) {
        throw new Error(
          `Errore ottenimento metadati: ${metadataResponse.status}`
        );
      }

      const metadata = await metadataResponse.json();
      const slotsSheet = metadata.sheets.find(
        (sheet: any) => sheet.properties.title === "Slots"
      );

      if (!slotsSheet) {
        throw new Error("Foglio 'Slots' non trovato");
      }

      const sheetId = slotsSheet.properties.sheetId;

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
                    sheetId: sheetId, // ID dinamico del foglio Slots
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
        const errorText = await updateResponse.text();
        console.error("❌ Errore aggiornamento foglio:", {
          status: updateResponse.status,
          error: errorText,
        });
        throw new Error(
          `Errore aggiornamento foglio: ${updateResponse.status} - ${errorText}`
        );
      }

      const updateResult = await updateResponse.json();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Slot eliminato con successo",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Errore eliminazione slot:", error);
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
    console.error("Error deleting slot:", error);
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
