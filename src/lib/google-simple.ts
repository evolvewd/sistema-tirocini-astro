/**
 * Google Sheets API - Versione Semplificata
 * Usa API Key senza restrizioni per accesso completo
 */

const GOOGLE_API_KEY = import.meta.env.GOOGLE_API_KEY;
const SPREADSHEET_ID = import.meta.env.GOOGLE_SPREADSHEET_ID;

export class SimpleGoogleSheets {
  
  /**
   * Legge dati da un range del foglio
   */
  static async readSheet(range: string): Promise<any[]> {
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY non configurata');
    }
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Google Sheets Read Error:', {
        status: response.status,
        url,
        error: errorText
      });
      throw new Error(`Sheets read error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.values || [];
  }

  /**
   * Aggiunge dati a un range del foglio
   */
  static async appendSheet(range: string, values: any[][]): Promise<void> {
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY non configurata');
    }
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Google Sheets Write Error:', {
        status: response.status,
        url,
        error: errorText
      });
      throw new Error(`Sheets write error: ${response.status}`);
    }
  }

  /**
   * Aggiorna completamente un range del foglio (per eliminazioni)
   */
  static async updateSheet(range: string, values: any[][]): Promise<void> {
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY non configurata');
    }
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Google Sheets Update Error:', {
        status: response.status,
        url,
        error: errorText
      });
      throw new Error(`Sheets update error: ${response.status}`);
    }
  }
}
