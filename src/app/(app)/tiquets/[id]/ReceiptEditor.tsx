"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ImageIcon, Link2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import { euro } from "@/lib/image";
import { itemKey } from "@/lib/shopping";
import { proposePayers, totalsByPerson, type ItemPart } from "@/lib/split";
import type { Profile } from "@/lib/types";

type Receipt = {
  id: string;
  uploaded_by: string;
  group_id: string | null;
  shopping_list_id: string | null;
  store_name: string | null;
  purchased_at: string | null;
  total: number | null;
  image_path: string | null;
  is_confirmed: boolean;
  shopping_lists: { name: string; subgroup_id: string | null } | null;
};

type Payer = { user_id: string; share: number };

type Line = {
  id: string;
  description: string;
  quantity: number | null;
  amount: number;
  position: number;
  matched_item_ids: string[];
  receipt_line_payers: Payer[];
};

type ListItem = {
  id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  for_user_id: string | null;
  for_subgroup_id: string | null;
  ingredients: { name: string } | null;
};

type Product = { key: string; name: string; ids: string[]; parts: ItemPart[] };

const parseAmount = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

export default function ReceiptEditor() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { me } = useMe();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [editing, setEditing] = useState<Line | "new" | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const avis = search.get("avis");
    if (avis) setNotice({ text: `${avis} Pots afegir les línies a mà.`, error: true });
  }, [search]);

  const loadLines = useCallback(async () => {
    const { data } = await supabase()
      .from("receipt_lines")
      .select("id, description, quantity, amount, position, matched_item_ids, receipt_line_payers(user_id, share)")
      .eq("receipt_id", id)
      .order("position");
    setLines((data as Line[]) ?? []);
  }, [id]);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const sb = supabase();
      const { data: r } = await sb
        .from("receipts")
        .select(
          "id, uploaded_by, group_id, shopping_list_id, store_name, purchased_at, total, image_path, is_confirmed, shopping_lists(name, subgroup_id)",
        )
        .eq("id", id)
        .maybeSingle();
      if (!r) return setNotFound(true);
      setReceipt(r as Receipt);
      await loadLines();

      if (r.group_id) {
        const { data: gm } = await sb
          .from("group_members")
          .select("user_id, profiles(id, display_name)")
          .eq("group_id", r.group_id);
        let ps = ((gm ?? []) as { profiles: Profile | null }[]).map((m) => m.profiles).filter((p): p is Profile => !!p);
        // Tiquet d'una llista d'un subgrup: només paga la gent del subgrup
        const subgroupId = (r as Receipt).shopping_lists?.subgroup_id;
        if (subgroupId) {
          const { data: sm } = await sb.from("subgroup_members").select("user_id").eq("subgroup_id", subgroupId);
          const ids = new Set((sm ?? []).map((m: { user_id: string }) => m.user_id));
          ps = ps.filter((p) => ids.has(p.id));
        }
        ps.sort((a, b) => Number(b.id === me.id) - Number(a.id === me.id));
        setPeople(ps);
      } else {
        setPeople([me]);
      }

      if (r.shopping_list_id) {
        const { data: items } = await sb
          .from("shopping_list_items")
          .select("id, ingredient_id, custom_name, quantity, unit, for_user_id, for_subgroup_id, ingredients(name)")
          .eq("list_id", r.shopping_list_id);
        // Gent de cada subgrup, per repartir el que és d'un subgrup (el menjar del gos)
        const subIds = [...new Set(((items ?? []) as ListItem[]).map((i) => i.for_subgroup_id).filter(Boolean))] as string[];
        const subMembers = new Map<string, string[]>();
        if (subIds.length) {
          const { data: sm } = await sb.from("subgroup_members").select("subgroup_id, user_id").in("subgroup_id", subIds);
          for (const m of (sm ?? []) as { subgroup_id: string; user_id: string }[]) {
            subMembers.set(m.subgroup_id, [...(subMembers.get(m.subgroup_id) ?? []), m.user_id]);
          }
        }
        const byKey = new Map<string, Product>();
        for (const i of (items ?? []) as ListItem[]) {
          const k = itemKey(i);
          const p = byKey.get(k) ?? { key: k, name: i.ingredients?.name ?? i.custom_name ?? "", ids: [], parts: [] };
          p.ids.push(i.id);
          p.parts.push({
            for_user_id: i.for_user_id,
            quantity: i.quantity,
            subgroup_members: i.for_subgroup_id ? subMembers.get(i.for_subgroup_id) ?? [] : null,
          });
          byKey.set(k, p);
        }
        setProducts([...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "ca")));
      }

      if (r.image_path) {
        const { data: signed } = await sb.storage.from("receipts").createSignedUrl(r.image_path, 3600);
        setPhotoUrl(signed?.signedUrl ?? null);
      }
    })();
  }, [id, me, loadLines]);

  const memberIds = useMemo(() => people.map((p) => p.id), [people]);
  const nameOf = useCallback(
    (uid: string) => (uid === me?.id ? "Tu" : people.find((p) => p.id === uid)?.display_name ?? "Algú"),
    [people, me],
  );

  const totals = useMemo(
    () => totalsByPerson(lines.map((l) => ({ amount: l.amount, payers: l.receipt_line_payers }))),
    [lines],
  );
  const linesTotal = lines.reduce((a, l) => a + Number(l.amount), 0);
  const unassigned = lines.filter((l) => l.receipt_line_payers.length === 0);
  const diff = receipt?.total != null ? Math.round((Number(receipt.total) - linesTotal) * 100) / 100 : 0;

  const productNames = useCallback(
    (ids: string[]) => products.filter((p) => p.ids.some((i) => ids.includes(i))).map((p) => p.name),
    [products],
  );

  // ---- Escriptures ----

  async function setPayers(line: Line, payers: Payer[]) {
    setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, receipt_line_payers: payers } : l)));
    const sb = supabase();
    await sb.from("receipt_line_payers").delete().eq("line_id", line.id);
    if (payers.length) await sb.from("receipt_line_payers").insert(payers.map((p) => ({ ...p, line_id: line.id })));
  }

  function togglePayer(line: Line, uid: string) {
    const current = line.receipt_line_payers.map((p) => p.user_id);
    const next = current.includes(uid) ? current.filter((u) => u !== uid) : [...current, uid];
    setPayers(line, next.map((u) => ({ user_id: u, share: 1 })));
  }

  function everyone(line: Line) {
    setPayers(line, memberIds.map((u) => ({ user_id: u, share: 1 })));
  }

  async function updateReceipt(patch: Partial<Receipt>) {
    setReceipt((r) => (r ? { ...r, ...patch } : r));
    await supabase().from("receipts").update(patch).eq("id", id);
  }

  async function rescan() {
    if (lines.length && !confirm("Es tornarà a llegir la foto i es perdran els canvis fets a les línies. Vols continuar?")) return;
    setScanning(true);
    setNotice(null);
    const res = await fetch("/api/receipts/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptId: id }),
    });
    const body = await res.json().catch(() => ({}));
    setScanning(false);
    if (!res.ok) return setNotice({ text: body.error ?? "No s'ha pogut llegir el tiquet.", error: true });
    const { data: r } = await supabase().from("receipts").select("store_name, purchased_at, total").eq("id", id).single();
    if (r) setReceipt((cur) => (cur ? { ...cur, ...r } : cur));
    await loadLines();
    setNotice({ text: `S'han llegit ${body.lines} línies.` });
  }

  async function confirmReceipt() {
    if (unassigned.length && !confirm(`Hi ha ${unassigned.length} línies sense ningú que les pagui. Vols desar-lo igualment?`)) return;
    const sb = supabase();
    await updateReceipt({ is_confirmed: true });
    const matched = [...new Set(lines.flatMap((l) => l.matched_item_ids))];
    if (matched.length) await sb.from("shopping_list_items").update({ checked: true }).in("id", matched);
    setNotice({
      text: matched.length ? "Tiquet desat. Els productes relacionats s'han marcat com a comprats a la llista." : "Tiquet desat.",
    });
  }

  async function deleteReceipt() {
    if (!confirm("Vols esborrar aquest tiquet i la seva foto?")) return;
    const sb = supabase();
    if (receipt?.image_path) await sb.storage.from("receipts").remove([receipt.image_path]);
    await sb.from("receipts").delete().eq("id", id);
    router.push("/tiquets");
  }

  if (notFound) {
    return (
      <div className="panel p-6 max-w-xl">
        <h1 className="text-3xl font-extrabold">No trobem aquest tiquet</h1>
        <p className="mt-2">Potser s&apos;ha esborrat o ja no formes part del grup.</p>
        <Link href="/tiquets" className="btn btn-primary mt-5">
          Torna als tiquets
        </Link>
      </div>
    );
  }
  if (!receipt) return <p className="text-ink/70">Carregant el tiquet...</p>;

  return (
    <>
      <Link href="/tiquets" className="btn btn-ghost -ml-3 mb-2">
        <ChevronLeft size={20} aria-hidden /> Tiquets
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <input
            className="block w-full max-w-xl bg-transparent font-display text-[2.1rem] sm:text-5xl font-extrabold tracking-[-0.02em] leading-tight border-b-2 border-transparent hover:border-line focus:border-ink focus:outline-none"
            value={receipt.store_name ?? ""}
            placeholder="Nom de la botiga"
            aria-label="Nom de la botiga"
            onChange={(e) => setReceipt({ ...receipt, store_name: e.target.value })}
            onBlur={(e) => updateReceipt({ store_name: e.target.value.trim() || null })}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-ink/75">
            <input
              type="date"
              className="bg-transparent font-bold text-ink"
              aria-label="Data de la compra"
              value={receipt.purchased_at ?? ""}
              onChange={(e) => updateReceipt({ purchased_at: e.target.value || null })}
            />
            {receipt.shopping_lists && (
              <Link href={`/compra/${receipt.shopping_list_id}`} className="font-bold text-brown underline underline-offset-4">
                {receipt.shopping_lists.name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {photoUrl && (
            <button className="btn btn-outline" onClick={() => setShowPhoto(true)}>
              <ImageIcon size={18} aria-hidden /> Foto
            </button>
          )}
          {receipt.image_path && (
            <button className="btn btn-outline" onClick={rescan} disabled={scanning}>
              <RefreshCw size={18} aria-hidden className={scanning ? "animate-spin" : ""} />
              {scanning ? "Llegint..." : lines.length ? "Torna a llegir" : "Llegeix el tiquet"}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className={`mb-5 font-bold ${notice.error ? "text-danger" : "text-brown"}`}>
          {notice.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] items-start pb-14 lg:pb-0">
        {/* Línies del tiquet */}
        <div className="min-w-0 space-y-3">
          {lines.length === 0 && !scanning && (
            <div className="panel p-5">
              <h2 className="text-2xl font-extrabold">Encara no hi ha línies</h2>
              <p className="mt-1">
                {receipt.image_path
                  ? "Prem \"Llegeix el tiquet\" o afegeix les línies a mà."
                  : "Afegeix cada producte del tiquet amb el seu preu."}
              </p>
            </div>
          )}
          {scanning && lines.length === 0 && <p className="font-bold text-brown">Llegint el tiquet...</p>}

          {lines.length > 0 && (
            <ul className="panel overflow-hidden divide-y-2 divide-line">
              {lines.map((l) => (
                <LineRow
                  key={l.id}
                  line={l}
                  people={people}
                  nameOf={nameOf}
                  matchedNames={productNames(l.matched_item_ids)}
                  onToggle={(uid) => togglePayer(l, uid)}
                  onEveryone={() => everyone(l)}
                  onEdit={() => setEditing(l)}
                />
              ))}
            </ul>
          )}

          <button className="btn btn-outline" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden /> Afegeix una línia
          </button>
        </div>

        {/* Resum */}
        <aside className="lg:sticky lg:top-6 space-y-4">
          <section className="rounded-2xl bg-ink text-paper p-5">
            <h2 className="text-2xl font-extrabold">Qui paga què</h2>
            {totals.size === 0 ? (
              <p className="mt-2 text-paper/80">Tria qui paga cada línia i aquí veureu la suma.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {people
                  .filter((p) => totals.has(p.id))
                  .map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3">
                      <span className="text-lg font-bold">{nameOf(p.id)}</span>
                      <span className="font-display text-3xl font-extrabold tabular-nums">
                        {euro.format(totals.get(p.id)!)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-4 pt-3 border-t border-paper/25 space-y-1 text-[0.95rem]">
              <p className="flex justify-between gap-3">
                <span>Suma de les línies</span>
                <b className="tabular-nums">{euro.format(linesTotal)}</b>
              </p>
              <label className="flex items-center justify-between gap-3">
                <span>Total del tiquet</span>
                <input
                  className="w-28 rounded-md bg-paper text-ink text-right font-bold px-2 py-1 tabular-nums"
                  inputMode="decimal"
                  aria-label="Total del tiquet"
                  defaultValue={receipt.total != null ? String(receipt.total).replace(".", ",") : ""}
                  key={receipt.total ?? "buit"}
                  onBlur={(e) => {
                    const v = parseAmount(e.target.value);
                    updateReceipt({ total: e.target.value.trim() && !Number.isNaN(v) ? v : null });
                  }}
                />
              </label>
            </div>
          </section>

          {receipt.total != null && Math.abs(diff) >= 0.01 && (
            <p className="rounded-xl border-2 border-danger bg-card p-3 font-bold text-danger">
              Les línies sumen {euro.format(linesTotal)} i el tiquet diu {euro.format(Number(receipt.total))}. Hi ha{" "}
              {euro.format(Math.abs(diff))} {diff > 0 ? "que falten" : "de més"}. Revisa-ho amb la foto.
            </p>
          )}
          {unassigned.length > 0 && (
            <p className="rounded-xl border-2 border-brown bg-card p-3 font-bold text-brown">
              {unassigned.length === 1 ? "Hi ha 1 línia" : `Hi ha ${unassigned.length} línies`} sense ningú que la pagui.
            </p>
          )}

          <button className="btn btn-primary w-full" onClick={confirmReceipt}>
            <Check size={18} aria-hidden /> {receipt.is_confirmed ? "Desat. Torna a desar" : "Desa el tiquet"}
          </button>
          {receipt.uploaded_by === me?.id && (
            <button className="btn btn-ghost text-danger" onClick={deleteReceipt}>
              <Trash2 size={18} aria-hidden /> Esborra el tiquet
            </button>
          )}
        </aside>
      </div>

      {/* Mòbil i iPad: la suma sempre a la vista mentre es trien les persones */}
      {totals.size > 0 && (
        <div
          className="lg:hidden fixed inset-x-0 md:left-24 bottom-[calc(68px+env(safe-area-inset-bottom))] md:bottom-0 z-10 bg-brown text-card md:pb-[env(safe-area-inset-bottom)]"
          aria-live="polite"
        >
          <div className="flex gap-5 overflow-x-auto px-4 py-2.5 whitespace-nowrap">
            {people
              .filter((p) => totals.has(p.id))
              .map((p) => (
                <span key={p.id} className="text-[0.95rem]">
                  {nameOf(p.id)} <b className="font-display text-lg tabular-nums">{euro.format(totals.get(p.id)!)}</b>
                </span>
              ))}
          </div>
        </div>
      )}

      <Sheet open={showPhoto} title="Foto del tiquet" onClose={() => setShowPhoto(false)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photoUrl && <img src={photoUrl} alt="Foto del tiquet" className="w-full rounded-lg" />}
      </Sheet>

      <Sheet
        open={editing !== null}
        title={editing === "new" ? "Nova línia" : "Edita la línia"}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <LineEditor
            key={editing === "new" ? "new" : editing.id}
            line={editing === "new" ? null : editing}
            receiptId={id}
            nextPosition={lines.length ? Math.max(...lines.map((l) => l.position)) + 1 : 0}
            products={products}
            members={memberIds}
            isGroup={!!receipt.group_id}
            meId={me?.id ?? null}
            onDone={async () => {
              setEditing(null);
              await loadLines();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function LineRow({
  line,
  people,
  nameOf,
  matchedNames,
  onToggle,
  onEveryone,
  onEdit,
}: {
  line: Line;
  people: Profile[];
  nameOf: (id: string) => string;
  matchedNames: string[];
  onToggle: (uid: string) => void;
  onEveryone: () => void;
  onEdit: () => void;
}) {
  const payerIds = line.receipt_line_payers.map((p) => p.user_id);
  const shares = line.receipt_line_payers.map((p) => Number(p.share));
  const proportional = shares.length > 1 && shares.some((s) => Math.abs(s - shares[0]) > 0.001);
  const sum = shares.reduce((a, b) => a + b, 0);
  const allSelected = people.length > 1 && people.every((p) => payerIds.includes(p.id));
  const negative = Number(line.amount) < 0;

  return (
    <li className={`p-4 ${payerIds.length === 0 ? "bg-paper" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[1.05rem] leading-snug first-letter:uppercase">
            {line.description}
            {line.quantity != null && Number(line.quantity) !== 1 && (
              <span className="font-normal text-ink/70"> ×{Number(line.quantity)}</span>
            )}
          </p>
          {matchedNames.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-ink/70">
              <Link2 size={14} aria-hidden /> {matchedNames.join(", ")}
            </p>
          )}
        </div>
        <span className={`shrink-0 font-display text-xl font-bold tabular-nums ${negative ? "text-brown" : ""}`}>
          {euro.format(Number(line.amount))}
        </span>
        <button className="shrink-0 rounded-md p-1.5 text-ink/60 hover:text-ink hover:bg-paper" onClick={onEdit} aria-label={`Edita ${line.description}`}>
          <Pencil size={17} aria-hidden />
        </button>
      </div>

      {people.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Qui paga ${line.description}`}>
          {people.map((p) => {
            const on = payerIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                aria-pressed={on}
                className={`min-h-9 rounded-full border-2 px-3.5 text-sm font-bold ${
                  on ? "bg-brown border-brown text-card" : "border-line bg-card text-ink hover:border-ink"
                }`}
              >
                {nameOf(p.id)}
              </button>
            );
          })}
          <button
            onClick={onEveryone}
            aria-pressed={allSelected && !proportional}
            className={`min-h-9 rounded-full border-2 px-3.5 text-sm font-bold ${
              allSelected && !proportional ? "bg-ink border-ink text-paper" : "border-ink text-ink hover:bg-paper"
            }`}
          >
            Tots a parts iguals
          </button>
        </div>
      ) : null}

      {proportional && (
        <p className="mt-2 text-sm text-ink/75">
          Segons la llista:{" "}
          {line.receipt_line_payers
            .map((p) => `${nameOf(p.user_id)} ${Math.round((Number(p.share) / sum) * 100)}%`)
            .join(", ")}
        </p>
      )}
      {payerIds.length === 0 && people.length > 1 && <p className="mt-2 text-sm font-bold text-brown">Tria qui la paga</p>}
    </li>
  );
}

function LineEditor({
  line,
  receiptId,
  nextPosition,
  products,
  members,
  isGroup,
  meId,
  onDone,
}: {
  line: Line | null;
  receiptId: string;
  nextPosition: number;
  products: Product[];
  members: string[];
  isGroup: boolean;
  meId: string | null;
  onDone: () => void;
}) {
  const [description, setDescription] = useState(line?.description ?? "");
  const [amount, setAmount] = useState(line ? String(line.amount).replace(".", ",") : "");
  const [quantity, setQuantity] = useState(line?.quantity != null ? String(line.quantity).replace(".", ",") : "1");
  const initialKey = products.find((p) => p.ids.some((i) => line?.matched_item_ids.includes(i)))?.key ?? "";
  const [productKey, setProductKey] = useState(initialKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const a = parseAmount(amount);
    if (Number.isNaN(a)) return setError("Escriu un import vàlid, per exemple 2,35.");
    const q = parseAmount(quantity);
    setBusy(true);
    const sb = supabase();
    const product = products.find((p) => p.key === productKey);
    const matchChanged = productKey !== initialKey;
    const fields = {
      description: description.trim(),
      amount: Math.round(a * 100) / 100,
      quantity: Number.isNaN(q) || q <= 0 ? 1 : q,
      matched_item_ids: product ? product.ids : matchChanged ? [] : line?.matched_item_ids ?? [],
    };

    let lineId = line?.id;
    if (lineId) {
      await sb.from("receipt_lines").update(fields).eq("id", lineId);
    } else {
      const { data, error } = await sb
        .from("receipt_lines")
        .insert({ ...fields, receipt_id: receiptId, position: nextPosition })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        return setError("No s'ha pogut desar la línia.");
      }
      lineId = data.id;
    }

    // Si canvia el producte relacionat (o és una línia nova), es torna a proposar qui paga
    if (!line || matchChanged) {
      let payers: { user_id: string; share: number }[] = [];
      if (product) payers = [...proposePayers(product.parts, members)].map(([user_id, share]) => ({ user_id, share }));
      else if (!isGroup && meId) payers = [{ user_id: meId, share: 1 }];
      if (line) await sb.from("receipt_line_payers").delete().eq("line_id", lineId);
      if (payers.length) await sb.from("receipt_line_payers").insert(payers.map((p) => ({ ...p, line_id: lineId })));
    }
    onDone();
  }

  async function remove() {
    if (!line) return;
    setBusy(true);
    await supabase().from("receipt_lines").delete().eq("id", line.id);
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label className="label" htmlFor="l-desc">
          Producte
        </label>
        <input id="l-desc" className="field" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="l-qty">
            Quantitat
          </label>
          <input
            id="l-qty"
            className="field text-right"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="l-amount">
            Import (€)
          </label>
          <input
            id="l-amount"
            className="field text-right font-bold"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="mt-1 text-sm text-ink/70">Els descomptes, amb un menys davant.</p>
        </div>
      </div>
      {products.length > 0 && (
        <div>
          <label className="label" htmlFor="l-match">
            És de la llista
          </label>
          <select id="l-match" className="field" value={productKey} onChange={(e) => setProductKey(e.target.value)}>
            <option value="">No és de la llista</option>
            {products.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
          {isGroup && (
            <p className="mt-1 text-sm text-ink/70">
              En triar-lo, es proposa qui paga segons per a qui era a la llista. Després ho pots canviar.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2 pt-1">
        {line ? (
          <button type="button" className="btn btn-ghost text-danger" onClick={remove} disabled={busy}>
            <Trash2 size={18} aria-hidden /> Esborra
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Desant..." : "Desa la línia"}
        </button>
      </div>
    </form>
  );
}
