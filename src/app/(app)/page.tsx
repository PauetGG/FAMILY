"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Minus, Plus, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import { addDays, DAY_LONG, DAY_SHORT, mondayOf, toKey, weekLabel } from "@/lib/dates";
import { MEALS, type DietEntry, type Meal } from "@/lib/types";

type Owner = { id: string; name: string; canEdit: boolean };
type DishLite = { id: string; name: string };

export default function CalendarPage() {
  const { me } = useMe();
  // La data d'avui es llegeix al navegador, no durant la generació de la pàgina
  const [monday, setMonday] = useState<Date | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [todayKey, setTodayKey] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [entries, setEntries] = useState<DietEntry[]>([]);
  const [dishes, setDishes] = useState<DishLite[]>([]);
  const [picker, setPicker] = useState<{ date: string; meal: Meal } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setMonday(mondayOf(now));
    setDayIdx((now.getDay() + 6) % 7);
    setTodayKey(toKey(now));
  }, []);

  const days = useMemo(
    () => (monday ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : []),
    [monday],
  );
  const owner = owners.find((o) => o.id === ownerId);
  const canEdit = owner?.canEdit ?? false;

  // Calendaris que puc veure: el meu i els que m'han compartit
  useEffect(() => {
    if (!me) return;
    (async () => {
      const sb = supabase();
      const [{ data: shares }, { data: ds }] = await Promise.all([
        sb
          .from("diet_shares")
          .select("can_edit, owner:profiles!diet_shares_owner_id_fkey(id, display_name)")
          .eq("shared_with_id", me.id),
        sb.from("dishes").select("id, name").order("name"),
      ]);
      const list: Owner[] = [{ id: me.id, name: "El meu", canEdit: true }];
      (shares ?? []).forEach((s: { can_edit: boolean; owner: { id: string; display_name: string } | null }) => {
        if (s.owner) list.push({ id: s.owner.id, name: s.owner.display_name, canEdit: s.can_edit });
      });
      setOwners(list);
      setOwnerId((cur) => cur ?? me.id);
      setDishes((ds as DishLite[]) ?? []);
    })();
  }, [me]);

  const loadEntries = useCallback(async () => {
    if (!ownerId || !monday) return;
    const { data } = await supabase()
      .from("diet_entries")
      .select("id, user_id, date, meal, dish_id, servings, dishes(id, name)")
      .eq("user_id", ownerId)
      .gte("date", toKey(monday))
      .lte("date", toKey(addDays(monday, 6)))
      .order("created_at");
    setEntries((data as DietEntry[]) ?? []);
  }, [ownerId, monday]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const byCell = useMemo(() => {
    const m = new Map<string, DietEntry[]>();
    entries.forEach((e) => {
      const k = `${e.date}|${e.meal}`;
      m.set(k, [...(m.get(k) ?? []), e]);
    });
    return m;
  }, [entries]);

  async function addEntry(dishId: string, servings: number) {
    if (!picker || !ownerId) return;
    const { error } = await supabase()
      .from("diet_entries")
      .insert({ user_id: ownerId, date: picker.date, meal: picker.meal, dish_id: dishId, servings });
    setPicker(null);
    if (error) setMessage("No s'ha pogut afegir el plat.");
    await loadEntries();
  }

  async function removeEntry(id: string) {
    setEntries((es) => es.filter((e) => e.id !== id));
    await supabase().from("diet_entries").delete().eq("id", id);
  }

  async function copyWeek() {
    if (!ownerId || !monday) return;
    const next = addDays(monday, 7);
    const { data, error } = await supabase().rpc("copy_diet_week", {
      p_from: toKey(monday),
      p_to: toKey(next),
      p_user_id: ownerId,
    });
    if (error) return setMessage("No s'ha pogut copiar la setmana.");
    setMessage(data ? `S'han copiat ${data} plats a la setmana vinent.` : "Aquesta setmana no té cap plat per copiar.");
    if (data) setMonday(next);
  }

  function goWeek(delta: number) {
    setMonday((m) => (m ? addDays(m, delta * 7) : m));
    setMessage(null);
  }

  function goToday() {
    setMonday(mondayOf(new Date()));
    setDayIdx((new Date().getDay() + 6) % 7);
    setMessage(null);
  }

  if (!monday) return <PageHeader title="Calendari" />;

  return (
    <>
      <PageHeader
        title="Calendari"
        actions={
          owners.length > 1 && (
            <select
              className="field w-auto font-bold"
              aria-label="Calendari de"
              value={ownerId ?? ""}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id === me?.id ? "El meu calendari" : `Calendari de ${o.name}`}
                </option>
              ))}
            </select>
          )
        }
      />

      {/* Barra de la setmana */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center">
          <button className="btn btn-ghost" onClick={() => goWeek(-1)} aria-label="Setmana anterior">
            <ChevronLeft size={24} aria-hidden />
          </button>
          <p className="font-display text-xl sm:text-2xl font-bold min-w-[10.5rem] text-center">{weekLabel(monday)}</p>
          <button className="btn btn-ghost" onClick={() => goWeek(1)} aria-label="Setmana següent">
            <ChevronRight size={24} aria-hidden />
          </button>
        </div>
        <button className="btn btn-outline" onClick={goToday}>
          Avui
        </button>
        {canEdit && (
          <button className="btn btn-outline sm:ml-auto" onClick={copyWeek}>
            <Copy size={18} aria-hidden /> Copia a la setmana vinent
          </button>
        )}
      </div>

      {message && (
        <p role="status" className="mb-4 font-bold text-brown">
          {message}
        </p>
      )}

      {/* Mòbil i iPad vertical: un dia cada vegada */}
      <div className="lg:hidden">
        <div className="grid grid-cols-7 gap-1.5 mb-5" role="tablist" aria-label="Dies de la setmana">
          {days.map((d, i) => {
            const key = toKey(d);
            const selected = i === dayIdx;
            const count = entries.filter((e) => e.date === key).length;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={selected}
                onClick={() => setDayIdx(i)}
                className={`flex flex-col items-center rounded-xl py-2 border-2 ${
                  selected ? "bg-ink text-paper border-ink" : "bg-card border-line"
                }`}
              >
                <span className="text-xs font-bold">{DAY_SHORT[i]}</span>
                <span className={`font-display text-2xl font-extrabold leading-tight ${key === todayKey && !selected ? "text-brown underline underline-offset-4" : ""}`}>
                  {d.getDate()}
                </span>
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${count ? (selected ? "bg-paper" : "bg-brown") : "bg-transparent"}`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        <h2 className="text-3xl font-extrabold mb-3">
          {DAY_LONG[dayIdx]} {days[dayIdx].getDate()}
        </h2>
        <div className="space-y-3">
          {MEALS.map((m) => {
            const key = toKey(days[dayIdx]);
            return (
              <section key={m.key} className="panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold">{m.label}</h3>
                  {canEdit && (
                    <button className="btn btn-ghost" onClick={() => setPicker({ date: key, meal: m.key })}>
                      <Plus size={19} aria-hidden /> Afegeix
                    </button>
                  )}
                </div>
                <EntryList
                  items={byCell.get(`${key}|${m.key}`) ?? []}
                  canEdit={canEdit}
                  onRemove={removeEntry}
                  empty="Res planificat"
                />
              </section>
            );
          })}
        </div>
      </div>

      {/* iPad horitzontal i ordinador: tota la setmana */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] gap-1.5">
          <div />
          {days.map((d, i) => {
            const isToday = toKey(d) === todayKey;
            return (
              <div
                key={toKey(d)}
                className={`rounded-t-xl px-3 py-2 ${isToday ? "bg-brown text-card" : "bg-ink text-paper"}`}
              >
                <span className="block text-sm font-bold">{DAY_LONG[i]}</span>
                <span className="block font-display text-4xl font-extrabold leading-none tracking-[-0.03em]">
                  {d.getDate()}
                </span>
              </div>
            );
          })}

          {MEALS.map((m) => (
            <MealRow
              key={m.key}
              label={m.label}
              days={days}
              meal={m.key}
              byCell={byCell}
              canEdit={canEdit}
              onAdd={(date) => setPicker({ date, meal: m.key })}
              onRemove={removeEntry}
            />
          ))}
        </div>
      </div>

      {!canEdit && owner && (
        <p className="mt-6 text-ink/75">Pots veure aquest calendari, però només {owner.name} el pot modificar.</p>
      )}

      <Sheet
        open={picker !== null}
        title={picker ? `${MEALS.find((m) => m.key === picker.meal)?.label}, ${DAY_LONG[(new Date(picker.date + "T00:00").getDay() + 6) % 7].toLowerCase()}` : ""}
        onClose={() => setPicker(null)}
      >
        {picker && <DishPicker dishes={dishes} onPick={addEntry} />}
      </Sheet>
    </>
  );
}

function MealRow({
  label,
  days,
  meal,
  byCell,
  canEdit,
  onAdd,
  onRemove,
}: {
  label: string;
  days: Date[];
  meal: Meal;
  byCell: Map<string, DietEntry[]>;
  canEdit: boolean;
  onAdd: (date: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-start pt-3 font-display text-lg font-bold">{label}</div>
      {days.map((d) => {
        const key = toKey(d);
        const items = byCell.get(`${key}|${meal}`) ?? [];
        return (
          <div key={key} className="bg-card border-2 border-line rounded-lg p-2 min-h-28 flex flex-col">
            <EntryList items={items} canEdit={canEdit} onRemove={onRemove} compact />
            {canEdit && (
              <button
                onClick={() => onAdd(key)}
                className="mt-auto self-start inline-flex items-center justify-center w-8 h-8 rounded-md text-brown hover:bg-brown hover:text-card"
                aria-label={`Afegeix plat: ${label}, ${d.getDate()}`}
                title="Afegeix un plat"
              >
                <Plus size={18} strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

function EntryList({
  items,
  canEdit,
  onRemove,
  empty,
  compact,
}: {
  items: DietEntry[];
  canEdit: boolean;
  onRemove: (id: string) => void;
  empty?: string;
  compact?: boolean;
}) {
  if (items.length === 0) return empty ? <p className="mt-1 text-ink/60">{empty}</p> : null;
  return (
    <ul className={compact ? "space-y-1 mb-1" : "mt-2 space-y-2"}>
      {items.map((e) => (
        <li
          key={e.id}
          className={`flex items-start justify-between gap-1 rounded-md bg-paper border-l-4 border-brown ${
            compact ? "pl-2 pr-0.5 py-1 text-sm" : "pl-3 pr-1 py-2"
          }`}
        >
          <span className="font-bold leading-snug break-words min-w-0">
            {e.dishes?.name ?? "Plat esborrat"}
            {Number(e.servings) !== 1 && <span className="font-normal text-ink/70"> ×{Number(e.servings)}</span>}
          </span>
          {canEdit && (
            <button
              onClick={() => onRemove(e.id)}
              className="shrink-0 rounded p-1 text-ink/60 hover:text-danger hover:bg-danger/10"
              aria-label={`Treu ${e.dishes?.name ?? "el plat"}`}
            >
              <X size={compact ? 14 : 18} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function DishPicker({ dishes, onPick }: { dishes: DishLite[]; onPick: (id: string, servings: number) => void }) {
  const [q, setQ] = useState("");
  const [servings, setServings] = useState(1);
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
          <button
            type="button"
            className="btn btn-outline px-3"
            onClick={() => setServings((s) => s + 0.5)}
            aria-label="Més racions"
          >
            <Plus size={18} aria-hidden />
          </button>
        </div>
      </div>
      <input
        className="field"
        placeholder="Busca un plat"
        aria-label="Busca un plat"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="max-h-[45dvh] overflow-y-auto divide-y-2 divide-line border-2 border-line rounded-xl">
        {filtered.map((d) => (
          <li key={d.id}>
            <button
              className="w-full text-left px-4 py-3 font-bold hover:bg-paper"
              onClick={() => onPick(d.id, servings)}
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
