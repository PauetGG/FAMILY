"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { supabase } from "@/lib/supabase/client";

// S'hi arriba des de l'enllaç del correu "Restableix la contrasenya".
// /auth/confirm ja ha obert una sessió temporal; aquí es tria la contrasenya nova.
export default function NovaContrasenyaPage() {
  const [ready, setReady] = useState<"checking" | "ok" | "no">("checking");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getUser();
      setReady(data.user ? "ok" : "no");
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== repeat) return setError("Les dues contrasenyes no coincideixen.");
    if (password.length < 6) return setError("La contrasenya ha de tenir com a mínim 6 caràcters.");
    setBusy(true);
    const sb = supabase();
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setError(
        error.code === "same_password"
          ? "La contrasenya nova ha de ser diferent de l'anterior."
          : "No s'ha pogut canviar la contrasenya. Torna-ho a provar.",
      );
    }
    // Es tanca la sessió perquè entri amb la contrasenya nova
    await sb.auth.signOut();
    window.location.href = "/login?avis=contrasenya";
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm">
        {ready === "checking" && <p className="text-ink/70">Un moment...</p>}

        {ready === "no" && (
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold">L&apos;enllaç ha caducat</h2>
            <p>Demana&apos;n un de nou des de la pantalla d&apos;entrar, a &quot;L&apos;has oblidat?&quot;.</p>
            <Link href="/login" className="btn btn-primary w-full">
              Torna a entrar
            </Link>
          </div>
        )}

        {ready === "ok" && (
          <form onSubmit={save} className="space-y-5">
            <h2 className="text-3xl font-extrabold">Tria una contrasenya nova</h2>
            <div>
              <label className="label" htmlFor="pw1">
                Contrasenya nova
              </label>
              <input
                id="pw1"
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="pw2">
                Repeteix-la
              </label>
              <input
                id="pw2"
                type="password"
                className="field"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {error && (
              <p role="alert" className="font-bold text-danger">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Desant..." : "Desa la contrasenya"}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
