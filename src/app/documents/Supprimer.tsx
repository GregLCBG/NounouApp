"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseNavigateur } from "@/lib/supabase/client";

export function Supprimer({ id, chemin, titre }: { id: number; chemin: string; titre: string }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  async function supprimer() {
    if (!confirm(`Supprimer « ${titre} » ? C'est définitif.`)) return;
    setEnCours(true);
    const supabase = supabaseNavigateur();
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (!error) await supabase.storage.from("documents").remove([chemin]);
    setEnCours(false);
    if (error) alert("Suppression impossible.");
    else router.refresh();
  }

  return (
    <button onClick={supprimer} disabled={enCours} className="shrink-0 text-xs text-neutral-500 hover:text-red-600 disabled:opacity-50">
      Supprimer
    </button>
  );
}
