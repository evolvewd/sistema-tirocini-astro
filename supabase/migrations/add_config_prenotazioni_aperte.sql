-- Migrazione: flag prenotazioni aperte/chiuse (eseguire in SQL Editor se la tabella config non esiste)
-- Tabella config: solo il backend (service role) può leggere/scrivere

CREATE TABLE IF NOT EXISTS public.config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  prenotazioni_aperte BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO public.config (id, prenotazioni_aperte) VALUES ('main', false)
  ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
