import { chargerAgenda, presencesDuMois } from "./agenda/presences";
import { calculerMois, construireJours, contratPourMois } from "./paie/calcul";
import type { Contrat, JourPresence, Motif, RecapMois } from "./paie/types";
import { supabaseServeur } from "./supabase/server";

type LigneContrat = {
  date_effet: string;
  taux_horaire_brut_centimes: number;
  taux_horaire_net_centimes: number;
  semaines_payees_par_an: number;
  planning_hebdo: Contrat["planningHebdo"];
};

export type VueMois =
  | { ok: true; recap: RecapMois; jours: JourPresence[]; alertesAgenda: string[] }
  | { ok: false; erreur: string };

/** Assemble contrat (Supabase) + agenda (Google) + motifs (Supabase) → récap du mois. */
export async function chargerMois(mois: string): Promise<VueMois> {
  const supabase = await supabaseServeur();
  const [{ data: lignes, error: errContrats }, { data: motifs, error: errMotifs }] = await Promise.all([
    supabase.from("contrats").select("*"),
    supabase.from("motifs_jour").select("jour, motif").gte("jour", `${mois}-01`).lte("jour", `${mois}-31`),
  ]);
  if (errContrats || errMotifs) return { ok: false, erreur: "Lecture de la base impossible." };

  const contrats: Contrat[] = (lignes as LigneContrat[]).map((l) => ({
    dateEffet: l.date_effet,
    tauxHoraireBrutCentimes: l.taux_horaire_brut_centimes,
    tauxHoraireNetCentimes: l.taux_horaire_net_centimes,
    semainesPayeesParAn: l.semaines_payees_par_an,
    planningHebdo: l.planning_hebdo,
  }));
  const contrat = contratPourMois(contrats, mois);
  if (!contrat) return { ok: false, erreur: `Aucun contrat en vigueur au 1er ${mois}.` };

  let presences;
  try {
    presences = presencesDuMois(await chargerAgenda(), mois);
  } catch (e) {
    return { ok: false, erreur: (e as Error).message };
  }

  const motifsParJour = Object.fromEntries((motifs ?? []).map((m) => [m.jour, m.motif as Motif]));
  const jours = construireJours(contrat, mois, presences.minutesParJour, motifsParJour);
  return { ok: true, recap: calculerMois(contrat, mois, jours), jours, alertesAgenda: presences.alertes };
}
