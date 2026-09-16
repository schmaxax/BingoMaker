"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { ProgressPhoto } from "@/components/progress-photo";
import { AppHeader, Field, Screen, SecondaryButton, inputClass } from "@/components/ui";
import { PixelAvatar } from "@/components/pixel-avatar";
import { compressImage } from "@/lib/image";
import { useBingoStore, useBoardDetail } from "@/lib/store/use-bingo-store";

export default function CellPage() {
  const params = useParams<{ boardId: string; cellId: string }>();
  const { user } = useBingoStore();
  const { boardId, cellId } = params;
  const { detail, error, loading, actions } = useBoardDetail(boardId);

  if (!user) {
    return (
      <AuthGate>
        <div />
      </AuthGate>
    );
  }

  if (loading) {
    return (
      <AuthGate>
        <AppHeader title="Feld" backHref={`/boards/${boardId}`} />
        <Screen>
          <p className="text-ink-soft">Feld wird geladen …</p>
        </Screen>
      </AuthGate>
    );
  }

  if (error || !detail) {
    return (
      <AuthGate>
        <AppHeader title="Feld" backHref="/" />
        <Screen>
          <p className="text-stamp">{error || "Nicht gefunden."}</p>
        </Screen>
      </AuthGate>
    );
  }

  const cell = detail.cells.find((item) => item.id === cellId);
  if (!cell) {
    return (
      <AuthGate>
        <AppHeader title="Feld" backHref={`/boards/${boardId}`} />
        <Screen>
          <p>Feld nicht gefunden.</p>
        </Screen>
      </AuthGate>
    );
  }

  return <CellDraft boardId={boardId} cellId={cellId} userId={user.id} />;
}

function CellDraft({ boardId, cellId, userId }: { boardId: string; cellId: string; userId: string }) {
  const { detail, actions } = useBoardDetail(boardId);
  const cell = detail?.cells.find((item) => item.id === cellId);
  const mine = detail?.progress.find((item) => item.cellId === cellId && item.userId === userId);
  const others = detail?.progress.filter((item) => item.cellId === cellId && item.userId !== userId) ?? [];
  const revealedOrOpen = !detail?.board.revealEnabled || detail?.board.status === "revealed";
  const locked = detail?.board.status === "archived" || detail?.board.status === "revealed";

  const [note, setNote] = useState(mine?.note ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    setNote(mine?.note ?? "");
  }, [mine?.note, cellId]);

  if (!detail || !cell) return null;

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title={cell.title || "Feld"} backHref={`/boards/${boardId}`} />
        <Screen>
          <div className="space-y-6">
            <section className="space-y-3 rounded-3xl border border-line bg-card p-4">
              <p className="font-serif text-2xl">{cell.title || `Feld ${cell.row + 1}/${cell.col + 1}`}</p>
              {cell.description ? <p className="whitespace-pre-wrap text-sm text-ink-soft">{cell.description}</p> : null}
              <p className="text-sm text-ink-soft">
                Titel und Beschreibung bearbeitest du in der Feldinhalte-Tabelle. Abhaken geht über das Bingo-Raster.
              </p>
            </section>

            <section className="space-y-3 rounded-3xl border border-line bg-card p-4">
              <p className="font-serif text-2xl">Dein Fortschritt</p>
              <p className="text-sm text-ink-soft">
                {revealedOrOpen
                  ? "Sichtbar für alle Mitglieder."
                  : "Nur du siehst das, bis das Board aufgelöst wird."}
              </p>
              <Field label="Notiz nur für dich">
                <textarea
                  className={`${inputClass} min-h-24`}
                  value={note}
                  disabled={locked}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => {
                    if (locked) return;
                    void actions.upsertProgress(boardId, cellId, { note });
                  }}
                  placeholder="Beleg, Erinnerung, Insider …"
                />
              </Field>
              <label className="block">
                <span className="text-sm font-semibold text-ink-soft">Foto</span>
                <input
                  className="mt-1.5 block w-full text-sm"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={locked}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      const photoDataUrl = await compressImage(file);
                      await actions.upsertProgress(boardId, cellId, { photoDataUrl });
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : "Foto fehlgeschlagen.");
                    }
                  }}
                />
              </label>
              {mine?.photoDataUrl ? (
                <div className="space-y-2">
                  <ProgressPhoto src={mine.photoDataUrl} alt="Dein Foto" />
                  {!locked ? (
                    <SecondaryButton
                      type="button"
                      onClick={() => void actions.upsertProgress(boardId, cellId, { photoDataUrl: null })}
                    >
                      Foto entfernen
                    </SecondaryButton>
                  ) : null}
                </div>
              ) : null}
            </section>

            {others.length > 0 ? (
              <section className="space-y-3">
                <p className="font-serif text-2xl">Die anderen</p>
                {others.map((item) => (
                  <article key={item.userId} className="rounded-3xl border border-line bg-card p-4">
                    <p className="flex items-center gap-2 font-semibold">
                      <PixelAvatar pixels={item.profile.avatarPixels} name={item.profile.displayName} size={28} />
                      <span>
                        {item.profile.displayName} {item.completed ? "· erledigt" : "· offen"}
                      </span>
                    </p>
                    {item.note ? <p className="mt-2 whitespace-pre-wrap text-sm">{item.note}</p> : null}
                    {item.photoDataUrl ? (
                      <ProgressPhoto src={item.photoDataUrl} alt="" maxHeightClass="max-h-56" className="mt-3" />
                    ) : null}
                  </article>
                ))}
              </section>
            ) : revealedOrOpen ? (
              <p className="text-sm text-ink-soft">Noch keine Fortschritte der anderen in diesem Feld.</p>
            ) : (
              <p className="text-sm text-ink-soft">Nach dem Reveal siehst du hier Notizen und Fotos der Gruppe.</p>
            )}

            {error ? <p className="text-sm font-semibold text-stamp">{error}</p> : null}
          </div>
        </Screen>
      </div>
    </AuthGate>
  );
}
