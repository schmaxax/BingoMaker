"use client";

import { useRef, useState } from "react";
import { AVATAR_PALETTE, AVATAR_SIZE, emptyAvatar, normalizeAvatar } from "@/lib/avatar";

export function PixelPainter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (pixels: string[]) => void;
}) {
  const pixels = normalizeAvatar(value);
  const [color, setColor] = useState(AVATAR_PALETTE[0]);
  const painting = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;

  function paintAt(clientX: number, clientY: number) {
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const col = Math.min(AVATAR_SIZE - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * AVATAR_SIZE)));
    const row = Math.min(AVATAR_SIZE - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * AVATAR_SIZE)));
    const index = row * AVATAR_SIZE + col;
    const current = pixelsRef.current;
    if (current[index] === color) return;
    const next = [...current];
    next[index] = color;
    pixelsRef.current = next;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div
        ref={gridRef}
        role="application"
        aria-label="Profilbild 20 mal 20 Pixel malen"
        className="mx-auto aspect-square w-full max-w-[320px] touch-none select-none overflow-hidden rounded-2xl border border-ink bg-card shadow-inner"
        style={{
          gridTemplateColumns: `repeat(${AVATAR_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${AVATAR_SIZE}, 1fr)`,
          display: "grid",
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          painting.current = true;
          paintAt(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (!painting.current) return;
          paintAt(event.clientX, event.clientY);
        }}
        onPointerUp={() => {
          painting.current = false;
        }}
        onPointerCancel={() => {
          painting.current = false;
        }}
      >
        {pixels.map((pixel, index) => (
          <span
            key={index}
            className="border-[0.5px] border-black/10"
            style={{ background: pixel || "#fffaf1" }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {AVATAR_PALETTE.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Farbe ${swatch}`}
            onClick={() => setColor(swatch)}
            className={`h-8 w-8 rounded-full border ${color === swatch ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "border-line"}`}
            style={{ background: swatch }}
          />
        ))}
        <label className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-line">
          <span className="sr-only">Eigene Farbe</span>
          <input
            type="color"
            value={color || "#1c1410"}
            onChange={(event) => setColor(event.target.value)}
            className="h-12 w-12 -translate-x-1 -translate-y-1 cursor-pointer border-0 p-0"
          />
        </label>
        <button
          type="button"
          className={`h-8 rounded-full border border-line bg-card px-3 text-xs font-semibold ${color === "" ? "ring-2 ring-ink" : ""}`}
          onClick={() => setColor("")}
        >
          Radierer
        </button>
        <button
          type="button"
          className="h-8 rounded-full border border-line bg-card px-3 text-xs font-semibold"
          onClick={() => onChange(emptyAvatar())}
        >
          Leeren
        </button>
      </div>
    </div>
  );
}
