"use client";

import { AVATAR_SIZE, hasPaintedAvatar } from "@/lib/avatar";

export function PixelAvatar({
  pixels,
  name,
  size = 32,
}: {
  pixels?: string[] | null;
  name: string;
  size?: number;
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  if (!hasPaintedAvatar(pixels)) {
    return (
      <span
        className="inline-flex items-center justify-center overflow-hidden rounded-full bg-moss text-white"
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  return (
    <span
      className="inline-grid overflow-hidden rounded-full border border-line bg-card"
      style={{
        width: size,
        height: size,
        gridTemplateColumns: `repeat(${AVATAR_SIZE}, 1fr)`,
        gridTemplateRows: `repeat(${AVATAR_SIZE}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {pixels!.map((color, index) => (
        <span key={index} style={{ background: color || "transparent" }} />
      ))}
    </span>
  );
}
