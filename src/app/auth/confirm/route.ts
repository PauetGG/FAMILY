import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

// L'enllaç del correu de confirmació porta aquí:
//   /auth/confirm?token_hash=...&type=email
// Es confirma el compte i es torna a la pantalla d'entrar amb un missatge.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;

  const login = new URL("/login", request.url);

  if (!tokenHash) {
    login.searchParams.set("avis", "enllac");
    return NextResponse.redirect(login);
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    login.searchParams.set("avis", "enllac");
    return NextResponse.redirect(login);
  }

  // Restablir la contrasenya: es queda la sessió temporal per poder triar-ne una de nova
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/nova-contrasenya", request.url));
  }

  // Confirmació del compte: volem que la persona entri ella mateixa amb el correu i la contrasenya
  await sb.auth.signOut();
  login.searchParams.set("avis", "confirmat");
  return NextResponse.redirect(login);
}