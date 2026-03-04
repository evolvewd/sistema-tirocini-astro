/**
 * Invio email tramite Resend (https://resend.com).
 * Per abilitare: imposta RESEND_API_KEY e RESEND_FROM in .env.
 */

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const RESEND_FROM = import.meta.env.RESEND_FROM ?? "Sistema Tirocini <onboarding@resend.dev>";

export interface PrenotazioneEmailData {
  to: string;
  nome: string;
  cognome: string;
  sedeNome: string;
  dataPrenotazione: string;
}

/**
 * Invia email di conferma prenotazione. Non blocca se Resend non è configurato.
 */
export async function sendPrenotazioneConfirmEmail(data: PrenotazioneEmailData): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[send-email] RESEND_API_KEY non impostato: email di conferma non inviata. Imposta RESEND_API_KEY e RESEND_FROM in Vercel (Environment Variables).");
    return false;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #8b1538;">Prenotazione confermata</h2>
      <p>Gentile ${data.nome} ${data.cognome},</p>
      <p>La tua prenotazione di tirocinio è stata registrata con successo.</p>
      <ul style="list-style: none; padding: 0;">
        <li><strong>Sede:</strong> ${data.sedeNome}</li>
        <li><strong>Data richiesta:</strong> ${data.dataPrenotazione}</li>
      </ul>
      <p>Per eventuali modifiche o informazioni contatta l'amministratore.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 2rem;">
        Sistema Prenotazione Tirocini
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [data.to],
        subject: "Prenotazione tirocinio confermata",
        html,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      console.error("[send-email] Resend API error:", res.status, err?.message ?? err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[send-email] Errore invio email:", e);
    return false;
  }
}
