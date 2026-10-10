"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { addDays, toKey } from "@/lib/dates";
import { formatRange } from "@/lib/format";
import { progress } from "@/lib/shopping";
import type { Group } from "@/lib/types";

type ListRow = {
  id: string;
  name: string;
  group_id: string | null;
  date_from: string | null;
  date_to: string | null;
  is_done: boolean;
  created_at: string;
  groups: { name: string } | null;
  shopping_list_items: { checked: boolean; ingredient_id: string | null; custom_name: string | null; unit: string | null }[];
};

export default function CompraPage() {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    const sb = supabase();
    const [l, g] = await Promise.all([
      sb
        .from("shopping_lists")
        .select("id, name, group_id, date_from, date_to, is_done, created_at, groups(name), shopping_list_items(checked, ingredient_id, custom_name, unit)")
        .order("created_at", { ascending: false }),
      sb.from("groups").select("id, name, invite_code, created_by").order("created_at"),
    ]);
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
        {creating && <NewListForm groups={groups} />}
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
                  {l.groups ? `Del grup ${l.groups.name}` : "Només meva"}
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

function NewListForm({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const [name, setName] = useState("Compra de la setmana");
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .insert({ name: name.trim(), group_id: groupId || null, date_from: from, date_to: to })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return setError("No s'ha pogut crear la llista.");
    }
    await sb.rpc("generate_shopping_list_items", { p_list_id: data.id });
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
          <Choice checked={groupId === ""} onChange={() => setGroupId("")} title="Només per a mi" text="Surt només del teu calendari." />
          {groups.map((g) => (
            <Choice
              key={g.id}
              checked={groupId === g.id}
              onChange={() => setGroupId(g.id)}
              title={`Per al grup ${g.name}`}
              text="Ajunta el calendari de tothom i marca de qui és cada cosa."
            />
          ))}
        </div>
      </fieldset>

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
