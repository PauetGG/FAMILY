import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sessió de Supabase a cada petició i protegeix les pàgines:
// sense sessió et porta a /login, i amb sessió no et deixa quedar a /login.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await sb.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");

  // Les rutes de l'API i la confirmació del correu funcionen sense sessió
  if (request.nextUrl.pathname.startsWith("/api/") || request.nextUrl.pathname.startsWith("/auth/")) return response;

  if (!user && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};