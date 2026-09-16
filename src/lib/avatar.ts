export const AVATAR_SIZE = 20;
export const AVATAR_CELLS = AVATAR_SIZE * AVATAR_SIZE;

export function emptyAvatar(): string[] {
  return Array.from({ length: AVATAR_CELLS }, () => "");
}

export function normalizeAvatar(pixels: string[] | undefined | null): string[] {
  const next = emptyAvatar();
  if (!pixels) return next;
  for (let i = 0; i < AVATAR_CELLS; i += 1) {
    next[i] = pixels[i] ?? "";
  }
  return next;
}

export function hasPaintedAvatar(pixels: string[] | undefined | null): boolean {
  return Boolean(pixels?.some((pixel) => pixel));
}

export const AVATAR_PALETTE = [
  "#1c1410",
  "#c44536",
  "#2f5d46",
  "#c9a227",
  "#fffaf1",
  "#5e4f43",
  "#3b82f6",
  "#ec4899",
  "#22c55e",
  "#f97316",
  "#7c3aed",
  "#0ea5e9",
];
