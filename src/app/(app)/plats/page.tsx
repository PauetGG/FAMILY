"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import { UNIT_LABEL, type Dish, type Ingredient, type Unit } from "@/lib/types";

type Row = { name: string; unit: Unit; quantity: string };

const emptyRow = (): Row => ({ name: "", unit: "g", quantity: "" });

export default function PlatsPage() {
  const { me } = useMe();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Dish | "new" | null>(null);

  async function load() {
    const sb = supabase();
    const [d, i] = await Promise.all([
      sb
        .from("dishes")
        .select(
          "id, owner_id, name, description, owner:profiles!dishes_owner_id_fkey(id, display_name), dish_ingredients(ingredient_id, quantity, ingredients(id, name, unit))",
        )
        .order("name"),
      sb.from("ingredients").select("id, name, unit").order("name"),
    ]);
    setDishes((d.data as Dish[]) ?? []);
    setIngredients((i.data as Ingredient[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const mine = dishes.filter((d) => d.owner_id === me?.id);
  const others = dishes.filter((d) => d.owner_id !== me?.id);

  return (
    <>
      <PageHeader
        title="Plats"
        intro="Cada plat porta la quantitat d'ingredients per a una ració. A partir d'aquí es calcula la llista de la compra."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={20} aria-hidden /> Nou plat
          </button>
        }
      />

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
          <DishList title="Els meus plats" dishes={mine} onOpen={setEditing} />
          {others.length > 0 && (
            <DishList title="Plats del grup" dishes={others} onOpen={setEditing} showOwner />
          )}
        </div>
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
  onOpen,
  showOwner,
}: {
  title: string;
  dishes: Dish[];
  onOpen: (d: Dish) => void;
  showOwner?: boolean;
}) {
  if (dishes.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-extrabold mb-3">{title}</h2>
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
              {showOwner && d.owner && (
                <span className="block mt-2 text-sm font-bold text-brown">De {d.owner.display_name}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DishEditor({
  dish,
  readOnly,
  ingredients,
  onDone,
}: {
  dish: Dish | null;
  readOnly: boolean;
  ingredients: Ingredient[];
  onDone: () => void;
}) {
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
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut desar el plat.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!dish || !confirm(`Vols esborrar "${dish.name}"? També desapareixerà del calendari.`)) return;
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
        <p className="text-sm text-ink/70">Només {dish.owner?.display_name ?? "qui l'ha creat"} pot editar aquest plat.</p>
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

      <fieldset>
        <legend className="label">Ingredients per ració</legend>
        <datalist id="ingredient-names">
          {[...new Set(ingredients.map((i) => i.name))].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-[minmax(0,1fr)_4rem_4.1rem_2.75rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_4.6rem_2.75rem] gap-1.5 sm:gap-2 items-center">
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
