import { supabaseServeur } from "./supabase/server";

export type Profil = { id: string; role: "parent" | "nounou"; prenom: string };

/** Profil de la personne connectée, ou null si elle n'a pas (encore) de profil. */
export async function profilConnecte(): Promise<Profil | null> {
  const supabase = await supabaseServeur();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims.sub;
  if (!uid) return null;
  const { data: profil } = await supabase.from("profils").select("id, role, prenom").eq("id", uid).maybeSingle();
  return (profil as Profil | null) ?? null;
}
