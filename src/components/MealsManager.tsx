"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabase/client";
import type { UserMeal } from "@/lib/meals";

// Crear, reanomenar, reordenar i esborrar els àpats propis
export default function MealsManager({ meals, onChanged }: { meals: UserMeal[]; onChanged: () => void }) {
  const [list, setList] = useState<UserMeal[]>(meals);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setList(meals);
    setNames(Object.fromEntries(meals.map((m) => [m.id, m.name])));
  }, [meals]);

  async function move(idx: number, delta: number) {
    const to = idx + delta;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[idx], next[to]] = [next[to], next[idx]];
    setList(next);
    setError(null);
    const { error } = await supabase().rpc("reorder_meals", { p_ids: next.map((m) => m.id) });
    if (error) setError("No s'ha pogut canviar l'ordre.");
    onChanged();
  }

  async function rename(meal: UserMeal) {
    const name = (names[meal.id] ?? "").trim();
    if (!name || name === meal.name) {
      setNames((n) => ({ ...n, [meal.id]: meal.name }));
      return;
    }
    setError(null);
    const { error } = await supabase().from("meals").update({ name }).eq("id", meal.id);
    if (error) {
      setError(error.code === "23505" ? `Ja tens un àpat que es diu "${name}".` : "No s'ha pogut canviar el nom.");
      setNames((n) => ({ ...n, [meal.id]: meal.name }));
      return;
    }
    onChanged();
  }

  async function remove(meal: UserMeal) {
    const { isConfirmed } = await Swal.fire({
      title: `Vols esborrar "${meal.name}"?`,
      text: "Aquest àpat desapareixerà de la pantalla de plats.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, esborra'l",
      cancelButtonText: "Cancel·la",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!isConfirmed) return;

    setError(null);
    const { error } = await supabase().from("meals").delete().eq("id", meal.id);
    if (error) {
      await Swal.fire({
        title: "No s'ha pogut esborrar",
        text:
          error.code === "23503"
            ? `"${meal.name}" té plats posats al calendari. Treu-los o canvia'ls d'àpat abans d'esborrar-lo.`
            : "Torna-ho a provar d'aquí a una estona.",
        icon: "error",
        confirmButtonText: "D'acord",
      });
      return;
    }
    onChanged();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const position = list.reduce((max, m) => Math.max(max, m.position), 0) + 1;
    const { error } = await supabase().from("meals").insert({ name, position });
    setBusy(false);
    if (error) {
      setError(error.code === "23505" ? `Ja tens un àpat que es diu "${name}".` : "No s'ha pogut crear l'àpat.");
      return;
    }
    setNewName("");
    onChanged();
  }

  return (
    <div className="max-w-xl space-y-5">
      <p className="text-lg text-ink/75">
        Aquests són els teus àpats, en l&apos;ordre en què surten al calendari i a la pantalla de plats. Els canvis
        només t&apos;afecten a tu.
      </p>

      <ul className="space-y-2">
        {list.map((m, idx) => (
          <li key={m.id} className="flex items-center gap-1.5 bg-card border-2 border-line rounded-2xl p-2">
            <div className="flex flex-col">
              <button
                className="btn btn-ghost min-h-0 h-8 px-2"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                aria-label={`Puja ${m.name}`}
              >
                <ChevronUp size={20} aria-hidden />
              </button>
              <button
                className="btn btn-ghost min-h-0 h-8 px-2"
                onClick={() => move(idx, 1)}
                disabled={idx === list.length - 1}
                aria-label={`Baixa ${m.name}`}
              >
                <ChevronDown size={20} aria-hidden />
              </button>
            </div>
            <input
              className="field flex-1"
              aria-label="Nom de l'àpat"
              value={names[m.id] ?? m.name}
              onChange={(e) => setNames((n) => ({ ...n, [m.id]: e.target.value }))}
              onBlur={() => rename(m)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <button className="btn btn-ghost text-danger" onClick={() => remove(m)} aria-label={`Esborra ${m.name}`}>
              <Trash2 size={19} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <input
          className="field flex-1"
          placeholder="Nou àpat (p. ex. Ressopó)"
          aria-label="Nom del nou àpat"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
          <Plus size={20} aria-hidden /> Afegeix
        </button>
      </form>

      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}