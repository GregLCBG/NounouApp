// Helpers de dates en "jours calendaires" (chaînes YYYY-MM-DD), toujours interprétés
// en heure de Paris. On évite les objets Date pour les jours afin de ne jamais
// dépendre du fuseau de la machine (Vercel tourne en UTC).

export const FUSEAU = "Europe/Paris";

/** 1 = lundi … 7 = dimanche (ISO). */
export type JourSemaine = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const formatParis = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Jour calendaire (YYYY-MM-DD) à Paris d'un instant donné. */
export function jourParis(instant: Date): string {
  return formatParis.format(instant);
}

function versUTC(jour: string): Date {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

function depuisUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(jour: string, n: number): string {
  const d = versUTC(jour);
  d.setUTCDate(d.getUTCDate() + n);
  return depuisUTC(d);
}

export function jourSemaine(jour: string): JourSemaine {
  const js = versUTC(jour).getUTCDay(); // 0 = dimanche
  return (js === 0 ? 7 : js) as JourSemaine;
}

/** Lundi de la semaine contenant ce jour. */
export function lundiDe(jour: string): string {
  return ajouterJours(jour, 1 - jourSemaine(jour));
}

/** Tous les jours d'un mois "YYYY-MM". */
export function joursDuMois(mois: string): string[] {
  const premier = `${mois}-01`;
  const jours: string[] = [];
  for (let j = premier; j.startsWith(mois); j = ajouterJours(j, 1)) jours.push(j);
  return jours;
}

/** "HH:MM" → minutes depuis minuit. */
export function minutesDepuisMinuit(heure: string): number {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}
