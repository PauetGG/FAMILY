export default function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 lg:mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[2.1rem] sm:text-5xl font-extrabold">{title}</h1>
        {intro && <p className="mt-2 text-lg text-ink/75">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
