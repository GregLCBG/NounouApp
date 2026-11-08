import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client Supabase côté serveur, au nom de l'utilisateur connecté (RLS appliquée). */
export async function supabaseServeur() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (aEcrire) => {
          try {
            aEcrire.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appel depuis un Server Component : le proxy se charge de rafraîchir la session.
          }
        },
      },
    },
  );
}
