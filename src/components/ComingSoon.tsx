import PageHeader from "./PageHeader";

export default function ComingSoon({ title, intro, steps }: { title: string; intro: string; steps: string[] }) {
  return (
    <>
      <PageHeader title={title} intro={intro} />
      <section className="panel p-5 sm:p-6 max-w-2xl">
        <h2 className="text-2xl font-extrabold">Com funcionarà</h2>
        <ol className="mt-3 space-y-2 list-decimal pl-5 marker:font-bold marker:text-brown">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-5 font-bold text-brown">És la propera pantalla que construirem.</p>
      </section>
    </>
  );
}
