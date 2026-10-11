"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { formatQty } from "@/lib/format";
import {
  MEALS,
  UNIT_LABEL,
  type Group,
  type Ingredient,
  type Meal,
  type RecurringPlan,
  type Subgroup,
  type Unit,
} from "@/lib/types";

const PLAN_SELECT =
  "id, group_id, subgroup_id, name, recurring_items(id, meal, ingredient_id, quantity, position, ingredients(id, name, unit))";

type Row = { meal: Meal | ""; name: string; unit: Unit; quantity: string };

const emptyRow = (meal: Meal | "" = "lunch"): Row => ({ meal, name: "", unit: "g", quantity: "" });

const mealLabel = (m: Meal | null) => (m ? MEALS.find((x) => x.key === m)?.label ?? "" : "Tot el dia");

// Total al dia de cada ingredient, sumant tots els àpats
export function dailyTotals(plan: RecurringPlan) {
  const map = new Map<string, { ingredient: Ingredient; quantity: number }>();
  for (const it of plan.recurring_items) {
    if (!it.ingredients) continue;
    const cur = map.get(it.ingredient_id);
    map.set(it.ingredient_id, { ingredient: it.ingredients, quantity: (cur?.quantity ?? 0) + Number(it.quantity) });
  }
  return [...map.values()].sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, "ca"));
}

