"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";
import DayPopup, { type DishLite } from "@/components/calendar/DayPopup";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import { addDays, addMonths, dayLabel, monthGrid, monthLabel, mondayOf, toKey, weekLabel } from "@/lib/dates";
import type { CalendarPerson, DietEntry, Meal } from "@/lib/types";

type View = "month" | "week" | "day";

const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "Mes" },
  { key: "week", label: "Setmana" },
  { key: "day", label: "Dia" },
];

const ENTRY_SELECT =
  "id, user_id, date, meal, dish_id, servings, dishes(id, name, dish_ingredients(quantity, ingredients(name, unit)))";

export default function CalendarPage() {
  const { me } = useMe();
  const [view, setView] = useState<View>("month");
  // La data d'avui es llegeix al navegador, no durant la generació de la pàgina
  const [cursor, setCursor] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [people, setPeople] = useState<CalendarPerson[]>([]);
  const [entries, setEntries] = useState<DietEntry[]>([]);
  const [dishes, setDishes] = useState<DishLite[]>([]);
  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setTodayKey(toKey(now));
  }, []);

  // Qui surt al calendari: tu i tota la gent dels teus grups
  useEffect(() => {
    if (!me) return;
    (async () => {
      const sb = supabase();
      const [{ data: members }, { data: shares }, { data: ds }] = await Promise.all([
        sb.from("group_members").select("user_id, profiles(id, display_name)"),
        sb
          .from("diet_shares")
          .select("can_edit, owner:profiles!diet_shares_owner_id_fkey(id, display_name)")
          .eq("shared_with_id", me.id),
        sb.from("dishes").select("id, name").order("name"),
      ]);
      const list = new Map<string, CalendarPerson>();
      list.set(me.id, { id: me.id, name: me.display_name || "Tu", canEdit: true });
      // Tota la gent dels meus grups (només per veure)...
      ((members ?? []) as { user_id: string; profiles: { id: string; display_name: string } | null }[]).forEach((m) => {
        if (m.profiles && !list.has(m.user_id)) {
          list.set(m.user_id, { id: m.user_id, name: m.profiles.display_name || "Sense nom", canEdit: false });
        }
      });
      // ...i qui m'ha donat permís, que a més puc editar
      (shares ?? []).forEach((s: { can_edit: boolean; owner: { id: string; display_name: string } | null }) => {
        if (!s.owner) return;
        const cur = list.get(s.owner.id);
        list.set(s.owner.id, {
          id: s.owner.id,
          name: cur?.name ?? (s.owner.display_name || "Sense nom"),
          canEdit: (cur?.canEdit ?? false) || s.can_edit,
        });
      });
      setPeople([...list.values()]);
      setDishes((ds as DishLite[]) ?? []);
    })();
  }, [me]);

  // Dies que es veuen ara mateix
  const range = useMemo(() => {
    if (!cursor) return null;
    if (view === "month") {
      const g = monthGrid(cursor);
      return { from: g[0], to: g[g.length - 1] };
    }
    if (view === "week") {
      const m = mondayOf(cursor);
      return { from: m, to: addDays(m, 6) };
    }
    return { from: cursor, to: cursor };
  }, [cursor, view]);

  const loadEntries = useCallback(async () => {
    if (!range || people.length === 0) return;
    const { data } = await supabase()
      .from("diet_entries")
      .select(ENTRY_SELECT)
      .in(
        "user_id",
        people.map((p) => p.id),
      )
      .gte("date", toKey(range.from))
      .lte("date", toKey(range.to))
      .order("created_at");
    setEntries((data as DietEntry[]) ?? []);
  }, [range, people]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function addEntry(date: string, meal: Meal, userId: string, dishId: string, servings: number) {
    const { error } = await supabase()
      .from("diet_entries")
      .insert({ user_id: userId, date, meal, dish_id: dishId, servings });
    if (error) setMessage("No s'ha pogut afegir el plat.");
    await loadEntries();
  }

  async function removeEntry(id: string) {
    setEntries((es) => es.filter((e) => e.id !== id));
    await supabase().from("diet_entries").delete().eq("id", id);
  }

  async function copyWeek() {
    if (!me || !cursor) return;
    const monday = mondayOf(cursor);
    const next = addDays(monday, 7);
    const { data, error } = await supabase().rpc("copy_diet_week", {
      p_from: toKey(monday),
      p_to: toKey(next),
      p_user_id: me.id,
    });
    if (error) return setMessage("No s'ha pogut copiar la setmana.");
    setMessage(data ? `S'han copiat ${data} plats teus a la setmana vinent.` : "Aquesta setmana no tens cap plat per copiar.");
    if (data) setCursor(next);
  }

  function move(delta: number) {
    setMessage(null);
    setCursor((c) => {
      if (!c) return c;
      if (view === "month") return addMonths(c, delta);
      if (view === "week") return addDays(c, delta * 7);
      return addDays(c, delta);
    });
  }

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setMessage(null);
  }

  if (!cursor) return <PageHeader title="Calendari" />;

  const label =
    view === "month" ? monthLabel(cursor) : view === "week" ? weekLabel(mondayOf(cursor)) : dayLabel(cursor);
  const prevLabel = view === "month" ? "Mes anterior" : view === "week" ? "Setmana anterior" : "Dia anterior";
  const nextLabel = view === "month" ? "Mes següent" : view === "week" ? "Setmana següent" : "Dia següent";

  const dayActions = { people, entries, dishes, onAdd: addEntry, onRemove: removeEntry };

  return (
    <>
      <PageHeader
        title="Calendari"
        actions={
          <div className="inline-flex rounded-xl border-2 border-ink p-0.5" role="group" aria-label="Vista del calendari">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={`min-h-10 px-4 rounded-[9px] font-bold ${view === v.key ? "bg-ink text-paper" : "text-ink"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center">
          <button className="btn btn-ghost" onClick={() => move(-1)} aria-label={prevLabel}>
            <ChevronLeft size={24} aria-hidden />
          </button>
          <p className="font-display text-xl sm:text-2xl font-bold min-w-[10.5rem] text-center" aria-live="polite">
            {label}
          </p>
          <button className="btn btn-ghost" onClick={() => move(1)} aria-label={nextLabel}>
            <ChevronRight size={24} aria-hidden />
          </button>
        </div>
        <button className="btn btn-outline" onClick={goToday}>
          Avui
        </button>
        {view === "week" && (
          <button className="btn btn-outline sm:ml-auto" onClick={copyWeek}>
            <Copy size={18} aria-hidden /> Copia la meva setmana a la vinent
          </button>
        )}
      </div>

      {message && (
        <p role="status" className="mb-4 font-bold text-brown">
          {message}
        </p>
      )}

      {view === "month" && (
        <MonthView cursor={cursor} todayKey={todayKey} people={people} entries={entries} onOpenDay={setPopupDate} />
      )}
      {view === "week" && (
        <WeekView monday={mondayOf(cursor)} todayKey={todayKey} people={people} entries={entries} onOpenDay={setPopupDate} />
      )}
      {view === "day" && <DayView date={toKey(cursor)} {...dayActions} />}

      {people.length === 1 && (
        <p className="mt-6 text-ink/60">
          Quan entri més gent al teu grup, també sortirà aquí.
        </p>
      )}

      <DayPopup date={popupDate} onClose={() => setPopupDate(null)} {...dayActions} />
    </>
  );
}
