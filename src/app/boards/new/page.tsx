"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader, Field, PrimaryButton, Screen, inputClass } from "@/components/ui";
import { useBingoStore } from "@/lib/store/use-bingo-store";

const sizes = [3, 4, 5, 6];

export default function NewBoardPage() {
  const { actions } = useBingoStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState(5);
  const [ownerMode, setOwnerMode] = useState(true);
  const [revealEnabled, setRevealEnabled] = useState(true);
  const [winLogicEnabled, setWinLogicEnabled] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const board = actions.createBoard({
        name,
        size,
        ownerMode,
        revealEnabled,
        winLogicEnabled,
        revealDeadline: deadline ? new Date(deadline).toISOString() : null,
      });
      router.push(`/boards/${board.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Board konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title="Neues Board" backHref="/" />
        <Screen>
          <form className="space-y-5" onSubmit={onSubmit}>
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="z. B. Festival-Bingo" />
            </Field>

            <div>
              <p className="mb-2 text-sm font-semibold text-ink-soft">Größe</p>
              <div className="grid grid-cols-4 gap-2">
                {sizes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSize(value)}
                    className={`rounded-2xl border px-3 py-3 font-semibold ${
                      size === value ? "border-stamp bg-stamp text-white" : "border-line bg-card"
                    }`}
                  >
                    {value}×{value}
                  </button>
                ))}
              </div>
            </div>

            <Toggle
              title="Owner/Admin-Modus"
              description="An: du bleibst Owner und kannst Reveal, Einladungen und Löschen steuern. Aus: alle Mitglieder sind gleichberechtigt, Reveal braucht Mehrheit."
              checked={ownerMode}
              onChange={setOwnerMode}
            />
            <Toggle
              title="Reveal-Funktion"
              description="An: Fortschritte, Notizen und Fotos bleiben privat, bis das Board aufgelöst wird. Aus: die Gruppe sieht Fortschritte sofort."
              checked={revealEnabled}
              onChange={setRevealEnabled}
            />
            <Toggle
              title="Gewinnlogik"
              description="An: volle Reihe, Spalte oder Diagonale ist Bingo — mit Markierung und Hinweis an alle. Aus: nur gemeinsames Dokumentieren."
              checked={winLogicEnabled}
              onChange={setWinLogicEnabled}
            />

            {revealEnabled ? (
              <Field label="Optionales Enddatum">
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </Field>
            ) : null}

            {error ? <p className="text-sm font-semibold text-stamp">{error}</p> : null}
            <PrimaryButton disabled={busy} type="submit">
              Board erstellen
            </PrimaryButton>
          </form>
        </Screen>
      </div>
    </AuthGate>
  );
}

function Toggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full rounded-3xl border border-line bg-card p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-ink-soft">{description}</p>
        </div>
        <span className={`mt-0.5 rounded-full px-3 py-1 text-xs font-bold ${checked ? "bg-moss text-white" : "bg-paper-deep text-ink-soft"}`}>
          {checked ? "An" : "Aus"}
        </span>
      </div>
    </button>
  );
}
