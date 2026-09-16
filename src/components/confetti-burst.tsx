"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#c44536", "#c9a227", "#2f5d46", "#fffaf1", "#ec4899", "#3b82f6"];

type Particle = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
};

export function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = Array.from({ length: 140 }, () => ({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: -20 - Math.random() * canvas.height * 0.3,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      vx: (Math.random() - 0.5) * 5,
      vy: 2 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
    }));

    let frame = 0;
    let raf = 0;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.06;
        particle.rot += particle.vr;
        if (particle.y < canvas.height + 30) alive = true;
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
        ctx.restore();
      }
      frame += 1;
      if (alive && frame < 320) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  );
}
