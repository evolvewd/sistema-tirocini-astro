/**
 * Tipi generati per il database Supabase (allineati a schema.sql)
 */
export interface Slot {
  id: number;
  nome: string;
  posti_totali: number;
  created_at?: string;
}

export interface Prenotazione {
  id: string;
  user_id: string | null;
  data_prenotazione: string;
  email: string;
  cognome: string;
  nome: string;
  anno_corso: string;
  modalita: string;
  numero_tirocinio: string;
  mese: string;
  slot_assegnato: number;
  ore_recupero: string;
  qta_ore: string | null;
  note: string | null;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  nome: string | null;
  cognome: string | null;
  avatar_url: string | null;
  ruolo: "studente" | "admin";
  created_at?: string;
  updated_at?: string;
}

/** Formato usato dalle API legacy (camelCase) per compatibilità frontend */
export interface PrenotazioneLegacy {
  id: string;
  dataPrenotazione: string;
  email: string;
  cognome: string;
  nome: string;
  annoCorso: string;
  modalita: string;
  numeroTirocinio: string;
  mese: string;
  slotAssegnato: string | number;
  oreRecupero: string;
  qtaOre: string;
  note: string;
}
