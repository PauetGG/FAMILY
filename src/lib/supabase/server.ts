import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client de Supabase per al servidor, amb la sessió de qui fa la petició.
// Així els permisos (RLS) són els mateixos que al navegador.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Des d'una ruta només de lectura no cal desar res; ho fa el proxy.
          }
        },
      },
    },
  );
}
