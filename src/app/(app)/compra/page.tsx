"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { addDays, fromKey, toKey } from "@/lib/dates";
import { formatQty, formatRange } from "@/lib/format";
import { dailyTotals } from "@/components/RecurringPlans";
import { progress } from "@/lib/shopping";
import { UNIT_LABEL, type Group, type RecurringPlan, type Subgroup } from "@/lib/types";

type ListRow = {
  id: string;
  name: string;
  group_id: string | null;
  date_from: string | null;
  date_to: string | null;
  is_done: boolean;
  created_at: string;
  groups: { name: string } | null;
  subgroups: { name: string } | null;
  shopping_list_items: { checked: boolean; ingredient_id: string | null; custom_name: string | null; unit: string | null }[];
};

export default function CompraPage() {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [plans, setPlans] = useState<RecurringPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    const sb = supabase();
    const [l, g, sg, rp] = await Promise.all([
      sb
        .from("shopping_lists")
        .select("id, name, group_id, date_from, date_to, is_done, created_at, groups(name), subgroups(name), shopping_list_items(checked, ingredient_id, custom_name, unit)")
        .order("created_at", { ascending: false }),
      sb.from("groups").select("id, name, invite_code, created_by").order("created_at"),
      sb.from("subgroups").select("id, group_id, name, subgroup_members(user_id)").order("created_at"),
      sb
        .from("recurring_plans")
        .select(
          "id, group_id, subgroup_id, name, recurring_items(id, meal, ingredient_id, quantity, position, ingredients(id, name, unit))",
        )
        .order("created_at"),
    ]);
    setPlans((rp.data as RecurringPlan[]) ?? []);
    setSubgroups((sg.data as Subgroup[]) ?? []);
    setLists((l.data as ListRow[]) ?? []);
    setGroups((g.data as Group[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const open = lists.filter((l) => !l.is_done);
  const done = lists.filter((l) => l.is_done);

  return (
    <>
      <PageHeader
        title="Compra"
        intro="Tria uns dies i la llista surt dels plats que hi ha al calendari. Després hi pots afegir el que falti."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={20} aria-hidden /> Nova llista
          </button>
        }
      />

      {loading ? (
        <p className="text-ink/70">Carregant llistes...</p>
      ) : lists.length === 0 ? (
        <div className="panel p-6 max-w-xl">
          <h2 className="text-2xl font-extrabold">Encara no tens cap llista</h2>
          <p className="mt-2">
            Crea&apos;n una per a la setmana. Si ja tens plats al calendari, els ingredients hi apareixeran sols.
          </p>
          <button className="btn btn-primary mt-5" onClick={() => setCreating(true)}>
            <Plus size={20} aria-hidden /> Crea una llista
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          <ListSection title="Per comprar" lists={open} />
          {done.length > 0 && <ListSection title="Fetes" lists={done} muted />}
        </div>
      )}

      <Sheet open={creating} title="Nova llista" onClose={() => setCreating(false)}>
        {creating && <NewListForm groups={groups} subgroups={subgroups} plans={plans} />}
      </Sheet>
    </>
  );
}

function ListSection({ title, lists, muted }: { title: string; lists: ListRow[]; muted?: boolean }) {
  if (lists.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-extrabold mb-3">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lists.map((l) => {
          const { done: checked, total } = progress(l.shopping_list_items);
          const pct = total ? Math.round((checked / total) * 100) : 0;
          return (
            <li key={l.id}>
              <Link
                href={`/compra/${l.id}`}
                className={`block h-full rounded-2xl border-2 p-4 ${
                  muted ? "bg-paper border-line text-ink/75" : "bg-card border-line hover:border-ink"
                }`}
              >
                <span className="block font-display text-xl font-bold leading-tight">{l.name}</span>
                <span className="block mt-1 text-[0.95rem] text-ink/75">
                  {l.groups ? `Del grup ${l.groups.name}${l.subgroups ? `, ${l.subgroups.name}` : ""}` : "Només meva"}
                  {l.date_from && `, ${formatRange(l.date_from, l.date_to)}`}
                </span>
                <span className="mt-3 flex items-center gap-3">
                  <span className="h-2.5 flex-1 rounded-full bg-paper border border-line overflow-hidden" aria-hidden>
                    <span className="block h-full bg-brown" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {checked} de {total}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type FixedLine = {
  key: string;
  plan: RecurringPlan;
  ingredientId: string;
  name: string;
  unit: keyof typeof UNIT_LABEL;
  daily: number;
};

function NewListForm({ groups, subgroups, plans }: { groups: Group[]; subgroups: Subgroup[]; plans: RecurringPlan[] }) {
  const router = useRouter();
  const [name, setName] = useState("Compra de la setmana");
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [subgroupId, setSubgroupId] = useState<string>("");
  const groupSubgroups = subgroups.filter((s) => s.group_id === groupId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Consum fix (menjar del gos...) ----
  const days = from && to && to >= from ? Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86400000) + 1 : 0;
  // Llista d'un subgrup: només el seu consum fix. Llista de tot el grup: tot el del grup.
  const fixedLines = useMemo<FixedLine[]>(() => {
    if (!groupId) return [];
    return plans
      .filter((p) => p.group_id === groupId && (!subgroupId || p.subgroup_id === subgroupId))
      .flatMap((p) =>
        dailyTotals(p).map((t) => ({
          key: `${p.id}|${t.ingredient.id}`,
          plan: p,
          ingredientId: t.ingredient.id,
          name: t.ingredient.name,
          unit: t.ingredient.unit,
          daily: t.quantity,
        })),
      );
  }, [plans, groupId, subgroupId]);
  // Quantitat a comprar de cada línia; per defecte, la del dia per tots els dies de la llista
  const [fixed, setFixed] = useState<Record<string, { on: boolean; qty: string }>>({});
  useEffect(() => {
    const next: Record<string, { on: boolean; qty: string }> = {};
    for (const l of fixedLines) {
      next[l.key] = { on: true, qty: String(Math.round(l.daily * days * 100) / 100).replace(".", ",") };
    }
    setFixed(next);
  }, [fixedLines, days]);

  // Per defecte, d'avui a d'aquí a sis dies
  useEffect(() => {
    const now = new Date();
    setFrom(toKey(now));
    setTo(toKey(addDays(now, 6)));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (to < from) return setError("La data final ha de ser igual o posterior a la inicial.");
    setBusy(true);
    setError(null);
    const sb = supabase();
    const { data, error } = await sb
      .from("shopping_lists")
      .insert({
        name: name.trim(),
        group_id: groupId || null,
        subgroup_id: groupId && subgroupId ? subgroupId : null,
        date_from: from,
        date_to: to,
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return setError("No s'ha pogut crear la llista.");
    }
    await sb.rpc("generate_shopping_list_items", { p_list_id: data.id });

    const fixedRows = fixedLines
      .map((l) => ({ l, f: fixed[l.key], q: Number((fixed[l.key]?.qty ?? "").replace(",", ".")) }))
      .filter(({ f, q }) => f?.on && q > 0)
      .map(({ l, q }) => ({
        list_id: data.id,
        ingredient_id: l.ingredientId,
        quantity: q,
        unit: l.unit,
        for_user_id: null,
        for_subgroup_id: l.plan.subgroup_id,
        source: "recurring",
      }));
    if (fixedRows.length) await sb.from("shopping_list_items").insert(fixedRows);

    router.push(`/compra/${data.id}`);
  }

  return (
    <form onSubmit={create} className="space-y-5">
      <div>
        <label className="label" htmlFor="list-name">
          Nom
        </label>
        <input id="list-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <fieldset>
        <legend className="label">Per a qui és</legend>
        <div className="space-y-2">
          <Choice
            checked={groupId === ""}
            onChange={() => {
              setGroupId("");
              setSubgroupId("");
            }}
            title="Només per a mi"
            text="Surt només del teu calendari."
          />
          {groups.map((g) => (
            <Choice
              key={g.id}
              checked={groupId === g.id}
              onChange={() => {
                setGroupId(g.id);
                setSubgroupId("");
              }}
              title={`Per al grup ${g.name}`}
              text="Ajunta el calendari de tothom i marca de qui és cada cosa."
            />
          ))}
        </div>
      </fieldset>

      {groupId && groupSubgroups.length > 0 && (
        <div>
          <label className="label" htmlFor="list-subgroup">
            De qui del grup
          </label>
          <select id="list-subgroup" className="field" value={subgroupId} onChange={(e) => setSubgroupId(e.target.value)}>
            <option value="">Tot el grup</option>
            {groupSubgroups.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-ink/70">
            Amb un subgrup, només se sumen els seus calendaris i el que és comú es reparteix entre ells.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="from">
            Des del
          </label>
          <input id="from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="to">
            Fins al
          </label>
          <input id="to" type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} required />
        </div>
      </div>

      {fixedLines.length > 0 && days > 0 && (
        <fieldset>
          <legend className="label">Consum fix per a {days === 1 ? "1 dia" : `${days} dies`}</legend>
          <p className="-mt-1 mb-2 text-sm text-ink/70">Canvia la quantitat o desmarca el que encara tingueu.</p>
          <ul className="rounded-xl border-2 border-line divide-y-2 divide-line">
            {fixedLines.map((l) => {
              const f = fixed[l.key] ?? { on: true, qty: "" };
              return (
                <li key={l.key} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-brown"
                    checked={f.on}
                    aria-label={`Afegeix ${l.name}`}
                    onChange={(e) => setFixed((x) => ({ ...x, [l.key]: { ...f, on: e.target.checked } }))}
                  />
                  <span className={`min-w-0 flex-1 ${f.on ? "" : "text-ink/45 line-through"}`}>
                    <span className="block font-bold leading-tight">{l.name}</span>
                    <span className="block text-sm text-ink/60">
                      {l.plan.name}, {formatQty(l.daily, l.unit)} al dia
                    </span>
                  </span>
                  <input
                    className="field w-20 text-right font-bold"
                    inputMode="decimal"
                    aria-label={`Quantitat de ${l.name}`}
                    value={f.qty}
                    disabled={!f.on}
                    onChange={(e) => setFixed((x) => ({ ...x, [l.key]: { ...f, qty: e.target.value } }))}
                  />
                  <span className="w-6 text-sm font-bold">{UNIT_LABEL[l.unit]}</span>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={busy || !from}>
        {busy ? "Preparant la llista..." : "Crea la llista"}
      </button>
    </form>
  );
}

function Choice({
  checked,
  onChange,
  title,
  text,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  text: string;
}) {
  return (
    <label
      className={`flex gap-3 items-start rounded-xl border-2 p-3 cursor-pointer ${
        checked ? "border-ink bg-paper" : "border-line"
      }`}
    >
      <input type="radio" name="list-owner" checked={checked} onChange={onChange} className="mt-1 h-5 w-5 accent-brown" />
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-[0.95rem] text-ink/75">{text}</span>
      </span>
    </label>
  );
}
