"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronLeft, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import { formatQty, formatRange } from "@/lib/format";
import { itemKey } from "@/lib/shopping";
import { UNIT_LABEL, type Ingredient, type Profile, type Unit } from "@/lib/types";

type List = {
  id: string;
  name: string;
  owner_id: string;
  group_id: string | null;
  date_from: string | null;
  date_to: string | null;
  is_done: boolean;
  groups: { name: string } | null;
};

type Item = {
  id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: Unit | null;
  for_user_id: string | null;
  checked: boolean;
  source: "diet" | "manual";
  ingredients: { name: string } | null;
};

type Row = {
  key: string;
  name: string;
  unit: Unit | null;
  total: number | null;
  parts: { userId: string | null; qty: number | null }[];
  ids: string[];
  checked: boolean;
};

const COMMON = "__comu__";

const itemName = (i: Item) => i.ingredients?.name ?? i.custom_name ?? "";

export default function ShoppingList() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [view, setView] = useState<"together" | "person">("together");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const { data } = await supabase()
      .from("shopping_list_items")
      .select("id, ingredient_id, custom_name, quantity, unit, for_user_id, checked, source, ingredients(name)")
      .eq("list_id", id);
    setItems((data as Item[]) ?? []);
  }, [id]);

  // Càrrega inicial
  useEffect(() => {
    if (!me) return;
    (async () => {
      const sb = supabase();
      const { data: l } = await sb
        .from("shopping_lists")
        .select("id, name, owner_id, group_id, date_from, date_to, is_done, groups(name)")
        .eq("id", id)
        .maybeSingle();
      if (!l) return setNotFound(true);
      setList(l as List);

      const [ing] = await Promise.all([sb.from("ingredients").select("id, name, unit").order("name"), loadItems()]);
      setIngredients((ing.data as Ingredient[]) ?? []);

      if (l.group_id) {
        const { data: gm } = await sb
          .from("group_members")
          .select("user_id, profiles(id, display_name)")
          .eq("group_id", l.group_id);
        setPeople(
          ((gm ?? []) as { user_id: string; profiles: Profile | null }[])
            .map((m) => m.profiles)
            .filter((p): p is Profile => !!p),
        );
      } else {
        setPeople([me]);
      }
    })();
  }, [id, me, loadItems]);

  // Canvis en directe: si algú marca alguna cosa des d'un altre mòbil, es veu aquí
  useEffect(() => {
    const sb = supabase();
    const channel = sb
      .channel(`list-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_list_items", filter: `list_id=eq.${id}` },
        () => loadItems(),
      )
      .subscribe();
    const onFocus = () => loadItems();
    window.addEventListener("focus", onFocus);
    return () => {
      sb.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [id, loadItems]);

  const isGroup = !!list?.group_id;
  const nameOf = useCallback(
    (userId: string | null) =>
      userId === null ? "Comú" : userId === me?.id ? "Tu" : people.find((p) => p.id === userId)?.display_name ?? "Algú",
    [people, me],
  );

  const together = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const i of items) {
      const key = itemKey(i);
      const row = map.get(key) ?? { key, name: itemName(i), unit: i.unit, total: null, parts: [], ids: [], checked: true };
      if (i.quantity != null) row.total = (row.total ?? 0) + Number(i.quantity);
      row.parts.push({ userId: i.for_user_id, qty: i.quantity });
      row.ids.push(i.id);
      row.checked = row.checked && i.checked;
      map.set(key, row);
    }
    return sortRows([...map.values()]);
  }, [items]);

  const byPerson = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const i of items) {
      const k = i.for_user_id ?? COMMON;
      const row: Row = {
        key: i.id,
        name: itemName(i),
        unit: i.unit,
        total: i.quantity,
        parts: [],
        ids: [i.id],
        checked: i.checked,
      };
      groups.set(k, [...(groups.get(k) ?? []), row]);
    }
    const order = [...(me ? [me.id] : []), ...people.map((p) => p.id).filter((p) => p !== me?.id), COMMON];
    return order
      .filter((k) => groups.has(k))
      .map((k) => ({ key: k, title: k === COMMON ? "Comú" : nameOf(k), rows: sortRows(groups.get(k)!) }));
  }, [items, people, me, nameOf]);

  async function toggle(row: Row) {
    const next = !row.checked;
    setItems((its) => its.map((i) => (row.ids.includes(i.id) ? { ...i, checked: next } : i)));
    await supabase().from("shopping_list_items").update({ checked: next }).in("id", row.ids);
  }

  async function removeItem(itemId: string) {
    setItems((its) => its.filter((i) => i.id !== itemId));
    await supabase().from("shopping_list_items").delete().eq("id", itemId);
  }

  async function regenerate() {
    setBusy(true);
    const { data, error } = await supabase().rpc("generate_shopping_list_items", { p_list_id: id });
    await loadItems();
    setBusy(false);
    setMsg(error ? "No s'ha pogut tornar a calcular." : `Llista actualitzada amb el calendari (${data ?? 0} ingredients).`);
  }

  async function setDone(done: boolean) {
    await supabase().from("shopping_lists").update({ is_done: done }).eq("id", id);
    setList((l) => (l ? { ...l, is_done: done } : l));
    setMsg(done ? "Llista marcada com a feta." : "Llista oberta de nou.");
  }

  async function deleteList() {
    if (!list || !confirm(`Vols esborrar la llista "${list.name}"?`)) return;
    await supabase().from("shopping_lists").delete().eq("id", id);
    router.push("/compra");
  }

  if (notFound) {
    return (
      <div className="panel p-6 max-w-xl">
        <h1 className="text-3xl font-extrabold">No trobem aquesta llista</h1>
        <p className="mt-2">Potser s&apos;ha esborrat o ja no formes part del grup.</p>
        <Link href="/compra" className="btn btn-primary mt-5">
          Torna a les llistes
        </Link>
      </div>
    );
  }

  if (!list) return <p className="text-ink/70">Carregant la llista...</p>;

  const total = together.length;
  const inCart = together.filter((r) => r.checked).length;

  return (
    <>
      <Link href="/compra" className="btn btn-ghost -ml-3 mb-2">
        <ChevronLeft size={20} aria-hidden /> Llistes
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.1rem] sm:text-5xl font-extrabold">{list.name}</h1>
          <p className="mt-2 text-lg text-ink/75">
            {list.groups ? `Grup ${list.groups.name}` : "Només meva"}
            {list.date_from && `, del ${formatRange(list.date_from, list.date_to)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.date_from && (
            <button className="btn btn-outline" onClick={regenerate} disabled={busy}>
              <RefreshCw size={18} aria-hidden className={busy ? "animate-spin" : ""} />
              {busy ? "Calculant..." : "Torna a calcular"}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setDone(!list.is_done)}>
            <Check size={18} aria-hidden /> {list.is_done ? "Torna a obrir" : "Marca com a feta"}
          </button>
        </div>
      </div>

      {msg && (
        <p role="status" className="mb-4 font-bold text-brown">
          {msg}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        <div className="min-w-0 space-y-5">
          {/* Progrés i vista */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-2xl font-bold tabular-nums">
              {inCart} de {total} al carro
            </p>
            {isGroup && (
              <div className="inline-flex rounded-xl border-2 border-ink p-0.5" role="group" aria-label="Com vols veure la llista">
                <ViewButton active={view === "together"} onClick={() => setView("together")}>
                  Tot junt
                </ViewButton>
                <ViewButton active={view === "person"} onClick={() => setView("person")}>
                  Per persona
                </ViewButton>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="panel p-5">
              <h2 className="text-2xl font-extrabold">La llista és buida</h2>
              <p className="mt-1">
                No hi ha plats al calendari d&apos;aquests dies. Afegeix-ne al{" "}
                <Link href="/" className="font-bold text-brown underline underline-offset-4">
                  calendari
                </Link>{" "}
                i prem &quot;Torna a calcular&quot;, o afegeix articles a mà.
              </p>
            </div>
          ) : view === "together" || !isGroup ? (
            <ItemsBlock rows={together} onToggle={toggle} nameOf={nameOf} showParts={isGroup} />
          ) : (
            byPerson.map((g) => (
              <section key={g.key}>
                <h2 className="text-2xl font-extrabold mb-2">{g.title}</h2>
                <ItemsBlock rows={g.rows} onToggle={toggle} nameOf={nameOf} onRemove={removeItem} />
              </section>
            ))
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <AddItemForm
            listId={id}
            isGroup={isGroup}
            people={people}
            meId={me?.id ?? null}
            ingredients={ingredients}
            onAdded={loadItems}
          />
          {list.owner_id === me?.id && (
            <button className="btn btn-ghost text-danger" onClick={deleteList}>
              <Trash2 size={18} aria-hidden /> Esborra la llista
            </button>
          )}
        </aside>
      </div>
    </>
  );
}

function sortRows(rows: Row[]) {
  return rows.sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, "ca"));
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 px-4 rounded-[9px] font-bold ${active ? "bg-ink text-paper" : "text-ink"}`}
    >
      {children}
    </button>
  );
}

function ItemsBlock({
  rows,
  onToggle,
  nameOf,
  showParts,
  onRemove,
}: {
  rows: Row[];
  onToggle: (r: Row) => void;
  nameOf: (id: string | null) => string;
  showParts?: boolean;
  onRemove?: (id: string) => void;
}) {
  const pending = rows.filter((r) => !r.checked);
  const cart = rows.filter((r) => r.checked);

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <ul className="panel overflow-hidden divide-y-2 divide-line">
          {pending.map((r) => (
            <ItemRow key={r.key} row={r} onToggle={onToggle} nameOf={nameOf} showParts={showParts} onRemove={onRemove} />
          ))}
        </ul>
      )}
      {cart.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-2 mt-4">Al carro</h3>
          <ul className="rounded-2xl border-2 border-line bg-paper overflow-hidden divide-y-2 divide-line">
            {cart.map((r) => (
              <ItemRow key={r.key} row={r} onToggle={onToggle} nameOf={nameOf} showParts={showParts} onRemove={onRemove} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  row,
  onToggle,
  nameOf,
  showParts,
  onRemove,
}: {
  row: Row;
  onToggle: (r: Row) => void;
  nameOf: (id: string | null) => string;
  showParts?: boolean;
  onRemove?: (id: string) => void;
}) {
  const parts =
    showParts
      ? row.parts
          .map((p) => `${nameOf(p.userId)}${p.qty != null ? ` ${formatQty(p.qty, row.unit)}` : ""}`)
          .join(", ")
      : null;

  return (
    <li className="flex items-center gap-3 pl-2 pr-3">
      <button
        onClick={() => onToggle(row)}
        aria-pressed={row.checked}
        aria-label={row.checked ? `Treu ${row.name} del carro` : `Posa ${row.name} al carro`}
        className="flex flex-1 min-w-0 items-center gap-3 py-3 text-left"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
            row.checked ? "bg-brown border-brown text-card" : "border-ink bg-card"
          }`}
          aria-hidden
        >
          {row.checked && <Check size={20} strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-bold text-[1.05rem] ${row.checked ? "line-through text-ink/55" : ""}`}>
            {row.name}
          </span>
          {parts && <span className="block text-sm text-ink/70">{parts}</span>}
        </span>
        <span className={`shrink-0 font-bold tabular-nums ${row.checked ? "text-ink/55" : ""}`}>
          {formatQty(row.total, row.unit)}
        </span>
      </button>
      {onRemove && (
        <button
          onClick={() => onRemove(row.ids[0])}
          className="shrink-0 rounded p-1.5 text-ink/55 hover:text-danger hover:bg-danger/10"
          aria-label={`Esborra ${row.name}`}
        >
          <X size={18} aria-hidden />
        </button>
      )}
    </li>
  );
}

function AddItemForm({
  listId,
  isGroup,
  people,
  meId,
  ingredients,
  onAdded,
}: {
  listId: string;
  isGroup: boolean;
  people: Profile[];
  meId: string | null;
  ingredients: Ingredient[];
  onAdded: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>("unit");
  const [forUser, setForUser] = useState<string>(isGroup ? COMMON : meId ?? COMMON);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForUser(isGroup ? COMMON : meId ?? COMMON);
  }, [isGroup, meId]);

  function onName(v: string) {
    setName(v);
    const known = ingredients.find((i) => i.name.toLowerCase() === v.trim().toLowerCase());
    if (known) setUnit(known.unit);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const known = ingredients.find((i) => i.name.toLowerCase() === n.toLowerCase() && i.unit === unit);
    const q = qty.trim() ? Number(qty.replace(",", ".")) : null;
    await supabase()
      .from("shopping_list_items")
      .insert({
        list_id: listId,
        ingredient_id: known?.id ?? null,
        custom_name: known ? null : n,
        quantity: q && q > 0 ? q : null,
        unit: q && q > 0 ? unit : null,
        for_user_id: forUser === COMMON ? null : forUser,
        source: "manual",
      });
    setName("");
    setQty("");
    await onAdded();
    setBusy(false);
  }

  return (
    <form onSubmit={add} className="panel p-4 space-y-3">
      <h2 className="text-xl font-extrabold">Afegeix a la llista</h2>
      <datalist id="shop-ingredients">
        {[...new Set(ingredients.map((i) => i.name))].map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <input
        className="field"
        placeholder="Paper de cuina, llet..."
        aria-label="Què cal comprar"
        list="shop-ingredients"
        value={name}
        onChange={(e) => onName(e.target.value)}
        required
      />
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
        <input
          className="field text-right"
          placeholder="Quantitat (opcional)"
          aria-label="Quantitat"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <select className="field px-2" aria-label="Unitat" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
          {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
            <option key={u} value={u}>
              {UNIT_LABEL[u]}
            </option>
          ))}
        </select>
      </div>
      {isGroup && (
        <select className="field" aria-label="Per a qui és" value={forUser} onChange={(e) => setForUser(e.target.value)}>
          <option value={COMMON}>Comú, per a tothom</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              Per a {p.id === meId ? "mi" : p.display_name}
            </option>
          ))}
        </select>
      )}
      <button className="btn btn-primary w-full" disabled={busy}>
        <Plus size={18} aria-hidden /> Afegeix
      </button>
    </form>
  );
}
