import type { JourSemaine } from "./dates";

export type Plage = { debut: string; fin: string }; // "HH:MM"

/** Une version du contrat. Les avenants créent une nouvelle version avec une date d'effet. */
export type Contrat = {
  dateEffet: string; // YYYY-MM-DD
  tauxHoraireBrutCentimes: number;
  tauxHoraireNetCentimes: number;
  /** 52 = mensualisation sur l'année complète (cas normal en garde à domicile). */
  semainesPayeesParAn: number;
  planningHebdo: Partial<Record<JourSemaine, Plage[]>>;
};

/**
 * Pourquoi la présence réelle d'un jour diffère du contrat.
 * Un écart négatif sans motif bloque la clôture du mois.
 */
export type Motif =
  | "absence_parents" // vacances / annulation du fait des parents → payé
  | "jour_ferie_chome" // férié non travaillé → payé (conditions à vérifier, cf. CLAUDE.md)
  | "conge_paye" // congé payé de la salariée → payé, décompté du solde
  | "maladie" // absence salariée (IJ CPAM) → déduit
  | "absence_non_remuneree"; // absence salariée autorisée sans solde → déduit

export const MOTIFS_DEDUITS: ReadonlySet<Motif> = new Set(["maladie", "absence_non_remuneree"]);

export type JourPresence = {
  jour: string; // YYYY-MM-DD
  minutesPrevues: number;
  minutesReelles: number;
  motif?: Motif;
  ferie?: string;
};

export type RecapMois = {
  mois: string; // YYYY-MM
  minutesHebdoContrat: number;
  /** Heures mensualisées, en minutes (peut être fractionnaire : 13 h × 52 / 12). */
  minutesMensualisees: number;
  minutesComplementaires: number;
  minutesDeduites: number;
  minutesPayees: number;
  joursActivite: number;
  joursCongesPris: number;
  salaireBrutCentimes: number;
  salaireNetCentimes: number;
  /** Écarts négatifs sans motif : la clôture est impossible tant qu'il en reste. */
  joursNonQualifies: string[];
  alertes: string[];
};
