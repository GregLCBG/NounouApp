import ical, { type CalendarResponse, type VEvent } from "node-ical";
import { ajouterJours, jourParis } from "../paie/dates";

export type Presences = {
  /** Minutes de présence réelle par jour (YYYY-MM-DD, heure de Paris). */
  minutesParJour: Record<string, number>;
  alertes: string[];
};

/**
 * Additionne la durée des événements (non "journée entière") de l'agenda, par jour.
 * Les événements récurrents sont dépliés par node-ical (RRULE, EXDATE, occurrences modifiées).
 */
export function presencesDuMois(calendrier: CalendarResponse, mois: string): Presences {
  // Fenêtre large d'un jour de chaque côté pour ne rien rater à cause du fuseau.
  const debut = new Date(`${ajouterJours(`${mois}-01`, -1)}T00:00:00Z`);
  const moisSuivant = ajouterJours(`${mois}-28`, 4).slice(0, 7);
  const fin = new Date(`${ajouterJours(`${moisSuivant}-01`, 1)}T00:00:00Z`);

  const minutesParJour: Record<string, number> = {};
  const alertes: string[] = [];

  for (const composant of Object.values(calendrier)) {
    if (!composant || composant.type !== "VEVENT") continue;
    const evt = composant as VEvent;
    const instances = ical.expandRecurringEvent(evt, { from: debut, to: fin });
    for (const inst of instances) {
      if (inst.isFullDay) continue; // les journées entières servent de marqueurs, pas d'heures
      const jour = jourParis(inst.start);
      if (!jour.startsWith(mois)) continue;
      if (jourParis(inst.end) !== jour) {
        alertes.push(`Le ${jour} : un événement passe minuit, il est compté sur le jour de début.`);
      }
      const minutes = Math.round((inst.end.getTime() - inst.start.getTime()) / 60000);
      minutesParJour[jour] = (minutesParJour[jour] ?? 0) + minutes;
    }
  }
  return { minutesParJour, alertes };
}

/** Lit l'agenda Google via son adresse secrète iCal (variable d'environnement). */
export async function chargerAgenda(): Promise<CalendarResponse> {
  const url = process.env.GOOGLE_AGENDA_ICAL_URL;
  if (!url) throw new Error("GOOGLE_AGENDA_ICAL_URL n'est pas configurée.");
  const reponse = await fetch(url, { cache: "no-store" });
  if (!reponse.ok) throw new Error(`Agenda Google inaccessible (HTTP ${reponse.status}).`);
  return ical.sync.parseICS(await reponse.text());
}
