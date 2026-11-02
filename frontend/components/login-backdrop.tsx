"use client";
import { useEffect, useRef } from "react";

const GOLD = "201, 162, 75";

/** Navy backdrop for /login: a candlelight glow that follows the pointer, drifting gold motes and click ripples. */
export function LoginBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let frame = 0;
    let placed = false;
    let pointer: { x: number; y: number } | null = null;
    const glow = { x: 0, y: 0 };
    const trail = { x: 0, y: 0 };
    const ripples: { x: number; y: number; r: number; a: number }[] = [];
    const motes = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.6 + 0.4,
      speed: Math.random() * 0.35 + 0.1,
      phase: Math.random() * Math.PI * 2,
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!placed) {
        placed = true;
        for (const m of motes) {
          m.x *= w;
          m.y *= h;
        }
        glow.x = trail.x = w / 2;
        glow.y = trail.y = h / 2;
      }
      if (still) paint(0);
    }

    function halo(x: number, y: number, r: number, a: number) {
      const g = ctx!.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${GOLD}, ${a})`);
      g.addColorStop(0.45, `rgba(${GOLD}, ${a * 0.35})`);
      g.addColorStop(1, `rgba(${GOLD}, 0)`);
      ctx!.fillStyle = g;
      ctx!.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function paint(t: number) {
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      const breathe = 1 + Math.sin(t / 1400) * 0.06;
      // A slow trailing halo under a quicker, warmer core gives the light some depth.
      halo(trail.x, trail.y, 760 * breathe, 0.09);
      halo(glow.x, glow.y, 480 * breathe, 0.15);
      halo(glow.x, glow.y, 160, 0.2 + Math.sin(t / 700) * 0.02);
      for (const m of motes) {
        const d = Math.hypot(m.x - glow.x, m.y - glow.y);
        const near = Math.max(0, 1 - d / 260);
        const twinkle = 0.5 + Math.sin(t / 900 + m.phase) * 0.5;
        ctx!.fillStyle = `rgba(${GOLD}, ${0.12 + twinkle * 0.22 + near * 0.55})`;
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, m.size * (1 + near * 0.9), 0, Math.PI * 2);
        ctx!.fill();
      }
      for (const r of ripples) {
        ctx!.strokeStyle = `rgba(${GOLD}, ${r.a})`;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx!.stroke();
      }
      ctx!.globalCompositeOperation = "source-over";
    }

    function tick(t: number) {
      // With no pointer (touch, or before the first move) the light wanders slowly.
      const target = pointer ?? {
        x: w / 2 + Math.cos(t / 5200) * w * 0.28,
        y: h / 2 + Math.sin(t / 3900) * h * 0.22,
      };
      glow.x += (target.x - glow.x) * 0.06;
      glow.y += (target.y - glow.y) * 0.06;
      trail.x += (glow.x - trail.x) * 0.025;
      trail.y += (glow.y - trail.y) * 0.025;
      for (const m of motes) {
        m.y -= m.speed;
        m.x += Math.sin(t / 2000 + m.phase) * 0.15;
        const dx = m.x - glow.x;
        const dy = m.y - glow.y;
        const d = Math.hypot(dx, dy);
        if (d < 180 && d > 0) {
          m.x += (dx / d) * 0.6;
          m.y += (dy / d) * 0.6;
        }
        if (m.y < -10) {
          m.y = h + 10;
          m.x = Math.random() * w;
        }
      }
      for (const r of ripples) {
        r.r += 3.2;
        r.a *= 0.955;
      }
      while (ripples.length && ripples[0].a < 0.01) ripples.shift();
      paint(t);
      frame = requestAnimationFrame(tick);
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse") pointer = { x: e.clientX, y: e.clientY };
    };
    const leave = () => (pointer = null);
    const tap = (e: PointerEvent) =>
      ripples.push({ x: e.clientX, y: e.clientY, r: 8, a: 0.45 });

    resize();
    window.addEventListener("resize", resize);
    if (!still) {
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerdown", tap);
      document.documentElement.addEventListener("pointerleave", leave);
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", tap);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <canvas ref={ref} className="login-backdrop" aria-hidden="true" />;
}
