import { describe, expect, it } from "vitest";
import { calculerMois, construireJours, contratPourMois, minutesHebdo } from "./calcul";
import type { Contrat } from "./types";

// Contrat actuel : lun/mar/jeu/ven 16h30-18h30, mer 13h30-18h30, 15 € brut.
const contrat: Contrat = {
  dateEffet: "2026-01-01",
  tauxHoraireBrutCentimes: 1500,
  tauxHoraireNetCentimes: 1170,
  semainesPayeesParAn: 52,
  planningHebdo: {
    1: [{ debut: "16:30", fin: "18:30" }],
    2: [{ debut: "16:30", fin: "18:30" }],
    3: [{ debut: "13:30", fin: "18:30" }],
    4: [{ debut: "16:30", fin: "18:30" }],
    5: [{ debut: "16:30", fin: "18:30" }],
  },
};

/** Présence réelle = exactement le contrat, sauf exceptions. */
function presenceConforme(mois: string, exceptions: Record<string, number> = {}) {
  const jours = construireJours(contrat, mois, {}, {});
  const reelles: Record<string, number> = {};
  for (const j of jours) reelles[j.jour] = j.minutesPrevues;
  return { ...reelles, ...exceptions };
}

describe("mensualisation", () => {
  it("13 h par semaine sur 52 semaines = 56,33 h et 845 € brut par mois", () => {
    expect(minutesHebdo(contrat)).toBe(13 * 60);
    const mois = "2026-10"; // pas de férié en octobre
    const recap = calculerMois(contrat, mois, construireJours(contrat, mois, presenceConforme(mois), {}));
    expect(recap.minutesMensualisees / 60).toBeCloseTo(56.333, 3);
    expect(recap.salaireBrutCentimes).toBe(84500);
    expect(recap.minutesComplementaires).toBe(0);
    expect(recap.joursNonQualifies).toEqual([]);
  });

  it("le salaire ne bouge pas quand les parents partent en vacances", () => {
    const mois = "2026-10";
    const reelles = presenceConforme(mois, {
      "2026-10-19": 0,
      "2026-10-20": 0,
      "2026-10-21": 0,
      "2026-10-22": 0,
      "2026-10-23": 0,
    });
    const motifs = Object.fromEntries(
      ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((j) => [j, "absence_parents" as const]),
    );
    const recap = calculerMois(contrat, mois, construireJours(contrat, mois, reelles, motifs));
    expect(recap.salaireBrutCentimes).toBe(84500);
  });
});

describe("écarts", () => {
  const mois = "2026-10";

  it("une absence sans motif bloque la clôture", () => {
    const recap = calculerMois(contrat, mois, construireJours(contrat, mois, presenceConforme(mois, { "2026-10-07": 0 }), {}));
    expect(recap.joursNonQualifies).toEqual(["2026-10-07"]);
  });

  it("une heure en plus est payée au taux normal", () => {
    const reelles = presenceConforme(mois, { "2026-10-05": 180 });
    const recap = calculerMois(contrat, mois, construireJours(contrat, mois, reelles, {}));
    expect(recap.minutesComplementaires).toBe(60);
    expect(recap.salaireBrutCentimes).toBe(84500 + 1500);
  });

  it("une absence maladie est déduite au prorata des heures prévues du mois", () => {
    // Octobre 2026 : 18 jours à 2 h + 4 mercredis à 5 h = 56 h prévues.
    const reelles = presenceConforme(mois, { "2026-10-07": 0 }); // mercredi, 5 h
    const recap = calculerMois(contrat, mois, construireJours(contrat, mois, reelles, { "2026-10-07": "maladie" }));
    expect(recap.salaireBrutCentimes).toBe(Math.round(84500 * (1 - 5 / 56)));
  });

  it("les congés payés sont payés et comptés", () => {
    const reelles = presenceConforme(mois, { "2026-10-05": 0, "2026-10-06": 0 });
    const motifs = { "2026-10-05": "conge_paye" as const, "2026-10-06": "conge_paye" as const };
    const recap = calculerMois(contrat, mois, construireJours(contrat, mois, reelles, motifs));
    expect(recap.salaireBrutCentimes).toBe(84500);
    expect(recap.joursCongesPris).toBe(2);
  });

  it("un férié non travaillé est pré-qualifié automatiquement", () => {
    const novembre = "2026-11"; // mercredi 11 novembre férié
    const reelles = presenceConforme(novembre, { "2026-11-11": 0 });
    const jours = construireJours(contrat, novembre, reelles, {});
    expect(jours.find((j) => j.jour === "2026-11-11")?.motif).toBe("jour_ferie_chome");
    expect(calculerMois(contrat, novembre, jours).joursNonQualifies).toEqual([]);
  });

  it("alerte au-delà de 40 h dans la semaine", () => {
    const reelles = presenceConforme(mois, { "2026-10-05": 12 * 60, "2026-10-06": 12 * 60, "2026-10-07": 12 * 60, "2026-10-08": 12 * 60 });
    const recap = calculerMois(contrat, mois, construireJours(contrat, mois, reelles, {}));
    expect(recap.alertes).toHaveLength(1);
  });
});

describe("mois d'embauche", () => {
  const embauche: Contrat = { ...contrat, dateEffet: "2026-11-16" };

  it("paie au prorata des heures prévues depuis la date d'effet", () => {
    // Novembre 2026 complet : 17 jours à 2 h + 4 mercredis à 5 h = 54 h prévues.
    // À partir du lundi 16 : 2 semaines de 13 h + lundi 30 (2 h) = 28 h.
    const mois = "2026-11";
    expect(contratPourMois([embauche], mois)).toBe(embauche);
    const jours = construireJours(embauche, mois, presenceConforme(mois), {});
    const reelles: Record<string, number> = {};
    for (const j of jours) reelles[j.jour] = j.jour >= "2026-11-16" ? j.minutesPrevues : 0;
    const recap = calculerMois(embauche, mois, construireJours(embauche, mois, reelles, {}));
    expect(recap.joursNonQualifies).toEqual([]);
    expect(recap.salaireBrutCentimes).toBe(Math.round((84500 * 28) / 54));
    expect(recap.minutesPayees / 60).toBeCloseTo((56.333 * 28) / 54, 2);
    expect(recap.alertes.some((a) => a.includes("embauche"))).toBe(true);
  });

  it("le mois suivant est payé en entier", () => {
    const mois = "2026-12";
    const recap = calculerMois(embauche, mois, construireJours(embauche, mois, presenceConforme(mois), {}));
    expect(recap.salaireBrutCentimes).toBe(84500);
    expect(recap.alertes).toEqual([]);
  });
});

describe("versions du contrat", () => {
  it("prend la version en vigueur au 1er du mois", () => {
    const avenant: Contrat = { ...contrat, dateEffet: "2027-09-01", tauxHoraireBrutCentimes: 1600 };
    expect(contratPourMois([contrat, avenant], "2027-08")?.tauxHoraireBrutCentimes).toBe(1500);
    expect(contratPourMois([contrat, avenant], "2027-09")?.tauxHoraireBrutCentimes).toBe(1600);
    expect(contratPourMois([avenant], "2026-10")).toBeUndefined();
  });
});
