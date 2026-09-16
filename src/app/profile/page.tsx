"use client";

import { FormEvent, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { PixelPainter } from "@/components/pixel-painter";
import { AppHeader, Field, PrimaryButton, Screen, inputClass } from "@/components/ui";
import { emptyAvatar, normalizeAvatar } from "@/lib/avatar";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function ProfilePage() {
  const { user } = useBingoStore();

  if (!user) {
    return (
      <AuthGate>
        <div />
      </AuthGate>
    );
  }

  return <ProfileForm />;
}

function ProfileForm() {
  const { user, actions } = useBingoStore();
  const [name, setName] = useState(user?.displayName ?? "");
  const [pixels, setPixels] = useState(normalizeAvatar(user?.avatarPixels));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    try {
      await actions.updateProfile(name, pixels);
      setError("");
      setSaved(true);
    } catch (err: unknown) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title="Profil" backHref="/" />
        <Screen>
          <form className="space-y-6" onSubmit={(event) => void save(event)}>
            <Field label="Anzeigename">
              <input
                className={inputClass}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                required
                minLength={2}
              />
            </Field>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-soft">Profilbild (20×20 Pixel)</p>
              <p className="text-sm text-ink-soft">Male dein Bild selbst — Tippen oder Ziehen färbt die Pixel.</p>
              <PixelPainter
                value={pixels}
                onChange={(next) => {
                  setPixels(next);
                  setSaved(false);
                }}
              />
            </div>
            {error ? <p className="text-sm font-semibold text-stamp">{error}</p> : null}
            {saved ? <p className="text-sm font-semibold text-moss">Gespeichert.</p> : null}
            <PrimaryButton type="submit">Profil speichern</PrimaryButton>
            <button
              type="button"
              className="w-full text-sm text-ink-soft underline"
              onClick={() => {
                setPixels(emptyAvatar());
                setSaved(false);
              }}
            >
              Bild zurücksetzen
            </button>
          </form>
        </Screen>
      </div>
    </AuthGate>
  );
}
