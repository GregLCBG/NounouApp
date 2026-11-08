import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServeur } from "@/lib/supabase/server";

// Lien magique reçu par e-mail. Fonctionne même si le lien est ouvert dans un autre
// navigateur que celui de la demande (application mail du téléphone).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const supabase = await supabaseServeur();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
