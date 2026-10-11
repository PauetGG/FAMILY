"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Minus, Plus, X } from "lucide-react";
import Sheet from "@/components/Sheet";
import { dayLabel, fromKey } from "@/lib/dates";
import { formatQty } from "@/lib/format";
import { MEALS, type CalendarPerson, type DietEntry, type Meal } from "@/lib/types";

export type DishLite = { id: string; name: string };

export type DayActions = {
  people: CalendarPerson[];
  entries: DietEntry[];
  dishes: DishLite[];
  onAdd: (date: string, meal: Meal, userId: string, dishId: string, servings: number) => Promise<void>;
  onRemove: (id: string) => void;
};

// Ingredients del plat ja multiplicats per les racions: "Arròs 80 g, Pit de pollastre 150 g"
export function ingredientText(e: DietEntry): string {
  const s = Number(e.servings) || 1;
  return (e.dishes?.dish_ingredients ?? [])
    .filter((di) => di.ingredients)
    .map((di) => `${di.ingredients!.name}\u00a0${formatQty(Number(di.quantity) * s, di.ingredients!.unit).replace(" ", "\u00a0")}`)
    .join(", ");
}

export function EntryItem({
  entry,
  onRemove,
  small,
}: {
  entry: DietEntry;
  onRemove?: () => void;
  small?: boolean;
}) {
  const ing = ingredientText(entry);
  return (
    <div className={`flex items-start gap-1 ${small ? "text-sm" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug break-words">
          {entry.dishes?.name ?? "Plat esborrat"}
          {Number(entry.servings) !== 1 && <span className="font-normal text-ink/60"> ×{Number(entry.servings)}</span>}
        </p>
        {ing && <p className={`text-ink/60 leading-snug ${small ? "text-xs" : "text-sm"}`}>{ing}</p>}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-ink/50 hover:text-danger hover:bg-danger/10"
          aria-label={`Treu ${entry.dishes?.name ?? "el plat"}`}
        >
          <X size={small ? 14 : 17} aria-hidden />
        </button>
      )}
    </div>
  );
}

// Tot un dia: cada àpat i, a dins, què ha triat cada persona
export function DayDetail({ date, people, entries, dishes, onAdd, onRemove }: DayActions & { date: string }) {
  const [picking, setPicking] = useState<{ meal: Meal; userId: string } | null>(null);
  const dayEntries = entries.filter((e) => e.date === date);

  if (picking) {
    const person = people.find((p) => p.id === picking.userId);
    const meal = MEALS.find((m) => m.key === picking.meal)?.label ?? "";
    return (
      <div>
        <button className="btn btn-ghost -ml-3 mb-2" onClick={() => setPicking(null)}>
          <ChevronLeft size={20} aria-hidden /> Tornar al dia
        </button>
        <h3 className="text-2xl font-extrabold mb-4">
          {meal}
          {people.length > 1 && person && <span className="text-brown">, {person.name}</span>}
        </h3>
        <DishPicker
          dishes={dishes}
          onPick={async (dishId, servings) => {
            await onAdd(date, picking.meal, picking.userId, dishId, servings);
            setPicking(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {MEALS.map((m) => {
        const mealEntries = dayEntries.filter((e) => e.meal === m.key);
        return (
          <section key={m.key} className="rounded-2xl border-2 border-ink bg-card overflow-hidden">
            <h3 className="bg-ink text-paper px-4 py-2 text-lg font-bold">{m.label}</h3>
            <ul className="divide-y-2 divide-line">
              {people.map((p) => {
                const mine = mealEntries.filter((e) => e.user_id === p.id);
                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold ${mine.length ? "text-brown" : "text-ink/50"}`}>{p.name}</span>
                      {p.canEdit && (
                        <button
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold text-brown hover:bg-brown/10"
                          onClick={() => setPicking({ meal: m.key, userId: p.id })}
                          aria-label={`Afegeix plat: ${m.label}, ${p.name}`}
                        >
                          <Plus size={16} aria-hidden /> Afegeix
                        </button>
                      )}
                    </div>
                    {mine.length === 0 ? (
                      <p className="text-sm text-ink/50">Encara no ha triat res</p>
                    ) : (
                      <div className="mt-1 space-y-2">
                        {mine.map((e) => (
                          <EntryItem key={e.id} entry={e} onRemove={p.canEdit ? () => onRemove(e.id) : undefined} />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function DayPopup({ date, onClose, ...rest }: DayActions & { date: string | null; onClose: () => void }) {
  return (
    <Sheet open={date !== null} title={date ? dayLabel(fromKey(date)) : ""} onClose={onClose}>
      {date && <DayDetail key={date} date={date} {...rest} />}
    </Sheet>
  );
}

function DishPicker({ dishes, onPick }: { dishes: DishLite[]; onPick: (id: string, servings: number) => void }) {
  const [q, setQ] = useState("");
  const [servings, setServings] = useState(1);
  const [busy, setBusy] = useState(false);
  const filtered = dishes.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()));

  if (dishes.length === 0) {
    return (
      <div>
        <p>Encara no tens plats. Crea&apos;n un amb els seus ingredients i torna aquí.</p>
        <Link href="/plats" className="btn btn-primary mt-4">
          Ves a plats
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold">Racions</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-outline px-3"
            onClick={() => setServings((s) => Math.max(0.5, s - 0.5))}
            aria-label="Menys racions"
          >
            <Minus size={18} aria-hidden />
          </button>
          <span className="w-12 text-center font-display text-2xl font-bold" aria-live="polite">
            {servings}
          </span>
          <button type="button" className="btn btn-outline px-3" onClick={() => setServings((s) => s + 0.5)} aria-label="Més racions">
            <Plus size={18} aria-hidden />
          </button>
        </div>
      </div>
      <input className="field" placeholder="Busca un plat" aria-label="Busca un plat" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-[45dvh] overflow-y-auto divide-y-2 divide-line border-2 border-line rounded-xl">
        {filtered.map((d) => (
          <li key={d.id}>
            <button
              className="w-full text-left px-4 py-3 font-bold hover:bg-paper disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onPick(d.id, servings);
              }}
            >
              {d.name}
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-4 py-3 text-ink/70">Cap plat coincideix amb la cerca.</li>}
      </ul>
    </div>
  );
}
