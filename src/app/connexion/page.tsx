"use client";

import { useState } from "react";
import { supabaseNavigateur } from "@/lib/supabase/client";

export default function Connexion() {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "envoye" | "erreur">("saisie");

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEtat("envoi");
    const { error } = await supabaseNavigateur().auth.signInWithOtp({
      email,
      // Pas de création de compte depuis l'app : les 3 comptes sont créés dans Supabase.
      options: { shouldCreateUser: false },
    });
    setEtat(error ? "erreur" : "envoye");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Garde de Blanche</h1>
      {etat === "envoye" ? (
        <p>📬 Un lien de connexion vient de partir vers <strong>{email}</strong>. Ouvre-le sur cet appareil.</p>
      ) : (
        <form onSubmit={envoyer} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm">Ton adresse e-mail</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={etat === "envoi"}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {etat === "envoi" ? "Envoi…" : "Recevoir mon lien de connexion"}
          </button>
          {etat === "erreur" && <p className="text-sm text-red-600">Adresse inconnue ou erreur d&apos;envoi.</p>}
        </form>
      )}
    </main>
  );
}
