import type { Cell, Progress } from "./types";

export function winningLines(size: number): Array<{ key: string; cells: Array<{ row: number; col: number }> }> {
  const lines: Array<{ key: string; cells: Array<{ row: number; col: number }> }> = [];

  for (let row = 0; row < size; row += 1) {
    lines.push({
      key: `row-${row}`,
      cells: Array.from({ length: size }, (_, col) => ({ row, col })),
    });
  }
  for (let col = 0; col < size; col += 1) {
    lines.push({
      key: `col-${col}`,
      cells: Array.from({ length: size }, (_, row) => ({ row, col })),
    });
  }
  lines.push({
    key: "diag-main",
    cells: Array.from({ length: size }, (_, i) => ({ row: i, col: i })),
  });
  lines.push({
    key: "diag-anti",
    cells: Array.from({ length: size }, (_, i) => ({ row: i, col: size - 1 - i })),
  });
  return lines;
}

export function completedKeys(cells: Cell[], progress: Progress[], userId: string): Set<string> {
  const byCell = new Map(cells.map((cell) => [cell.id, cell]));
  const keys = new Set<string>();
  for (const entry of progress) {
    if (entry.userId !== userId || !entry.completed) continue;
    const cell = byCell.get(entry.cellId);
    if (cell) keys.add(`${cell.row}:${cell.col}`);
  }
  return keys;
}

export function findBingoLines(size: number, completed: Set<string>): string[] {
  return winningLines(size)
    .filter((line) => line.cells.every(({ row, col }) => completed.has(`${row}:${col}`)))
    .map((line) => line.key);
}

export function majorityNeeded(memberCount: number): number {
  return Math.floor(memberCount / 2) + 1;
}

export function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function statusLabel(status: "active" | "revealed" | "archived"): string {
  if (status === "active") return "Aktiv";
  if (status === "revealed") return "Aufgelöst";
  return "Archiviert";
}
