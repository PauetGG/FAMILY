"use client";

import { addDays, DAY_LONG, toKey } from "@/lib/dates";
import { MEALS, type CalendarPerson, type DietEntry } from "@/lib/types";
import { EntryItem } from "./DayPopup";

// Setmana: cada dia amb els seus àpats i qui ha triat cada plat
export default function WeekView({
  monday,
  todayKey,
  people,
  entries,
  onOpenDay,
}: {
  monday: Date;
  todayKey: string;
  people: CalendarPerson[];
  entries: DietEntry[];
  onOpenDay: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "";
  const several = people.length > 1;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:gap-1.5">
      {days.map((d, i) => {
        const key = toKey(d);
        const isToday = key === todayKey;
        const dayEntries = entries.filter((e) => e.date === key);
        return (
          <div
            key={key}
            onClick={() => onOpenDay(key)}
            className="flex flex-col text-left rounded-xl border-2 border-line bg-card hover:border-ink overflow-hidden cursor-pointer"
          >
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                onOpenDay(key);
              }}
              className={`flex items-baseline gap-2 lg:flex-col lg:gap-0 px-3 py-2 text-left ${isToday ? "bg-brown text-card" : "bg-ink text-paper"}`}
              aria-label={`Obre ${DAY_LONG[i].toLowerCase()} ${d.getDate()}`}
            >
              <span className="text-sm font-bold">{DAY_LONG[i]}</span>
              <span className="font-display text-2xl lg:text-4xl font-extrabold leading-none tracking-[-0.03em]">{d.getDate()}</span>
            </button>
            <div className="flex-1 p-2.5 space-y-2.5 min-h-24">
              {dayEntries.length === 0 && <p className="text-sm text-ink/50">Res planificat</p>}
              {MEALS.map((m) => {
                const items = dayEntries.filter((e) => e.meal === m.key);
                if (!items.length) return null;
                return (
                  <div key={m.key}>
                    <p className="text-xs font-bold text-ink/60">{m.label}</p>
                    <div className="mt-0.5 space-y-1.5">
                      {items.map((e) => (
                        <div key={e.id} className="border-l-4 border-brown pl-2">
                          {several && <p className="text-xs font-bold text-brown">{nameOf(e.user_id)}</p>}
                          <EntryItem entry={e} small />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