export default function RecurringPlans({
  ingredients,
  onIngredientsChanged,
}: {
  ingredients: Ingredient[];
  onIngredientsChanged: () => Promise<void>;
}) {
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RecurringPlan | "new" | null>(null);

  async function load() {
    const sb = supabase();
    const [p, g, s] = await Promise.all([
      sb.from("recurring_plans").select(PLAN_SELECT).order("created_at"),
      sb.from("groups").select("id, name, invite_code, created_by").order("created_at"),
      sb.from("subgroups").select("id, group_id, name, subgroup_members(user_id)").order("created_at"),
    ]);
    setPlans((p.data as RecurringPlan[]) ?? []);
    setGroups((g.data as Group[]) ?? []);
    setSubgroups((s.data as Subgroup[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const whoFor = (plan: RecurringPlan) => {
    const sub = subgroups.find((s) => s.id === plan.subgroup_id);
    const group = groups.find((g) => g.id === plan.group_id);
    return sub ? sub.name : group ? `Tot el grup ${group.name}` : "";
  };

  if (loading) return <p className="text-ink/70">Carregant...</p>;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-lg text-ink/75">
          El que es menja igual cada dia i no cal posar al calendari, com el menjar del gos. En fer la llista de la compra
          se&apos;n calcula la quantitat pels dies que triïs.
        </p>
        {groups.length > 0 && (
          <button className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={20} aria-hidden /> Nou consum fix
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="panel p-6 max-w-xl">
          <h2 className="text-2xl font-extrabold">Primer cal un grup</h2>
          <p className="mt-2">El consum fix és de tot un grup o d&apos;un subgrup. Crea&apos;l o entra-hi des de Grup.</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="panel p-6 max-w-xl">
          <h2 className="text-2xl font-extrabold">Encara no n&apos;hi ha cap</h2>
          <p className="mt-2">Per exemple, &quot;Menjar del gos&quot;, amb el que menja per dinar i per sopar.</p>
          <button className="btn btn-primary mt-5" onClick={() => setEditing("new")}>
            <Plus size={20} aria-hidden /> Crea&apos;n un
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const byMeal = new Map<string, string[]>();
            [...p.recurring_items]
              .sort((a, b) => a.position - b.position)
              .forEach((it) => {
                if (!it.ingredients) return;
                const k = mealLabel(it.meal);
                byMeal.set(k, [...(byMeal.get(k) ?? []), `${it.ingredients.name} ${formatQty(Number(it.quantity), it.ingredients.unit)}`]);
              });
            return (
              <li key={p.id}>
                <button
                  onClick={() => setEditing(p)}
                  className="w-full h-full text-left bg-card border-2 border-line hover:border-ink rounded-2xl p-4"
                >
                  <span className="block font-display text-xl font-bold leading-tight">{p.name}</span>
                  <span className="block mt-0.5 text-sm font-bold text-brown">{whoFor(p)}</span>
                  <span className="mt-2 block space-y-0.5">
                    {[...byMeal].map(([meal, list]) => (
                      <span key={meal} className="block text-[0.95rem]">
                        <b>{meal}:</b> <span className="text-ink/70">{list.join(", ")}</span>
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 block text-sm text-ink/60">
                    Al dia:{" "}
                    {dailyTotals(p)
                      .map((t) => `${t.ingredient.name} ${formatQty(t.quantity, t.ingredient.unit)}`)
                      .join(", ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        title={editing === "new" ? "Nou consum fix" : "Edita el consum fix"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <PlanEditor
            key={editing === "new" ? "new" : editing.id}
            plan={editing === "new" ? null : editing}
            groups={groups}
            subgroups={subgroups}
            ingredients={ingredients}
            onDone={async () => {
              setEditing(null);
              await Promise.all([load(), onIngredientsChanged()]);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function PlanEditor({
  plan,
  groups,
  subgroups,
  ingredients,
  onDone,
}: {
  plan: RecurringPlan | null;
  groups: Group[];
  subgroups: Subgroup[];
  ingredients: Ingredient[];
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState(plan?.name ?? "Menjar del gos");
  const [groupId, setGroupId] = useState(plan?.group_id ?? groups[0]?.id ?? "");
  const groupSubs = subgroups.filter((s) => s.group_id === groupId);
  const [subgroupId, setSubgroupId] = useState(plan?.subgroup_id ?? groupSubs[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>(
    plan?.recurring_items.length
      ? [...plan.recurring_items]
          .sort((a, b) => a.position - b.position)
          .map((it) => ({
            meal: it.meal ?? "",
            name: it.ingredients?.name ?? "",
            unit: it.ingredients?.unit ?? "g",
            quantity: String(it.quantity).replace(".", ","),
          }))
      : [emptyRow("lunch"), emptyRow("dinner")],
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
    if (clean.length === 0) return setError("Afegeix com a mínim un ingredient.");
    if (clean.some((r) => !(r.q > 0))) return setError("Cada ingredient necessita una quantitat al dia més gran que zero.");

    setBusy(true);
    const sb = supabase();
    try {
      const fields = { name: name.trim(), group_id: groupId, subgroup_id: subgroupId || null };
      let planId = plan?.id;
      if (planId) {
        const { error } = await sb.from("recurring_plans").update(fields).eq("id", planId);
        if (error) throw error;
        await sb.from("recurring_items").delete().eq("plan_id", planId);
      } else {
        const { data, error } = await sb.from("recurring_plans").insert(fields).select("id").single();
        if (error || !data) throw error ?? new Error();
        planId = data.id;
      }
      const items = [];
      for (const [position, r] of clean.entries()) {
        items.push({
          plan_id: planId,
          meal: r.meal || null,
          ingredient_id: await findOrCreateIngredient(r.name, r.unit),
          quantity: r.q,
          position,
        });
      }
      const { error } = await sb.from("recurring_items").insert(items);
      if (error) throw error;
      await onDone();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No s'ha pogut desar.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!plan || !confirm(`Vols esborrar "${plan.name}"?`)) return;
    setBusy(true);
    await supabase().from("recurring_plans").delete().eq("id", plan.id);
    await onDone();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label className="label" htmlFor="plan-name">
          Nom
        </label>
        <input id="plan-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.length > 1 && (
          <div>
            <label className="label" htmlFor="plan-group">
              Grup
            </label>
            <select
              id="plan-group"
              className="field"
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setSubgroupId("");
              }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="plan-sub">
            De qui és
          </label>
          <select id="plan-sub" className="field" value={subgroupId} onChange={(e) => setSubgroupId(e.target.value)}>
            <option value="">Tot el grup</option>
            {groupSubs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-3 text-sm text-ink/70">Qui ho paga quan es llegeix el tiquet.</p>

      <fieldset>
        <legend className="label">Què menja cada dia</legend>
        <datalist id="plan-ingredients">
          {[...new Set(ingredients.map((i) => i.name))].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={idx} className="rounded-xl border-2 border-line p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  className="field w-auto font-bold"
                  aria-label="Àpat"
                  value={r.meal}
                  onChange={(e) => update(idx, { meal: e.target.value as Meal | "" })}
                >
                  {MEALS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                  <option value="">Tot el dia</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost ml-auto"
                  aria-label="Treu l'ingredient"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : [emptyRow()]))}
                >
                  <Trash2 size={19} aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.1rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_4.6rem] gap-1.5 sm:gap-2">
                <input
                  className="field"
                  placeholder="Pinso, arròs..."
                  aria-label="Ingredient"
                  list="plan-ingredients"
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
              </div>
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

      <div className="flex flex-wrap gap-2 justify-between pt-1">
        {plan ? (
          <button type="button" className="btn btn-ghost text-danger" onClick={remove} disabled={busy}>
            <Trash2 size={18} aria-hidden /> Esborra
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !groupId}>
          {busy ? "Desant..." : "Desa"}
        </button>
      </div>
    </form>
  );
}
