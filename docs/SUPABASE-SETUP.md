# Configurazione Supabase

## 1. Crea progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un progetto.
2. In **Project Settings → API** trovi:
   - **Project URL** → `PUBLIC_SUPABASE_URL`
   - **anon public** → `PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`
3. In **Project Settings → API → JWT Settings** copia **JWT Secret** → `SUPABASE_JWT_SECRET`.

## 2. Esegui lo schema SQL

1. Nel dashboard Supabase apri **SQL Editor**.
2. Copia il contenuto di `supabase/schema.sql` e esegui lo script.
3. Verifica che le tabelle `slots`, `prenotazioni` e `profiles` siano state create.

## 2b. Precarga sedi di tirocinio (opzionale)

Per caricare le sedi da `docs/Database Tirocini - Slots.tsv`:

1. Nel **SQL Editor** apri ed esegui `supabase/seed-slots.sql`.
2. Verifica in **Table Editor → slots** che le righe siano state inserite.

## 3. Variabili d’ambiente

Copia `.env.example` in `.env` e compila:

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=xxxx
ADMIN_PASSWORD=admin00!
```

Su Vercel (o altro host) imposta le stesse variabili in **Settings → Environment Variables**.

## 4. Auth (email/password e Google)

- **Registrazione / accesso**: da `/auth/signup` e `/auth/login` (email+password oppure **Accedi con Google**).
- **Conferma email**: in **Authentication → Providers → Email** puoi disattivare “Confirm email” per sviluppo.
- **Redirect**: dopo il login l’utente viene reindirizzato alla home; la callback è `/auth/callback`.

### Login con Google (email universitarie @studenti.unito.it ecc.)

1. In [Google Cloud Console](https://console.cloud.google.com/) crea un progetto (o usane uno esistente).
2. **API e servizi → Credenziali → Crea credenziali → ID client OAuth 2.0**:
   - Tipo: **Applicazione Web**.
   - URI di reindirizzamento autorizzati:  
     `https://<TUO_PROJECT_REF>.supabase.co/auth/v1/callback`  
     (in sviluppo aggiungi anche `http://localhost:4321/auth/callback` se usi Supabase locale).
3. Copia **ID client** e **Segreto client**.
4. In Supabase: **Authentication → Providers → Google** → attiva e incolla ID e Segreto, poi salva.

Dopo il login con Google, nome, cognome e avatar vengono presi in automatico e mostrati in header e nel form prenotazione.

## 5. Ruolo admin

Lo stesso pannello admin usa la password `ADMIN_PASSWORD` (login con token `admin_xxx`). Per usare Supabase anche per gli admin:

1. Dopo la registrazione, in Supabase **Table Editor → profiles** imposta `ruolo = 'admin'` per l’utente desiderato.
2. In futuro si può sostituire il login admin con un controllo su `profiles.ruolo`.
