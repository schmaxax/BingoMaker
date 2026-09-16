"use client";

import { useState } from "react";
import { ProgressPhoto } from "@/components/progress-photo";
import { Field, SecondaryButton, inputClass } from "@/components/ui";
import { PixelAvatar } from "@/components/pixel-avatar";
import { compressImage } from "@/lib/image";
import { useBingoStore } from "@/lib/store/use-bingo-store";
import type { BoardDetail, Cell } from "@/lib/types";

export function CellProgressSheet({
  detail,
  cell,
  userId,
  onClose,
}: {
  detail: BoardDetail;
  cell: Cell;
  userId: string;
  onClose: () => void;
}) {
  const { actions } = useBingoStore();
  const mine = detail.progress.find((item) => item.cellId === cell.id && item.userId === userId);
  const others = detail.progress.filter((item) => item.cellId === cell.id && item.userId !== userId);
  const revealedOrOpen = !detail.board.revealEnabled || detail.board.status === "revealed";
  const locked = detail.board.status === "archived" || detail.board.status === "revealed";
  const [note, setNote] = useState(mine?.note ?? "");
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Schließen" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-2xl">{cell.title || `Feld ${cell.row + 1}/${cell.col + 1}`}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {revealedOrOpen
                ? "Nach der Auflösung sieht die Gruppe Notizen und Fotos."
                : "Notiz und Foto siehst nur du — nicht über die gemeinsamen Feldinhalte."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Deine Notiz">
            <textarea
              className={`${inputClass} min-h-24`}
              value={note}
              disabled={locked}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => {
                if (locked || note === (mine?.note ?? "")) return;
                void actions.upsertProgress(detail.board.id, cell.id, { note });
              }}
              placeholder="Nur für dich, bis zum Reveal"
            />
          </Field>
          <label className="block">
            <span className="text-sm font-semibold text-ink-soft">Dein Foto</span>
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
                  await actions.upsertProgress(detail.board.id, cell.id, { photoDataUrl });
                  setError("");
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : "Foto fehlgeschlagen.");
                }
              }}
            />
          </label>
          {mine?.photoDataUrl ? (
            <div className="space-y-2">
              <ProgressPhoto src={mine.photoDataUrl} alt="Dein Foto" maxHeightClass="max-h-56" />
              {!locked ? (
                <SecondaryButton
                  type="button"
                  onClick={() => void actions.upsertProgress(detail.board.id, cell.id, { photoDataUrl: null })}
                >
                  Foto entfernen
                </SecondaryButton>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm font-semibold text-stamp">{error}</p> : null}

          {others.length > 0 ? (
            <section className="space-y-3 border-t border-line pt-4">
              <p className="font-semibold">Die anderen</p>
              {others.map((item) => (
                <article key={item.userId} className="rounded-2xl bg-paper p-3">
                  <p className="flex items-center gap-2 font-semibold">
                    <PixelAvatar pixels={item.profile.avatarPixels} name={item.profile.displayName} size={24} />
                    <span>
                      {item.profile.displayName} {item.completed ? "· erledigt" : "· offen"}
                    </span>
                  </p>
                  {item.note ? <p className="mt-2 whitespace-pre-wrap text-sm">{item.note}</p> : null}
                  {item.photoDataUrl ? (
                    <ProgressPhoto
                      src={item.photoDataUrl}
                      alt=""
                      maxHeightClass="max-h-40"
                      className="mt-3"
                    />
                  ) : null}
                </article>
              ))}
            </section>
          ) : revealedOrOpen ? (
            <p className="text-sm text-ink-soft">Noch keine Notizen oder Fotos der anderen.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
