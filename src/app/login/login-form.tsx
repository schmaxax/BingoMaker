"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader, Field, PrimaryButton, Screen, inputClass } from "@/components/ui";
import { PixelAvatar } from "@/components/pixel-avatar";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function LoginForm() {
  const { user, accounts, actions } = useBingoStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const magic = searchParams.get("magic");

  const [mode, setMode] = useState<"login" | "register" | "magic">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [magicLink, setMagicLink] = useState("");
  const [busy, setBusy] = useState(false);

  const consumed = useRef(false);

  useEffect(() => {
    if (user && !magic) router.replace(next);
  }, [user, magic, next, router]);

  useEffect(() => {
    if (!magic || consumed.current) return;
    consumed.current = true;
    setBusy(true);
    actions
      .consumeMagicLink(magic)
      .then(() => router.replace(next))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Magic-Link ungültig."))
      .finally(() => setBusy(false));
  }, [magic, actions, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") await actions.signUp(displayName, email, password);
      else if (mode === "login") await actions.signIn(email, password);
      else {
        const link = await actions.requestMagicLink(email);
        setMagicLink(link);
        return;
      }
      router.replace(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="Anmelden" />
      <Screen>
        <div className="space-y-6">
          <section className="rounded-3xl border border-line bg-card p-5 shadow-sm">
            <p className="font-serif text-3xl leading-tight">Bingo mit Freunden</p>
            <p className="mt-2 text-ink-soft">
              Gemeinsame Felder, privater Fortschritt — und erst nach dem Reveal sieht die Gruppe alles.
            </p>
          </section>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-paper-deep p-1 text-sm font-semibold">
            {(
              [
                ["login", "Login"],
                ["register", "Registrieren"],
                ["magic", "Magic-Link"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setError("");
                  setMagicLink("");
                }}
                className={`rounded-xl px-2 py-2 ${mode === key ? "bg-card shadow-sm" : "text-ink-soft"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === "register" ? (
              <Field label="Anzeigename">
                <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </Field>
            ) : null}
            <Field label="E-Mail">
              <input
                className={inputClass}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            {mode !== "magic" ? (
              <Field label="Passwort">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </Field>
            ) : (
              <p className="text-sm text-ink-soft">
                Im Demo-Modus wird der Link hier angezeigt, statt per E-Mail versendet zu werden.
              </p>
            )}
            {error ? <p className="text-sm font-semibold text-stamp">{error}</p> : null}
            {magicLink ? (
              <a href={magicLink} className="block break-all rounded-2xl bg-moss-soft p-3 text-sm text-moss underline">
                {magicLink}
              </a>
            ) : null}
            <PrimaryButton disabled={busy} type="submit">
              {mode === "login" ? "Einloggen" : mode === "register" ? "Account anlegen" : "Magic-Link erzeugen"}
            </PrimaryButton>
          </form>

          {accounts.length > 0 ? (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-ink-soft">Accounts auf diesem Gerät</p>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left"
                    onClick={() => {
                      actions.switchAccount(account.id);
                      router.replace(next);
                    }}
                  >
                    <PixelAvatar pixels={account.avatarPixels} name={account.displayName} size={40} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{account.displayName}</span>
                      <span className="text-sm text-ink-soft">{account.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </Screen>
    </div>
  );
}
