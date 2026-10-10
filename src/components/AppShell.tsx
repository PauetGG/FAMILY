"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CookingPot, ShoppingBasket, Receipt, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Calendari", icon: CalendarDays },
  { href: "/plats", label: "Plats", icon: CookingPot },
  { href: "/compra", label: "Compra", icon: ShoppingBasket },
  { href: "/tiquets", label: "Tiquets", icon: Receipt },
  { href: "/grup", label: "Grup", icon: Users },
];

function isActive(path: string | null, href: string) {
  if (path === null) return false;
  return href === "/" ? path === "/" : path.startsWith(href);
}

// La ruta activa només es coneix al navegador; mentrestant es mostra el menú sense marcar
function SideLinks({ path }: { path: string | null }) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col xl:flex-row items-center gap-1 xl:gap-3 rounded-xl px-2 xl:px-4 py-3 text-sm xl:text-base font-bold transition-colors ${
              active ? "bg-paper text-ink" : "text-paper/80 hover:text-paper hover:bg-white/10"
            }`}
          >
            <Icon size={22} strokeWidth={2.25} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );
}

function BottomLinks({ path }: { path: string | null }) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 h-[68px] text-[0.72rem] font-bold ${
                active ? "text-paper" : "text-paper/65"
              }`}
            >
              <span className={`flex items-center justify-center w-12 h-8 rounded-full ${active ? "bg-paper text-ink" : ""}`}>
                <Icon size={21} strokeWidth={2.25} aria-hidden />
              </span>
              {label}
            </Link>
          </li>
        );
      })}
    </>
  );
}

function ActiveSideLinks() {
  return <SideLinks path={usePathname()} />;
}

function ActiveBottomLinks() {
  return <BottomLinks path={usePathname()} />;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral: iPad i ordinador */}
      <aside className="hidden md:flex md:flex-col md:w-24 xl:w-64 shrink-0 bg-ink text-paper sticky top-0 h-dvh">
        <Link href="/" className="block px-3 xl:px-6 pt-7 pb-8" aria-label="Family Love Food, inici">
          <span className="hidden xl:block font-display font-extrabold text-[2.6rem] leading-[0.88] tracking-[-0.04em]">
            Family
            <br />
            Love
            <br />
            Food
          </span>
          <span className="xl:hidden block text-center font-display font-extrabold text-2xl leading-none tracking-[-0.04em]">
            FLF
          </span>
        </Link>
        <nav className="flex flex-col gap-1 px-2 xl:px-3">
          <Suspense fallback={<SideLinks path={null} />}>
            <ActiveSideLinks />
          </Suspense>
        </nav>
      </aside>

      {/* Capçalera: mòbil */}
      <header className="md:hidden sticky top-0 z-20 bg-ink text-paper pt-[env(safe-area-inset-top)]">
        <div className="px-4 h-14 flex items-center">
          <span className="font-display font-extrabold text-xl tracking-[-0.03em]">Family Love Food</span>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-10">{children}</div>
      </main>

      {/* Menú inferior: mòbil */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-ink text-paper pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegació principal"
      >
        <ul className="grid grid-cols-5">
          <Suspense fallback={<BottomLinks path={null} />}>
            <ActiveBottomLinks />
          </Suspense>
        </ul>
      </nav>
    </div>
  );
}
