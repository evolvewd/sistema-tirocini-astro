/**
 * Google Service Account Authentication
 * Usa Service Account per accesso diretto senza user flow
 */
import jwt from "jsonwebtoken";

// interface ServiceAccountKey { // Rimossa - non utilizzata
// interface _ServiceAccountKey {
//   type: string;
//   project_id: string;
//   private_key_id: string;
//   private_key: string;
//   client_email: string;
//   client_id: string;
//   auth_uri: string;
//   token_uri: string;
//   auth_provider_x509_cert_url: string;
//   client_x509_cert_url: string;
// }

export class GoogleSheetsAuth {
  // private serviceAccount: ServiceAccountKey | null = null; // Rimossa - non utilizzata
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Per sviluppo, usiamo le credenziali OAuth2 che hai già
    // In produzione, useremo Service Account
    this.initializeAuth();
  }

  private initializeAuth() {
    // Per ora, usiamo un approccio semplificato con le tue credenziali OAuth2
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;

    if (clientId && clientSecret) {
    } else {
      console.warn("⚠️ OAuth2 credentials missing");
    }
  }

  /**
   * Per ora, torniamo all'API Key come fallback funzionante
   * TODO: Implementare Service Account reale per OAuth2
   */
  async getAccessToken(): Promise<string> {
    // Se il token è ancora valido, riutilizzalo
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Usa Service Account JSON dal .env
    const serviceAccountJson = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON non configurata nel file .env"
      );
    }

    const credentials = JSON.parse(serviceAccountJson);
    return await this.getServiceAccountToken(credentials);
  }

  /**
   * Genera JWT token per Service Account
   */
  private async getServiceAccountToken(credentials: any): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // Crea JWT firmato
    const token = jwt.sign(payload, credentials.private_key, {
      algorithm: "RS256",
    });

    // Scambia JWT per access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🚨 Service Account Auth Error:", {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Service Account auth failed: ${response.status}`);
    }

    const data = await response.json();

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    if (!this.accessToken) {
      throw new Error("Access token non ricevuto dal server OAuth2");
    }

    return this.accessToken;
  }

  /**
   * Effettua una chiamata usando API Key (fallback)
   */
  async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAccessToken();

    // Se è un API Key, aggiungilo all'URL
    if (token.startsWith("AIza")) {
      const urlWithKey = url + (url.includes("?") ? "&" : "?") + `key=${token}`;
      return fetch(urlWithKey, {
        ...options,
        headers: {
          ...options.headers,
          "Content-Type": "application/json",
        },
      });
    }

    // Se è un access token OAuth2, usa Bearer
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Legge dati da un range del foglio
   */
  async readSheet(spreadsheetId: string, range: string): Promise<any[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    const response = await this.makeAuthenticatedRequest(url);

    if (!response.ok) {
      throw new Error(`Sheets read error: ${response.status}`);
    }

    const data = await response.json();
    return data.values || [];
  }

  /**
   * Scrive dati in un range del foglio
   */
  async writeSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`;

    const response = await this.makeAuthenticatedRequest(url, {
      method: "POST",
      body: JSON.stringify({ values }),
    });

    if (!response.ok) {
      throw new Error(`Sheets write error: ${response.status}`);
    }
  }

  /**
   * Aggiorna un range del foglio (per eliminazioni)
   */
  async updateSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;

    const response = await this.makeAuthenticatedRequest(url, {
      method: "PUT",
      body: JSON.stringify({ values }),
    });

    if (!response.ok) {
      throw new Error(`Sheets update error: ${response.status}`);
    }
  }
}

// Istanza singleton
export const googleAuth = new GoogleSheetsAuth();
