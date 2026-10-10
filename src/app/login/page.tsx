"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const sb = supabase();

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
      setNotice("T'hem enviat un correu per confirmar el compte. Obre'l i després entra aquí.");
      setMode("login");
    }
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-ink text-paper flex flex-col justify-between px-6 sm:px-10 lg:px-16 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-10 lg:py-16">
        <h1 className="font-display font-extrabold text-[clamp(3.4rem,13vw,8.5rem)] leading-[0.86] tracking-[-0.045em]">
          Family
          <br />
          Love
          <br />
          Food
        </h1>
        <p className="mt-8 max-w-sm text-lg text-paper/85">
          El menú de la setmana, la llista de la compra i els tiquets de casa, en un sol lloc.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 sm:px-10 py-10">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <h2 className="text-3xl font-extrabold">{mode === "login" ? "Entra" : "Crea el teu compte"}</h2>

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

          <div>
            <label className="label" htmlFor="password">
              Contrasenya
            </label>
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

          {error && (
            <p role="alert" className="font-bold text-danger">
              {error}
            </p>
          )}
          {notice && <p className="font-bold text-brown">{notice}</p>}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Un moment..." : mode === "login" ? "Entra" : "Crea el compte"}
          </button>

          <p className="text-center">
            {mode === "login" ? "Encara no tens compte?" : "Ja tens compte?"}{" "}
            <button
              type="button"
              className="font-bold text-brown underline underline-offset-4"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Crea'n un" : "Entra"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
