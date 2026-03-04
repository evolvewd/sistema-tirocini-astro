-- Schema Supabase per Sistema Prenotazione Tirocini
-- Esegui questo script nel SQL Editor del progetto Supabase (Dashboard → SQL Editor)

-- Estensione UUID se non già presente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella: sedi di tirocinio (slot)
CREATE TABLE IF NOT EXISTS public.slots (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  posti_totali INTEGER NOT NULL CHECK (posti_totali > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella: prenotazioni
CREATE TABLE IF NOT EXISTS public.prenotazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_prenotazione TIMESTAMPTZ DEFAULT now(),
  email TEXT NOT NULL,
  cognome TEXT NOT NULL,
  nome TEXT NOT NULL,
  anno_corso TEXT NOT NULL,
  modalita TEXT NOT NULL,
  numero_tirocinio TEXT NOT NULL,
  mese TEXT NOT NULL,
  slot_assegnato BIGINT NOT NULL REFERENCES public.slots(id) ON DELETE RESTRICT,
  ore_recupero TEXT NOT NULL DEFAULT 'No',
  qta_ore TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Profili utente (estensione auth.users)
-- nome/cognome e avatar_url popolati in automatico da Google OAuth (given_name, family_name, picture)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  nome TEXT,
  cognome TEXT,
  avatar_url TEXT,
  ruolo TEXT DEFAULT 'studente' CHECK (ruolo IN ('studente', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Aggiungi colonne se la tabella esiste già (migrazione soft)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'nome') THEN
    ALTER TABLE public.profiles ADD COLUMN nome TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cognome') THEN
    ALTER TABLE public.profiles ADD COLUMN cognome TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Trigger: crea/aggiorna profilo alla registrazione (email, Google OAuth: nome, cognome, avatar)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_nome TEXT;
  v_cognome TEXT;
  v_avatar TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    TRIM(COALESCE(NEW.raw_user_meta_data->>'given_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'family_name', '')),
    NEW.email
  );
  v_nome := COALESCE(NEW.raw_user_meta_data->>'given_name', split_part(v_full_name, ' ', 1));
  v_cognome := COALESCE(NEW.raw_user_meta_data->>'family_name', NULLIF(TRIM(substring(v_full_name from position(' ' in v_full_name))), ''));
  v_avatar := NEW.raw_user_meta_data->>'picture';

  INSERT INTO public.profiles (id, email, full_name, nome, cognome, avatar_url)
  VALUES (NEW.id, NEW.email, v_full_name, NULLIF(TRIM(v_nome), ''), NULLIF(TRIM(v_cognome), ''), v_avatar);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RLS (Row Level Security)
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prenotazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Slots: lettura pubblica (solo sedi attive), insert/update/delete solo con service role o admin
CREATE POLICY "Slots: lettura pubblica"
  ON public.slots FOR SELECT
  USING (true);

CREATE POLICY "Slots: admin può gestire"
  ON public.slots FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo = 'admin')
  );

-- Prenotazioni: utenti autenticati possono inserire (la propria) e leggere le proprie
CREATE POLICY "Prenotazioni: insert autenticati"
  ON public.prenotazioni FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Prenotazioni: lettura proprie"
  ON public.prenotazioni FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo = 'admin'));

CREATE POLICY "Prenotazioni: admin può tutto"
  ON public.prenotazioni FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND ruolo = 'admin'));

-- Profiles: lettura propria, update propria
CREATE POLICY "Profiles: lettura propria"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Profiles: update propria"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Indici
CREATE INDEX IF NOT EXISTS idx_prenotazioni_user_id ON public.prenotazioni(user_id);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_slot_assegnato ON public.prenotazioni(slot_assegnato);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_email ON public.prenotazioni(email);
