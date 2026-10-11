"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Sheet from "@/components/Sheet";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import { euro, shrinkImage } from "@/lib/image";
import { totalsByPerson } from "@/lib/split";
import type { Group, Profile } from "@/lib/types";

type ReceiptRow = {
  id: string;
  store_name: string | null;
  purchased_at: string | null;
  total: number | null;
  group_id: string | null;
  is_confirmed: boolean;
  groups: { name: string } | null;
  receipt_lines: { amount: number; receipt_line_payers: { user_id: string; share: number }[] }[];
};

type ListLite = { id: string; name: string; group_id: string | null; is_done: boolean };

const MONTHS = ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."];
const shortDate = (d: string | null) => {
  if (!d) return "";
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]}`;
};

export default function TiquetsPage() {
  const { me } = useMe();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [people, setPeople] = useState<Map<string, string>>(new Map());
  const [groups, setGroups] = useState<Group[]>([]);
  const [lists, setLists] = useState<ListLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const [r, g, l, gm] = await Promise.all([
        sb
          .from("receipts")
          .select(
            "id, store_name, purchased_at, total, group_id, is_confirmed, groups(name), receipt_lines(amount, receipt_line_payers(user_id, share))",
          )
          .order("purchased_at", { ascending: false })
          .order("created_at", { ascending: false }),
        sb.from("groups").select("id, name, invite_code, created_by").order("created_at"),
        sb.from("shopping_lists").select("id, name, group_id, is_done").order("created_at", { ascending: false }),
        sb.from("group_members").select("user_id, profiles(id, display_name)"),
      ]);
      setReceipts((r.data as ReceiptRow[]) ?? []);
      setGroups((g.data as Group[]) ?? []);
      setLists((l.data as ListLite[]) ?? []);
      const map = new Map<string, string>();
      ((gm.data ?? []) as { user_id: string; profiles: Profile | null }[]).forEach((m) => {
        if (m.profiles) map.set(m.user_id, m.profiles.display_name);
      });
      setPeople(map);
      setLoading(false);
    })();
  }, []);

  const nameOf = (id: string) => (id === me?.id ? "Tu" : people.get(id) ?? "Algú");

  return (
    <>
      <PageHeader
        title="Tiquets"
        intro="Fes una foto del tiquet, l'app en llegeix les línies i les relaciona amb la llista. Després decidiu qui paga cada cosa."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Camera size={20} aria-hidden /> Nou tiquet
          </button>
        }
      />

      {loading ? (
        <p className="text-ink/70">Carregant tiquets...</p>
      ) : receipts.length === 0 ? (
        <div className="panel p-6 max-w-xl">
          <h2 className="text-2xl font-extrabold">Encara no hi ha cap tiquet</h2>
          <p className="mt-2">En sortir del súper, fes-li una foto i en un moment sabreu quant paga cadascú.</p>
          <button className="btn btn-primary mt-5" onClick={() => setCreating(true)}>
            <Camera size={20} aria-hidden /> Fes la foto del tiquet
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {receipts.map((r) => {
            const totals = totalsByPerson(
              r.receipt_lines.map((l) => ({ amount: l.amount, payers: l.receipt_line_payers })),
            );
            const linesTotal = r.receipt_lines.reduce((a, l) => a + Number(l.amount), 0);
            return (
              <li key={r.id}>
                <Link href={`/tiquets/${r.id}`} className="block h-full rounded-2xl border-2 border-line bg-card hover:border-ink p-4">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-xl font-bold leading-tight">{r.store_name || "Tiquet"}</span>
                    <span className="font-display text-xl font-bold tabular-nums">
                      {euro.format(r.total ?? linesTotal)}
                    </span>
                  </span>
                  <span className="block mt-1 text-[0.95rem] text-ink/75">
                    {shortDate(r.purchased_at)}
                    {r.groups ? `, grup ${r.groups.name}` : ", només meu"}
                    {!r.is_confirmed && <span className="font-bold text-brown">, per revisar</span>}
                  </span>
                  {totals.size > 0 && (
                    <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                      {[...totals].map(([u, v]) => (
                        <span key={u} className="text-[0.95rem]">
                          {nameOf(u)} <b className="tabular-nums">{euro.format(v)}</b>
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={creating} title="Nou tiquet" onClose={() => setCreating(false)}>
        {creating && <NewReceipt groups={groups} lists={lists} />}
      </Sheet>
    </>
  );
}

function NewReceipt({ groups, lists }: { groups: Group[]; lists: ListLite[] }) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const groupLists = useMemo(
    () => lists.filter((l) => (l.group_id ?? "") === groupId).sort((a, b) => Number(a.is_done) - Number(b.is_done)),
    [lists, groupId],
  );
  const [listId, setListId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListId(groupLists.find((l) => !l.is_done)?.id ?? "");
  }, [groupLists]);

  function pick(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function create(withPhoto: boolean) {
    setError(null);
    const sb = supabase();
    setStatus("Creant el tiquet...");
    const { data: receipt, error } = await sb
      .from("receipts")
      .insert({ group_id: groupId || null, shopping_list_id: listId || null })
      .select("id")
      .single();
    if (error || !receipt) {
      setStatus(null);
      return setError("No s'ha pogut crear el tiquet.");
    }

    if (withPhoto && file) {
      setStatus("Pujant la foto...");
      const blob = await shrinkImage(file);
      const path = `${receipt.id}/tiquet.jpg`;
      const up = await sb.storage.from("receipts").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) {
        setStatus(null);
        return setError("No s'ha pogut pujar la foto. Torna-ho a provar.");
      }
      await sb.from("receipts").update({ image_path: path }).eq("id", receipt.id);

      setStatus("Llegint el tiquet. Pot trigar uns segons...");
      const res = await fetch("/api/receipts/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: receipt.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // El tiquet ja existeix amb la foto: obrim l'editor perquè es pugui omplir a mà
        router.push(`/tiquets/${receipt.id}?avis=${encodeURIComponent(body.error ?? "No s'ha pogut llegir el tiquet.")}`);
        return;
      }
    }
    router.push(`/tiquets/${receipt.id}`);
  }

  const busy = status !== null;

  return (
    <div className="space-y-5">
      <div>
        <span className="label">Foto del tiquet</span>
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer ${
            preview ? "border-ink bg-paper" : "border-line hover:border-ink"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Foto del tiquet" className="max-h-56 rounded-lg object-contain" />
          ) : (
            <>
              <ImagePlus size={34} aria-hidden className="text-brown" />
              <span className="font-bold">Fes una foto o tria-la de la galeria</span>
              <span className="text-sm text-ink/70">Que es vegi tot el tiquet, recte i amb llum.</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>
        {preview && (
          <button type="button" className="btn btn-ghost mt-1 px-0" onClick={() => pick(null)} disabled={busy}>
            Canvia la foto
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="r-group">
            Qui l&apos;ha de pagar
          </label>
          <select id="r-group" className="field" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                Grup {g.name}
              </option>
            ))}
            <option value="">Només jo</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-list">
            Llista de la compra
          </label>
          <select id="r-list" className="field" value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">Cap llista</option>
            {groupLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.is_done ? " (feta)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="font-bold text-brown">
          {status}
        </p>
      )}

      <div className="space-y-2">
        <button className="btn btn-primary w-full" disabled={!file || busy} onClick={() => create(true)}>
          <Camera size={18} aria-hidden /> Llegeix el tiquet
        </button>
        <button className="btn btn-ghost w-full" disabled={busy} onClick={() => create(false)}>
          <Plus size={18} aria-hidden /> Sense foto, l&apos;entro a mà
        </button>
      </div>
    </div>
  );
}
