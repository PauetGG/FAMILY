"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/UserProvider";
import type { Group, Profile } from "@/lib/types";

type Member = { group_id: string; user_id: string; role: "owner" | "member"; profiles: Profile | null };
type ShareLevel = "none" | "view" | "edit";

export default function GrupPage() {
  const { me, refresh } = useMe();
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [shares, setShares] = useState<Map<string, ShareLevel>>(new Map());
  const [name, setName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  async function load() {
    if (!me) return;
    const sb = supabase();
    const [g, m, s] = await Promise.all([
      sb.from("groups").select("id, name, invite_code, created_by").order("created_at"),
      sb.from("group_members").select("group_id, user_id, role, profiles(id, display_name)"),
      sb.from("diet_shares").select("shared_with_id, can_edit").eq("owner_id", me.id),
    ]);
    setGroups((g.data as Group[]) ?? []);
    setMembers((m.data as Member[]) ?? []);
    const map = new Map<string, ShareLevel>();
    (s.data ?? []).forEach((r: { shared_with_id: string; can_edit: boolean }) =>
      map.set(r.shared_with_id, r.can_edit ? "edit" : "view"),
    );
    setShares(map);
  }

  useEffect(() => {
    if (me) {
      setName(me.display_name);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const mates = useMemo(() => {
    const seen = new Map<string, Profile>();
    members.forEach((m) => {
      if (m.user_id !== me?.id && m.profiles) seen.set(m.user_id, m.profiles);
    });
    return [...seen.values()];
  }, [members, me]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    await supabase().from("profiles").update({ display_name: name.trim() }).eq("id", me.id);
    await refresh();
    setMsg({ text: "Nom desat." });
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().from("groups").insert({ name: newGroup.trim() });
    if (error) return setMsg({ text: "No s'ha pogut crear el grup.", error: true });
    setNewGroup("");
    setMsg({ text: "Grup creat. Comparteix el codi perquè s'hi uneixin." });
    await load();
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().rpc("join_group", { p_code: code });
    if (error) return setMsg({ text: "Aquest codi no correspon a cap grup.", error: true });
    setCode("");
    setMsg({ text: "Ja formes part del grup." });
    await load();
  }

  async function leaveGroup(g: Group) {
    if (!me || !confirm(`Vols sortir de "${g.name}"?`)) return;
    await supabase().from("group_members").delete().eq("group_id", g.id).eq("user_id", me.id);
    await load();
  }

  async function setShare(userId: string, level: ShareLevel) {
    if (!me) return;
    const sb = supabase();
    if (level === "none") {
      await sb.from("diet_shares").delete().eq("owner_id", me.id).eq("shared_with_id", userId);
    } else {
      await sb
        .from("diet_shares")
        .upsert({ owner_id: me.id, shared_with_id: userId, can_edit: level === "edit" });
    }
    setShares((s) => new Map(s).set(userId, level));
  }

  async function signOut() {
    await supabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <PageHeader
        title="Grup"
        intro="La gent amb qui compartiu llistes i tiquets. Cadascú té la seva dieta, i tu decideixes qui la pot veure."
      />

      {msg && (
        <p role="status" className={`mb-5 font-bold ${msg.error ? "text-danger" : "text-brown"}`}>
          {msg.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="space-y-6">
          {groups.length === 0 && (
            <div className="panel p-5">
              <h2 className="text-2xl font-extrabold">Encara no tens grup</h2>
              <p className="mt-1">Crea&apos;n un per al pis o entra al d&apos;algú altre amb el seu codi.</p>
            </div>
          )}

          {groups.map((g) => {
            const gm = members.filter((m) => m.group_id === g.id);
            return (
              <section key={g.id} className="panel overflow-hidden">
                <div className="bg-ink text-paper px-5 py-4 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-3xl font-extrabold">{g.name}</h2>
                  <p className="text-sm">
                    Codi per entrar{" "}
                    <span className="ml-1 font-display text-2xl font-bold tracking-[0.12em] select-all">
                      {g.invite_code}
                    </span>
                  </p>
                </div>
                <ul className="divide-y-2 divide-line">
                  {gm.map((m) => (
                    <li key={m.user_id} className="px-5 py-3 flex justify-between gap-3">
                      <span className="font-bold">
                        {m.profiles?.display_name || "Sense nom"}
                        {m.user_id === me?.id && <span className="font-normal text-ink/70"> (tu)</span>}
                      </span>
                      {m.role === "owner" && <span className="text-brown font-bold">Administra</span>}
                    </li>
                  ))}
                </ul>
                <div className="px-5 pb-4">
                  <button className="btn btn-ghost text-danger px-0" onClick={() => leaveGroup(g)}>
                    Surt del grup
                  </button>
                </div>
              </section>
            );
          })}

          <div className="grid gap-4 sm:grid-cols-2">
            <form onSubmit={createGroup} className="panel p-5 space-y-3">
              <h2 className="text-xl font-extrabold">Crea un grup</h2>
              <input
                className="field"
                placeholder="Per exemple, El pis"
                aria-label="Nom del grup"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                required
              />
              <button className="btn btn-primary w-full">
                <Plus size={18} aria-hidden /> Crea el grup
              </button>
            </form>
            <form onSubmit={joinGroup} className="panel p-5 space-y-3">
              <h2 className="text-xl font-extrabold">Entra amb un codi</h2>
              <input
                className="field tracking-[0.12em] font-bold"
                placeholder="abc12345"
                aria-label="Codi del grup"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoCapitalize="none"
                required
              />
              <button className="btn btn-outline w-full">Entra al grup</button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <section className="panel p-5">
            <h2 className="text-2xl font-extrabold">Qui pot veure el meu calendari</h2>
            {mates.length === 0 ? (
              <p className="mt-2 text-ink/75">Quan hi hagi més gent als teus grups, podràs triar aquí qui veu la teva dieta.</p>
            ) : (
              <ul className="mt-3 divide-y-2 divide-line">
                {mates.map((p) => (
                  <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="font-bold">{p.display_name || "Sense nom"}</span>
                    <select
                      className="field w-auto"
                      aria-label={`Accés de ${p.display_name} al teu calendari`}
                      value={shares.get(p.id) ?? "none"}
                      onChange={(e) => setShare(p.id, e.target.value as ShareLevel)}
                    >
                      <option value="none">No el veu</option>
                      <option value="view">El pot veure</option>
                      <option value="edit">El pot editar</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={saveName} className="panel p-5 space-y-3">
            <h2 className="text-2xl font-extrabold">El teu nom</h2>
            <p className="text-ink/75">És el que veu la resta del grup a les llistes i als tiquets.</p>
            <div className="flex gap-2">
              <input
                className="field"
                aria-label="El teu nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <button className="btn btn-primary shrink-0">Desa</button>
            </div>
          </form>

          <button className="btn btn-outline" onClick={signOut}>
            <LogOut size={18} aria-hidden /> Tanca la sessió
          </button>
        </div>
      </div>
    </>
  );
}
