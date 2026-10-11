"use client";

import { DAY_SHORT, dayLabel, monthGrid, toKey } from "@/lib/dates";
import type { CalendarPerson, DietEntry } from "@/lib/types";
import type { UserMeal } from "@/lib/meals";

// Mes sencer: a cada dia, el nom de cada persona.
// Marró: té tots els àpats posats. Marró clar: en té algun. Gris: no en té cap.

type Status = "full" | "some" | "none";

const PILL: Record<Status, string> = {
  full: "bg-brown text-card",
  some: "bg-tan text-ink",
  none: "border border-ink/25 text-ink/45",
};

const STATUS_TEXT: Record<Status, string> = {
  full: "tots els àpats",
  some: "algun àpat",
  none: "cap àpat",
};
export default function MonthView({
  cursor,
  todayKey,
  people,
  entries,
  meals,
  onOpenDay,
}: {
  cursor: Date;
  todayKey: string;
  people: CalendarPerson[];
  entries: DietEntry[];
  meals: UserMeal[];
  onOpenDay: (date: string) => void;
}) {
  const days = monthGrid(cursor);
  // Quants àpats té cada persona (cadascú pot tenir-ne un nombre diferent)
  const mealCount = new Map<string, number>();
  for (const m of meals) mealCount.set(m.user_id, (mealCount.get(m.user_id) ?? 0) + 1);
  // Quants àpats diferents té posats cada persona cada dia
  const filled = new Map<string, Set<string>>();
  for (const e of entries) {
    const k = `${e.date}|${e.user_id}`;
    if (!filled.has(k)) filled.set(k, new Set());
    filled.get(k)!.add(e.meal_id);
  }
  const status = (date: string, userId: string): Status => {
    const n = filled.get(`${date}|${userId}`)?.size ?? 0;
    const total = mealCount.get(userId) ?? 0;
    return total > 0 && n >= total ? "full" : n > 0 ? "some" : "none";
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
        {DAY_SHORT.map((d) => (
          <div key={d} className="text-center text-xs sm:text-sm font-bold text-ink/70 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((d) => {
          const key = toKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => onOpenDay(key)}
              aria-label={`${dayLabel(d)}. ${people.map((p) => `${p.name}: ${STATUS_TEXT[status(key, p.id)]}`).join(", ")}`}
              className={`flex flex-col items-stretch text-left rounded-lg sm:rounded-xl border-2 p-1 sm:p-2 min-h-[4.5rem] sm:min-h-24 lg:min-h-28 ${
                isToday ? "border-brown bg-card" : "border-line bg-card hover:border-ink"
              } ${inMonth ? "" : "opacity-45"}`}
            >
              <span
                className={`self-start font-display font-extrabold leading-none text-lg sm:text-2xl ${
                  isToday ? "bg-brown text-card rounded-md px-1.5 py-0.5" : ""
                }`}
              >
                {d.getDate()}
              </span>

              {/* Mòbil: inicials */}
              <span className="mt-auto flex flex-wrap gap-0.5 sm:hidden">
                {people.map((p) => {
                  return (
                    <span
                      key={p.id}
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold ${PILL[status(key, p.id)]}`}
                      aria-hidden
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  );
                })}
              </span>

              {/* iPad i ordinador: noms */}
              <span className="mt-auto hidden sm:flex flex-col gap-1 pt-1.5">
                {people.map((p) => {
                  return (
                    <span
                      key={p.id}
                      className={`truncate rounded-md px-1.5 py-0.5 text-xs lg:text-[0.8rem] font-bold ${PILL[status(key, p.id)]}`}
                      aria-hidden
                    >
                      {p.name}
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-brown" aria-hidden /> Tots els àpats
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-tan" aria-hidden /> Algun àpat
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded border border-ink/30" aria-hidden /> Cap
        </span>
        <span className="text-ink/60">Toca un dia per veure qui ha triat què.</span>
      </p>
    </div>
  );
}
