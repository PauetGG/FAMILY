"use client";

import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { supabase } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot";

const TITLE: Record<Mode, string> = {
  login: "Entra",
  signup: "Crea el teu compte",
  forgot: "Recupera la contrasenya",
};

const BUTTON: Record<Mode, string> = {
  login: "Entra",
  signup: "Crea el compte",
  forgot: "Envia'm l'enllaç",
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Missatges en tornar dels enllaços del correu (/auth/confirm i /nova-contrasenya)
  useEffect(() => {
    const avis = new URLSearchParams(window.location.search).get("avis");
    if (!avis) return;
    if (avis === "confirmat") {
      setNotice("Correu confirmat. Ja pots entrar amb el teu correu i la contrasenya.");
    } else if (avis === "contrasenya") {
      setNotice("Contrasenya canviada. Ja pots entrar amb la nova.");
    } else if (avis === "enllac") {
      setError("Aquest enllaç ja s'ha fet servir o ha caducat. Torna-ho a provar des d'aquí.");
    }
    window.history.replaceState(null, "", "/login");
  }, []);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const sb = supabase();

    if (mode === "forgot") {
      // Supabase no diu si el correu existeix; el missatge és el mateix en tots dos casos
      const { error } = await sb.auth.resetPasswordForEmail(email.trim());
      setBusy(false);
      if (error) {
        setError(
          error.status === 429
            ? "Ja t'hem enviat un correu fa poc. Espera un minut i torna-ho a provar."
            : "No s'ha pogut enviar el correu. Torna-ho a provar.",
        );
        return;
      }
      setNotice("Si aquest correu té un compte, t'hi hem enviat un enllaç per triar una contrasenya nova.");
      setMode("login");
      return;
    }

    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setError("El correu o la contrasenya no són correctes.");
        setBusy(false);
        return;
      }
      window.location.href = "/";
      return;
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("Password")
          ? "La contrasenya ha de tenir com a mínim 6 caràcters."
          : "No s'ha pogut crear el compte. Revisa el correu i torna-ho a provar.",
      );
      return;
    }
    if (data.session) {
      window.location.href = "/";
    } else {
      setNotice("T'hem enviat un correu de confirmació. Obre'l, prem el botó i tornaràs aquí per entrar.");
      setMode("login");
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <h2 className="text-3xl font-extrabold">{TITLE[mode]}</h2>

        {mode === "forgot" && (
          <p className="text-ink/75">Escriu el correu del teu compte i t&apos;enviarem un enllaç per triar-ne una de nova.</p>
        )}

        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">
              Nom
            </label>
            <input
              id="name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="email">
            Correu
          </label>
          <input
            id="email"
            type="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
          />
        </div>

        {mode !== "forgot" && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label className="label" htmlFor="password">
                Contrasenya
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  className="text-sm font-bold text-brown underline underline-offset-4"
                  onClick={() => switchTo("forgot")}
                >
                  L&apos;has oblidat?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>
        )}

        {error && (
          <p role="alert" className="font-bold text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="flex gap-2 rounded-xl border-2 border-brown bg-card p-3 font-bold text-brown">
            <CircleCheck size={22} className="shrink-0" aria-hidden />
            {notice}
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Un moment..." : BUTTON[mode]}
        </button>

        <p className="text-center">
          {mode === "login" ? (
            <>
              Encara no tens compte?{" "}
              <button type="button" className="font-bold text-brown underline underline-offset-4" onClick={() => switchTo("signup")}>
                Crea&apos;n un
              </button>
            </>
          ) : (
            <>
              {mode === "signup" ? "Ja tens compte?" : "Te'n recordes?"}{" "}
              <button type="button" className="font-bold text-brown underline underline-offset-4" onClick={() => switchTo("login")}>
                Entra
              </button>
            </>
          )}
        </p>
      </form>
    </AuthShell>
  );
}
