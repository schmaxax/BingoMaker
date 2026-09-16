"use client";

import { useMemo, useState } from "react";
import { CellProgressSheet } from "@/components/cell-progress-sheet";
import { PixelAvatar } from "@/components/pixel-avatar";
import { findBingoLines } from "@/lib/bingo";
import { useBingoStore } from "@/lib/store/use-bingo-store";
import type { BoardDetail } from "@/lib/types";

export function BingoGrid({ detail, userId }: { detail: BoardDetail; userId: string }) {
  const { board, cells, progress } = detail;
  const locked = board.status === "archived" || board.status === "revealed";
  const { actions } = useBingoStore();
  const [openCellId, setOpenCellId] = useState<string | null>(null);
  const openCell = cells.find((cell) => cell.id === openCellId) ?? null;
  const ownCompleted = useMemo(() => {
    const keys = new Set<string>();
    for (const cell of cells) {
      const mine = progress.find((item) => item.cellId === cell.id && item.userId === userId && item.completed);
      if (mine) keys.add(`${cell.row}:${cell.col}`);
    }
    return keys;
  }, [cells, progress, userId]);

  const winning = board.winLogicEnabled ? findBingoLines(board.size, ownCompleted) : [];
  const winningKeys = new Set(
    winning.flatMap((key) => {
      const [kind, value] = key.split("-");
      return cells
        .filter((cell) => {
          if (kind === "row") return cell.row === Number(value);
          if (kind === "col") return cell.col === Number(value);
          if (key === "diag-main") return cell.row === cell.col;
          if (key === "diag-anti") return cell.row + cell.col === board.size - 1;
          return false;
        })
        .map((cell) => cell.id);
    }),
  );

  return (
    <>
      <div
        className="grid gap-1.5 rounded-3xl bg-ink p-2 shadow-lg sm:gap-2 sm:p-3"
        style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const mine = progress.find((item) => item.cellId === cell.id && item.userId === userId);
          const others = progress.filter((item) => item.cellId === cell.id && item.userId !== userId && item.completed);
          const done = Boolean(mine?.completed);
          const hasPrivate = Boolean(mine?.note || mine?.photoDataUrl);
          return (
            <div
              key={cell.id}
              className={`relative aspect-square overflow-hidden rounded-xl ${
                done ? "bg-stamp text-white stamp-mark" : "bg-card text-ink"
              } ${winningKeys.has(cell.id) ? "ring-2 ring-gold" : ""}`}
            >
              <button
                type="button"
                disabled={locked}
                aria-pressed={done}
                aria-label={`${cell.title || `Feld ${cell.row + 1}/${cell.col + 1}`} ${done ? "abhaken rückgängig" : "abhaken"}`}
                onClick={() => {
                  void actions.upsertProgress(board.id, cell.id, { completed: !done }).catch(() => undefined);
                }}
                className="absolute inset-0 p-1.5 text-left disabled:opacity-60 sm:p-2"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70 sm:text-xs">
                  {cell.row + 1}/{cell.col + 1}
                </span>
                <span className="mt-0.5 block pr-6 text-[11px] font-semibold leading-tight sm:text-sm">
                  {cell.title || "Noch leer"}
                </span>
              </button>
              <button
                type="button"
                className={`absolute bottom-1 right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full ${
                  done ? "bg-white/20 text-white" : "bg-ink/10 text-ink"
                }`}
                aria-label={`Notiz und Foto zu ${cell.title || `Feld ${cell.row + 1}/${cell.col + 1}`}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenCellId(cell.id);
                }}
              >
                <NoteIcon filled={hasPrivate} />
              </button>
              {others.length > 0 ? (
                <span className="pointer-events-none absolute top-1 right-1 flex -space-x-1">
                  {others.slice(0, 3).map((item) => (
                    <PixelAvatar
                      key={item.userId}
                      pixels={item.profile.avatarPixels}
                      name={item.profile.displayName}
                      size={16}
                    />
                  ))}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {openCell ? (
        <CellProgressSheet
          key={openCell.id}
          detail={detail}
          cell={openCell}
          userId={userId}
          onClose={() => setOpenCellId(null)}
        />
      ) : null}
    </>
  );
}

function NoteIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M5 3.5h7.5L16 7v9.5H5V3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.25 : 0}
      />
      <path d="M12.5 3.5V7H16" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 10.5h6M7 13.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
