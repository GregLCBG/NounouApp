import { joursDuMois, jourSemaine, lundiDe, minutesDepuisMinuit } from "./dates";
import { nomFerie } from "./feries";
import { MOTIFS_DEDUITS, type Contrat, type JourPresence, type RecapMois } from "./types";

const SEUIL_HEURES_SUP_MINUTES = 40 * 60;

export function minutesPrevuesLe(contrat: Contrat, jour: string): number {
  const plages = contrat.planningHebdo[jourSemaine(jour)] ?? [];
  return plages.reduce((t, p) => t + minutesDepuisMinuit(p.fin) - minutesDepuisMinuit(p.debut), 0);
}

export function minutesHebdo(contrat: Contrat): number {
  return Object.values(contrat.planningHebdo)
    .flat()
    .reduce((t, p) => t + minutesDepuisMinuit(p!.fin) - minutesDepuisMinuit(p!.debut), 0);
}

/**
 * Choisit la version du contrat en vigueur au 1er du mois ; à défaut, le contrat qui
 * démarre dans le mois (mois d'embauche, payé au prorata dans calculerMois).
 */
export function contratPourMois(contrats: Contrat[], mois: string): Contrat | undefined {
  const premier = `${mois}-01`;
  const tries = [...contrats].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  return tries.filter((c) => c.dateEffet <= premier).at(-1) ?? tries.find((c) => c.dateEffet.startsWith(mois));
}

/**
 * Construit les jours du mois en croisant le contrat et la présence réelle
 * (minutes réelles par jour, issues de l'agenda) et les motifs saisis.
 */
export function construireJours(
  contrat: Contrat,
  mois: string,
  minutesReelles: Record<string, number>,
  motifs: Record<string, JourPresence["motif"]>,
): JourPresence[] {
  return joursDuMois(mois).map((jour) => {
    // Avant la date d'effet (mois d'embauche), rien n'est prévu.
    const minutesPrevues = jour < contrat.dateEffet ? 0 : minutesPrevuesLe(contrat, jour);
    const ferie = nomFerie(jour);
    let motif = motifs[jour];
    const reelles = minutesReelles[jour] ?? 0;
    // Pré-qualification : un férié prévu et non travaillé est un férié chômé.
    if (!motif && ferie && minutesPrevues > 0 && reelles < minutesPrevues) motif = "jour_ferie_chome";
    return { jour, minutesPrevues, minutesReelles: reelles, motif, ferie };
  });
}

/**
 * Calcule le récap de paie d'un mois.
 * Règles : mensualisation (heures hebdo × semaines / 12), heures en plus payées au
 * taux normal, déduction des absences de la salariée au prorata des heures prévues
 * du mois (méthode des heures réelles — à valider, cf. CLAUDE.md).
 */
export function calculerMois(contrat: Contrat, mois: string, jours: JourPresence[]): RecapMois {
  const alertes: string[] = [];
  const hebdo = minutesHebdo(contrat);
  const minutesMensualisees = (hebdo * contrat.semainesPayeesParAn) / 12;

  let minutesComplementaires = 0;
  let minutesAbsenceDeduite = 0;
  let minutesPrevuesMois = 0;
  let joursActivite = 0;
  let joursCongesPris = 0;
  const joursNonQualifies: string[] = [];
  const reellesParSemaine = new Map<string, number>();

  for (const j of jours) {
    minutesPrevuesMois += j.minutesPrevues;
    if (j.minutesReelles > 0) joursActivite++;
    const lundi = lundiDe(j.jour);
    reellesParSemaine.set(lundi, (reellesParSemaine.get(lundi) ?? 0) + j.minutesReelles);

    const ecart = j.minutesReelles - j.minutesPrevues;
    if (ecart > 0) {
      minutesComplementaires += ecart;
    } else if (ecart < 0) {
      if (!j.motif) joursNonQualifies.push(j.jour);
      else if (MOTIFS_DEDUITS.has(j.motif)) minutesAbsenceDeduite += -ecart;
      else if (j.motif === "conge_paye") joursCongesPris++;
    }
  }

  for (const [lundi, minutes] of reellesParSemaine) {
    if (minutes > SEUIL_HEURES_SUP_MINUTES) {
      alertes.push(
        `Semaine du ${lundi} : plus de 40 h travaillées. Heures majorées non gérées par l'app, à traiter à la main.`,
      );
    }
  }

  // Mois d'embauche : prorata des heures prévues à partir de la date d'effet sur les heures
  // prévues du mois complet (même méthode des heures réelles que les absences — à valider).
  const minutesPrevuesMoisComplet = joursDuMois(mois).reduce((t, j) => t + minutesPrevuesLe(contrat, j), 0);
  const embaucheDansLeMois = contrat.dateEffet.startsWith(mois) && contrat.dateEffet > `${mois}-01`;
  const partTravaillee =
    embaucheDansLeMois && minutesPrevuesMoisComplet > 0 ? minutesPrevuesMois / minutesPrevuesMoisComplet : 1;
  if (embaucheDansLeMois) {
    alertes.push(`Mois d'embauche (début le ${contrat.dateEffet}) : salaire mensualisé payé au prorata des heures prévues.`);
  }

  const salaireMensualiseBrut = (minutesMensualisees * partTravaillee * contrat.tauxHoraireBrutCentimes) / 60;
  const salaireMensualiseNet = (minutesMensualisees * partTravaillee * contrat.tauxHoraireNetCentimes) / 60;
  const partDeduite = minutesPrevuesMois > 0 ? minutesAbsenceDeduite / minutesPrevuesMois : 0;
  // Exprimée en minutes pour le récap : part du temps mensualisé retirée (prorata d'embauche compris).
  const minutesDeduites = minutesMensualisees * (1 - partTravaillee * (1 - partDeduite));

  const brut =
    salaireMensualiseBrut * (1 - partDeduite) + (minutesComplementaires * contrat.tauxHoraireBrutCentimes) / 60;
  const net =
    salaireMensualiseNet * (1 - partDeduite) + (minutesComplementaires * contrat.tauxHoraireNetCentimes) / 60;

  return {
    mois,
    minutesHebdoContrat: hebdo,
    minutesMensualisees,
    minutesComplementaires,
    minutesDeduites,
    minutesPayees: minutesMensualisees - minutesDeduites + minutesComplementaires,
    joursActivite,
    joursCongesPris,
    salaireBrutCentimes: Math.round(brut),
    salaireNetCentimes: Math.round(net),
    joursNonQualifies,
    alertes,
  };
}
