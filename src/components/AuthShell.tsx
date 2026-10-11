// Marc de les pantalles d'entrar, crear compte i canviar la contrasenya
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-ink text-paper flex flex-col justify-between px-6 sm:px-10 lg:px-16 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-10 lg:py-16">
        <h1 className="font-display font-extrabold text-[clamp(3.4rem,13vw,8.5rem)] leading-[0.86] tracking-[-0.045em]">
          Family
          <br />
          Loves
          <br />
          Food
        </h1>
        <p className="mt-8 max-w-sm text-lg text-paper/85">
          El menú de la setmana, la llista de la compra i els tiquets de casa, en un sol lloc.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 sm:px-10 py-10">{children}</section>
    </div>
  );
}
