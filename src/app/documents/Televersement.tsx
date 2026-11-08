"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseNavigateur } from "@/lib/supabase/client";

const TYPES_ACCEPTES = "application/pdf,image/jpeg,image/png";
const TAILLE_MAX = 10 * 1024 * 1024;

export function Televersement({ nounous }: { nounous: { id: string; prenom: string }[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState<{ envoi: boolean; erreur?: string }>({ envoi: false });

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const donnees = new FormData(form);
    const fichier = donnees.get("fichier") as File | null;
    const type = String(donnees.get("type"));
    const mois = String(donnees.get("mois") || "");
    const salarie = String(donnees.get("salarie") || "");
    const titre = String(donnees.get("titre") || "").trim() || fichier?.name || "Document";

    if (!fichier || fichier.size === 0) return setEtat({ envoi: false, erreur: "Choisis un fichier." });
    if (fichier.size > TAILLE_MAX) return setEtat({ envoi: false, erreur: "Fichier trop lourd (10 Mo max)." });
    if (type === "bulletin" && !mois) return setEtat({ envoi: false, erreur: "Indique le mois du bulletin." });

    setEtat({ envoi: true });
    const supabase = supabaseNavigateur();
    const { data: session } = await supabase.auth.getClaims();
    const extension = fichier.name.includes(".") ? fichier.name.split(".").pop()!.toLowerCase() : "pdf";
    const chemin = `${salarie || "famille"}/${crypto.randomUUID()}.${extension}`;

    const { error: errFichier } = await supabase.storage
      .from("documents")
      .upload(chemin, fichier, { contentType: fichier.type });
    if (errFichier) return setEtat({ envoi: false, erreur: "Envoi du fichier impossible (format accepté : PDF, JPG, PNG)." });

    const { error: errLigne } = await supabase.from("documents").insert({
      salarie_id: salarie || null,
      type,
      mois: mois ? `${mois}-01` : null,
      titre,
      chemin,
      ajoute_par: session?.claims.sub,
    });
    if (errLigne) {
      await supabase.storage.from("documents").remove([chemin]);
      return setEtat({ envoi: false, erreur: "Enregistrement impossible." });
    }

    form.reset();
    setEtat({ envoi: false });
    setOuvert(false);
    router.refresh();
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="mb-6 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-neutral-900"
      >
        + Ajouter un document
      </button>
    );
  }

  const champ = "rounded-lg border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";
  return (
    <form onSubmit={envoyer} className="mb-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <label className="grid gap-1 text-sm">
        Fichier (PDF, JPG ou PNG, 10 Mo max)
        <input name="fichier" type="file" accept={TYPES_ACCEPTES} required className="text-sm" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Pour qui
          <select name="salarie" className={champ} defaultValue={nounous[0]?.id ?? ""}>
            {nounous.map((n) => (
              <option key={n.id} value={n.id}>{n.prenom}</option>
            ))}
            <option value="">Famille (parents uniquement)</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Type
          <select name="type" className={champ} defaultValue="bulletin">
            <option value="bulletin">Bulletin de paie</option>
            <option value="contrat">Contrat</option>
            <option value="autre">Autre</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Mois (obligatoire pour un bulletin)
          <input name="mois" type="month" className={champ} />
        </label>
        <label className="grid gap-1 text-sm">
          Titre (facultatif)
          <input name="titre" type="text" maxLength={200} placeholder="Nom du fichier par défaut" className={champ} />
        </label>
      </div>
      {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={etat.envoi} className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {etat.envoi ? "Envoi…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-3 py-2 text-sm text-neutral-600 dark:text-neutral-400">
          Annuler
        </button>
      </div>
    </form>
  );
}
