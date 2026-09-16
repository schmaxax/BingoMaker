"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader, Screen, inputClass } from "@/components/ui";
import { useBingoStore, useBoardDetail } from "@/lib/store/use-bingo-store";
import type { Cell } from "@/lib/types";

export default function FieldsPage() {
  const params = useParams<{ boardId: string }>();
  const { user } = useBingoStore();
  const boardId = params.boardId;
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
        <AppHeader title="Feldinhalte" backHref={`/boards/${boardId}`} />
        <Screen>
          <p className="text-ink-soft">Felder werden geladen …</p>
        </Screen>
      </AuthGate>
    );
  }

  if (error || !detail) {
    return (
      <AuthGate>
        <AppHeader title="Feldinhalte" backHref="/" />
        <Screen>
          <p className="text-stamp">{error || "Kein Zugriff."}</p>
        </Screen>
      </AuthGate>
    );
  }

  const locked = detail.board.status === "archived";

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title="Feldinhalte" backHref={`/boards/${boardId}`} />
        <Screen>
          <p className="mb-4 text-sm text-ink-soft">
            Titel und Beschreibung gelten für die ganze Gruppe. Private Notizen und Fotos hängst du direkt an die
            Bingo-Karte.
          </p>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[32rem] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-line bg-card text-left">
              <thead className="bg-paper-deep text-sm">
                <tr>
                  <th className="w-20 px-3 py-3 font-semibold">Feld</th>
                  <th className="px-3 py-3 font-semibold">Titel</th>
                  <th className="px-3 py-3 font-semibold">Beschreibung</th>
                </tr>
              </thead>
              <tbody>
                {detail.cells.map((cell) => (
                  <FieldRow
                    key={cell.id}
                    boardId={boardId}
                    cell={cell}
                    locked={locked}
                    onSave={(title, description) => actions.updateCell(boardId, cell.id, title, description)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Screen>
      </div>
    </AuthGate>
  );
}

function FieldRow({
  boardId,
  cell,
  locked,
  onSave,
}: {
  boardId: string;
  cell: Cell;
  locked: boolean;
  onSave: (title: string, description: string) => Promise<void>;
}) {
  void boardId;
  const [title, setTitle] = useState(cell.title);
  const [description, setDescription] = useState(cell.description);
  const [error, setError] = useState("");

  async function save() {
    if (locked) return;
    if (title === cell.title && description === cell.description) return;
    try {
      await onSave(title, description);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <tr className="align-top border-t border-line">
      <td className="border-t border-line px-3 py-3 font-mono text-sm font-semibold text-ink-soft">
        {cell.row + 1}/{cell.col + 1}
      </td>
      <td className="border-t border-line px-3 py-3">
        <input
          className={inputClass}
          value={title}
          disabled={locked}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void save()}
          placeholder="Titel"
          aria-label={`Titel Feld ${cell.row + 1}/${cell.col + 1}`}
        />
        {error ? <p className="mt-1 text-xs font-semibold text-stamp">{error}</p> : null}
      </td>
      <td className="border-t border-line px-3 py-3">
        <textarea
          className={`${inputClass} min-h-20`}
          value={description}
          disabled={locked}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => void save()}
          placeholder="Beschreibung"
          aria-label={`Beschreibung Feld ${cell.row + 1}/${cell.col + 1}`}
        />
      </td>
    </tr>
  );
}
