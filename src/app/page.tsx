import { Suspense } from "react";
import { chargerMois } from "@/lib/donnees";
import { euros, heures, jourLong } from "@/lib/format";
import { jourParis } from "@/lib/paie/dates";

const LIBELLES_MOTIF: Record<string, string> = {
  absence_parents: "Absence du fait des parents",
  jour_ferie_chome: "Férié chômé",
  conge_paye: "Congé payé",
  maladie: "Maladie",
  absence_non_remuneree: "Absence non rémunérée",
};

export default function Accueil({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-semibold">Garde de Blanche</h1>
      <Suspense fallback={<p className="text-neutral-500">Chargement de l&apos;agenda…</p>}>
        <Mois searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Mois({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { mois: moisParam } = await searchParams;
  const mois = typeof moisParam === "string" && /^\d{4}-\d{2}$/.test(moisParam) ? moisParam : jourParis(new Date()).slice(0, 7);
  const vue = await chargerMois(mois);

  return (
    <>
      <p className="mb-6 text-neutral-500">
        {new Date(`${mois}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
      </p>

      {!vue.ok ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {vue.erreur}
        </p>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tuile titre="Heures payées" valeur={heures(vue.recap.minutesPayees)} />
            <Tuile titre="Dont en plus" valeur={heures(vue.recap.minutesComplementaires)} />
            <Tuile titre="Salaire brut" valeur={euros(vue.recap.salaireBrutCentimes)} />
            <Tuile titre="Salaire net" valeur={euros(vue.recap.salaireNetCentimes)} />
          </section>

          {[...vue.recap.alertes, ...vue.alertesAgenda].map((a) => (
            <p key={a} className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">⚠️ {a}</p>
          ))}

          <h2 className="mb-2 font-medium">Écarts avec le contrat</h2>
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {vue.jours
              .filter((j) => j.minutesReelles !== j.minutesPrevues)
              .map((j) => (
                <li key={j.jour} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="capitalize">{jourLong(j.jour)}</span>
                  <span className="tabular-nums">
                    {heures(j.minutesReelles)} / {heures(j.minutesPrevues)}
                  </span>
                  <span className={j.motif || j.minutesReelles > j.minutesPrevues ? "text-neutral-500" : "font-medium text-red-600"}>
                    {j.minutesReelles > j.minutesPrevues ? "Heures en plus" : j.motif ? LIBELLES_MOTIF[j.motif] : "À qualifier"}
                  </span>
                </li>
              ))}
            {vue.jours.every((j) => j.minutesReelles === j.minutesPrevues) && (
              <li className="p-3 text-sm text-neutral-500">Aucun écart : le mois suit le contrat.</li>
            )}
          </ul>
        </>
      )}
    </>
  );
}

function Tuile({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs text-neutral-500">{titre}</div>
      <div className="text-lg font-semibold tabular-nums">{valeur}</div>
    </div>
  );
}
