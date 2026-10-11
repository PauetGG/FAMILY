"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import RecurringPlans from "@/components/RecurringPlans";
import MealsManager from "@/components/MealsManager";
import { UNIT_LABEL, type Dish, type Ingredient, type Unit } from "@/lib/types";
import { MEAL_SELECT, type UserMeal } from "@/lib/meals";

type Row = { name: string; unit: Unit; quantity: string };
type Tab = "dishes" | "meals" | "fixed";

const emptyRow = (): Row => ({ name: "", unit: "g", quantity: "" });

const TABS: [Tab, string][] = [
  ["dishes", "Plats"],
  ["meals", "Àpats"],
  ["fixed", "Consum fix"],
];

export default function PlatsPage() {
  const { me } = useMe();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [meals, setMeals] = useState<UserMeal[]>([]);
  // A quins dels meus àpats va cada plat: dish_id -> [meal_id]
  const [dishMeals, setDishMeals] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Dish | "new" | null>(null);
  const [tab, setTab] = useState<Tab>("dishes");

  async function load() {
    if (!me) return;
    const sb = supabase();
    const [d, i, m, dm] = await Promise.all([
      sb
        .from("dishes")
        .select(
          "id, owner_id, name, description, owner:profiles!dishes_owner_id_fkey(id, display_name), dish_ingredients(ingredient_id, quantity, ingredients(id, name, unit))",
        )
        .order("name"),
      sb.from("ingredients").select("id, name, unit").order("name"),
      sb.from("meals").select(MEAL_SELECT).eq("user_id", me.id).order("position"),
      sb.from("dish_meals").select("dish_id, meal_id").eq("user_id", me.id),
    ]);
    setDishes((d.data as Dish[]) ?? []);
    setIngredients((i.data as Ingredient[]) ?? []);
    setMeals((m.data as UserMeal[]) ?? []);
    const map = new Map<string, string[]>();
    ((dm.data ?? []) as { dish_id: string; meal_id: string }[]).forEach((r) => {
      map.set(r.dish_id, [...(map.get(r.dish_id) ?? []), r.meal_id]);
    });
    setDishMeals(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // Un apartat per cada àpat, en el meu ordre, i al final els plats sense àpat
  const sections = useMemo(() => {
    const out = meals.map((meal) => ({
      key: meal.id,
      title: meal.name,
      dishes: dishes.filter((d) => dishMeals.get(d.id)?.includes(meal.id)),
    }));
    const unassigned = dishes.filter((d) => !(dishMeals.get(d.id)?.length));
    if (unassigned.length) out.push({ key: "none", title: "Sense àpat", dishes: unassigned });
    return out;
  }, [meals, dishes, dishMeals]);

  return (
    <>
      <PageHeader
        title="Plats"
        actions={
          <div className="inline-flex rounded-xl border-2 border-ink p-0.5" role="group" aria-label="Què vols veure">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                aria-pressed={tab === k}
                className={`min-h-10 px-4 rounded-[9px] font-bold ${tab === k ? "bg-ink text-paper" : "text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {tab === "fixed" ? (
        <RecurringPlans ingredients={ingredients} onIngredientsChanged={load} />
      ) : tab === "meals" ? (
        <MealsManager meals={meals} onChanged={load} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-lg text-ink/75">
              Cada plat porta la quantitat d&apos;ingredients per a una ració. A partir d&apos;aquí es calcula la llista
              de la compra.
            </p>
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={20} aria-hidden /> Nou plat
            </button>
          </div>

          {loading ? (
            <p className="text-ink/70">Carregant plats...</p>
          ) : dishes.length === 0 ? (
            <div className="panel p-6 max-w-xl">
              <h2 className="text-2xl font-extrabold">Encara no hi ha cap plat</h2>
              <p className="mt-2">Crea el primer plat amb els seus ingredients i ja el podràs posar al calendari.</p>
              <button className="btn btn-primary mt-5" onClick={() => setEditing("new")}>
                <Plus size={20} aria-hidden /> Crea un plat
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {sections.map((s) => (
                <DishList key={s.key} title={s.title} dishes={s.dishes} meId={me?.id} onOpen={setEditing} />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet
        open={editing !== null}
        title={editing === "new" ? "Nou plat" : editing && editing.owner_id === me?.id ? "Edita el plat" : "Plat"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <DishEditor
            key={editing === "new" ? "new" : editing.id}
            dish={editing === "new" ? null : editing}
            readOnly={editing !== "new" && editing.owner_id !== me?.id}
            ingredients={ingredients}
            meals={meals}
            initialMealIds={editing === "new" ? [] : (dishMeals.get(editing.id) ?? [])}
            meId={me?.id ?? ""}
            onDone={async () => {
              setEditing(null);
              await load();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function DishList({
  title,
  dishes,
  meId,
  onOpen,
}: {
  title: string;
  dishes: Dish[];
  meId?: string;
  onOpen: (d: Dish) => void;
}) {
  return (
    <section>
      <h2 className="text-2xl font-extrabold mb-3">{title}</h2>
      {dishes.length === 0 && (
        <p className="text-ink/60">Encara no hi ha cap plat en aquest àpat. Obre un plat i marca-hi l&apos;àpat.</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dishes.map((d) => (
          <li key={d.id}>
            <button
              onClick={() => onOpen(d)}
              className="w-full text-left bg-card border-2 border-line hover:border-ink rounded-2xl p-4 h-full"
            >
              <span className="block font-display text-xl font-bold leading-tight">{d.name}</span>
              <span className="block mt-1 text-[0.95rem] text-ink/75">
                {(d.dish_ingredients ?? [])
                  .map((di) => di.ingredients?.name)
                  .filter(Boolean)
                  .join(", ") || "Sense ingredients"}
              </span>
              {d.owner_id !== meId && d.owner && (
                <span className="block mt-2 text-sm font-bold text-brown">De {d.owner.display_name}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MealPicker({
  meals,
  value,
  onChange,
}: {
  meals: UserMeal[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (meals.length === 0) return null;
  return (
    <fieldset>
      <legend className="label">A quins àpats el vols veure</legend>
      <div className="flex flex-wrap gap-2">
        {meals.map((m) => {
          const on = value.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((id) => id !== m.id) : [...value, m.id])}
              className={`min-h-10 px-4 rounded-xl border-2 font-bold ${
                on ? "bg-ink text-paper border-ink" : "border-line text-ink hover:border-ink"
              }`}
            >
              {m.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function DishEditor({
  dish,
  readOnly,
  ingredients,
  meals,
  initialMealIds,
  meId,
  onDone,
}: {
  dish: Dish | null;
  readOnly: boolean;
  ingredients: Ingredient[];
  meals: UserMeal[];
  initialMealIds: string[];
  meId: string;
  onDone: () => void;
}) {
  const [mealIds, setMealIds] = useState<string[]>(initialMealIds);
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [rows, setRows] = useState<Row[]>(
    dish?.dish_ingredients?.length
      ? dish.dish_ingredients.map((di) => ({
          name: di.ingredients.name,
          unit: di.ingredients.unit,
          quantity: String(di.quantity),
        }))
      : [emptyRow()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitByName = useMemo(() => {
    const m = new Map<string, Unit>();
    ingredients.forEach((i) => m.set(i.name.toLowerCase(), i.unit));
    return m;
  }, [ingredients]);

  function update(idx: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function findOrCreateIngredient(n: string, unit: Unit): Promise<string> {
    const sb = supabase();
    const existing = ingredients.find((i) => i.name.toLowerCase() === n.toLowerCase() && i.unit === unit);
    if (existing) return existing.id;
    const { data, error } = await sb.from("ingredients").insert({ name: n, unit }).select("id").single();
    if (data) return data.id;
    if (error?.code === "23505") {
      const { data: found } = await sb.from("ingredients").select("id").eq("name", n).eq("unit", unit).single();
      if (found) return found.id;
    }
    throw new Error(`No s'ha pogut desar l'ingredient "${n}"`);
  }

  // Desa a quins dels meus àpats va el plat (substitueix el que hi havia)
  async function saveMeals(dishId: string) {
    const sb = supabase();
    const { error: delError } = await sb.from("dish_meals").delete().eq("dish_id", dishId).eq("user_id", meId);
    if (delError) throw delError;
    if (mealIds.length) {
      const { error } = await sb.from("dish_meals").insert(mealIds.map((meal_id) => ({ dish_id: dishId, meal_id })));
      if (error) throw error;
    }
  }

  async function saveOnlyMeals() {
    if (!dish) return;
    setBusy(true);
    setError(null);
    try {
      await saveMeals(dish.id);
      onDone();
    } catch {
      setError("No s'han pogut desar els àpats.");
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = rows
      .map((r) => ({ ...r, name: r.name.trim(), q: Number(r.quantity.replace(",", ".")) }))
      .filter((r) => r.name);
    if (clean.some((r) => !(r.q > 0))) {
      setError("Cada ingredient necessita una quantitat més gran que zero.");
      return;
    }
    setBusy(true);
    const sb = supabase();
    try {
      let dishId = dish?.id;
      if (dishId) {
        const { error } = await sb
          .from("dishes")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", dishId);
        if (error) throw error;
        await sb.from("dish_ingredients").delete().eq("dish_id", dishId);
      } else {
        const { data, error } = await sb
          .from("dishes")
          .insert({ name: name.trim(), description: description.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        dishId = data.id;
      }

      const merged = new Map<string, number>();
      for (const r of clean) {
        const id = await findOrCreateIngredient(r.name, r.unit);
        merged.set(id, (merged.get(id) ?? 0) + r.q);
      }
      if (merged.size) {
        const { error } = await sb
          .from("dish_ingredients")
          .insert([...merged].map(([ingredient_id, quantity]) => ({ dish_id: dishId, ingredient_id, quantity })));
        if (error) throw error;
      }
      if (dishId) await saveMeals(dishId);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut desar el plat.");
      setBusy(false);
    }
  }

    async function remove() {
    if (!dish) return;
    const { isConfirmed } = await Swal.fire({
      target: document.querySelector<HTMLElement>("dialog[open]") ?? "body",
      title: `Vols esborrar "${dish.name}"?`,
      text: "També desapareixerà del calendari.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, esborra'l",
      cancelButtonText: "Cancel·la",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!isConfirmed) return;
    setBusy(true);
    await supabase().from("dishes").delete().eq("id", dish.id);
    onDone();
  }

  if (readOnly && dish) {
    return (
      <div className="space-y-4">
        <p className="text-2xl font-display font-bold">{dish.name}</p>
        {dish.description && <p>{dish.description}</p>}
        <IngredientTable dish={dish} />
        <p className="text-sm text-ink/70">
          Només {dish.owner?.display_name ?? "qui l'ha creat"} pot editar aquest plat, però tu decideixes a quins dels
          teus àpats el vols veure.
        </p>
        <MealPicker meals={meals} value={mealIds} onChange={setMealIds} />
        {error && (
          <p role="alert" className="font-bold text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={saveOnlyMeals} disabled={busy}>
            {busy ? "Desant..." : "Desa els àpats"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label className="label" htmlFor="dish-name">
          Nom del plat
        </label>
        <input id="dish-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="dish-desc">
          Notes <span className="font-normal text-ink/65">(opcional)</span>
        </label>
        <textarea
          id="dish-desc"
          className="field min-h-20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <MealPicker meals={meals} value={mealIds} onChange={setMealIds} />

      <fieldset>
        <legend className="label">Ingredients per ració</legend>
        <datalist id="ingredient-names">
          {[...new Set(ingredients.map((i) => i.name))].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[minmax(0,1fr)_4rem_4.1rem_2.75rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_4.6rem_2.75rem] gap-1.5 sm:gap-2 items-center"
            >
              <input
                className="field"
                placeholder="Ingredient"
                aria-label="Ingredient"
                list="ingredient-names"
                value={r.name}
                onChange={(e) => {
                  const known = unitByName.get(e.target.value.trim().toLowerCase());
                  update(idx, { name: e.target.value, ...(known ? { unit: known } : {}) });
                }}
              />
              <input
                className="field text-right"
                placeholder="0"
                aria-label="Quantitat"
                inputMode="decimal"
                value={r.quantity}
                onChange={(e) => update(idx, { quantity: e.target.value })}
              />
              <select
                className="field px-2"
                aria-label="Unitat"
                value={r.unit}
                onChange={(e) => update(idx, { unit: e.target.value as Unit })}
              >
                {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Treu l'ingredient"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : [emptyRow()]))}
              >
                <Trash2 size={19} aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost mt-2" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          <Plus size={18} aria-hidden /> Afegeix ingredient
        </button>
      </fieldset>

      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-between pt-2">
        {dish ? (
          <button type="button" className="btn btn-ghost text-danger" onClick={remove} disabled={busy}>
            <Trash2 size={18} aria-hidden /> Esborra
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Desant..." : "Desa el plat"}
        </button>
      </div>
    </form>
  );
}

function IngredientTable({ dish }: { dish: Dish }) {
  return (
    <table className="w-full">
      <tbody>
        {(dish.dish_ingredients ?? []).map((di) => (
          <tr key={di.ingredient_id} className="border-b border-line">
            <td className="py-2">{di.ingredients.name}</td>
            <td className="py-2 text-right font-bold">
              {Number(di.quantity)} {UNIT_LABEL[di.ingredients.unit]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}