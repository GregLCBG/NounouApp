import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PAGES_PUBLIQUES = ["/connexion", "/auth/"];

/** Rafraîchit la session Supabase et renvoie vers /connexion si personne n'est connecté. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (aEcrire) => {
          aEcrire.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          aEcrire.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const publique = PAGES_PUBLIQUES.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data?.claims && !publique) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
