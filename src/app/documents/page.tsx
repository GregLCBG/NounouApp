import { Suspense } from "react";
import { EnTete } from "@/components/EnTete";
import { profilConnecte } from "@/lib/profil";
import { supabaseServeur } from "@/lib/supabase/server";
import { Supprimer } from "./Supprimer";
import { Televersement } from "./Televersement";

type LigneDocument = {
  id: number;
  type: "contrat" | "bulletin" | "autre";
  mois: string | null;
  titre: string;
  chemin: string;
  created_at: string;
  salarie: { prenom: string } | null;
};

const LIBELLES_TYPE = { contrat: "Contrat", bulletin: "Bulletin de paie", autre: "Autre" } as const;

export default function Documents() {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <EnTete actif="/documents" />
      <Suspense fallback={<p className="text-neutral-500">Chargement des documents…</p>}>
        <ListeDocuments />
      </Suspense>
    </main>
  );
}

async function ListeDocuments() {
  const profil = await profilConnecte();
  if (!profil) return <p className="text-neutral-500">Ton compte n&apos;a pas encore accès à l&apos;app.</p>;

  const supabase = await supabaseServeur();
  const [{ data: documents, error }, { data: nounous }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, type, mois, titre, chemin, created_at, salarie:profils!documents_salarie_id_fkey(prenom)")
      .order("mois", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false }),
    supabase.from("profils").select("id, prenom").eq("role", "nounou").order("prenom"),
  ]);
  if (error) return <p className="text-red-600">Lecture des documents impossible.</p>;

  const docs = (documents ?? []) as unknown as LigneDocument[];
  // Liens de téléchargement temporaires (1 h), signés sous l'identité de la personne connectée.
  const { data: liens } = docs.length
    ? await supabase.storage.from("documents").createSignedUrls(docs.map((d) => d.chemin), 3600)
    : { data: [] };
  const lienPour = new Map((liens ?? []).map((l) => [l.path, l.signedUrl]));

  const groupes = new Map<string, LigneDocument[]>();
  for (const d of docs) {
    const cle = d.salarie?.prenom ?? "Famille (visible des parents uniquement)";
    groupes.set(cle, [...(groupes.get(cle) ?? []), d]);
  }

  return (
    <>
      {profil.role === "parent" && <Televersement nounous={nounous ?? []} />}

      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Aucun document pour l&apos;instant.
        </p>
      ) : (
        [...groupes].map(([groupe, liste]) => (
          <section key={groupe} className="mb-6">
            {profil.role === "parent" && <h2 className="mb-2 font-medium">{groupe}</h2>}
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
              {liste.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <a href={lienPour.get(d.chemin) ?? "#"} target="_blank" rel="noopener" className="block truncate font-medium underline-offset-2 hover:underline">
                      {d.titre}
                    </a>
                    <span className="text-xs text-neutral-500">
                      {LIBELLES_TYPE[d.type]}
                      {d.mois && ` · ${new Date(`${d.mois}T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })}`}
                    </span>
                  </div>
                  {profil.role === "parent" && <Supprimer id={d.id} chemin={d.chemin} titre={d.titre} />}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
