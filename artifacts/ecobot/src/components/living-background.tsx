import { useEffect, useRef } from "react";

/**
 * LivingBackground — cranked-up signature atmosphere.
 * Flowing green light-ribbons + drifting particles + streaking shooting stars.
 * Pure canvas. Respects prefers-reduced-motion (one still frame).
 */
export function LivingBackground({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const cv = canvas, ctx = context;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; z: number; s: number };
    type Star = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    let parts: P[] = [];
    let stars: Star[] = [];

    function resize() {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      parts = [];
      const count = Math.round(90 * intensity);
      for (let i = 0; i < count; i++) parts.push({ x: Math.random() * w, y: Math.random() * h, z: Math.random(), s: Math.random() * 1.8 + 0.4 });
    }
    function spawnStar() {
      const fromLeft = Math.random() > 0.5;
      const y = Math.random() * h * 0.6;
      stars.push({
        x: fromLeft ? -40 : w + 40, y,
        vx: (fromLeft ? 1 : -1) * (5 + Math.random() * 5),
        vy: 1.2 + Math.random() * 1.6, life: 0, max: 60 + Math.random() * 40,
      });
    }
    function ribbon(t: number, yb: number, amp: number, freq: number, ph: number, al: number) {
      ctx.beginPath();
      for (let x = -20; x <= w + 20; x += 12) {
        const y = yb + Math.sin(x * freq + t + ph) * amp + Math.sin(x * freq * 0.5 + t * 0.7) * amp * 0.4;
        x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let x = w + 20; x >= -20; x -= 12) {
        const y = yb + 34 + Math.sin(x * freq + t + ph) * amp + Math.sin(x * freq * 0.5 + t * 0.7) * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, yb - amp, 0, yb + amp);
      g.addColorStop(0, "hsla(148,84%,58%,0)");
      g.addColorStop(0.5, `hsla(148,84%,54%,${al})`);
      g.addColorStop(1, "hsla(158,84%,46%,0)");
      ctx.fillStyle = g; ctx.fill();
    }
    let starTimer = 0;
    function frame(now: number) {
      const t = now * 0.0007;
      ctx.clearRect(0, 0, w, h);

      // particles (brighter, more)
      for (const p of parts) {
        p.y -= (0.12 + p.z * 0.35) * intensity;
        p.x += Math.sin((p.y + p.x) * 0.006) * 0.2;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(148,84%,62%,${0.2 + p.z * 0.4})`;
        ctx.fill();
      }

      // flowing ribbons (brighter)
      const base = h * 0.6;
      ribbon(t, base, 40, 0.006, 0, 0.16 * intensity);
      ribbon(t * 1.2, base + 46, 30, 0.008, 1.7, 0.13 * intensity);
      ribbon(t * 0.85, base - 36, 34, 0.005, 3.2, 0.10 * intensity);

      // shooting stars
      starTimer++;
      if (starTimer > 46 / intensity) { starTimer = 0; spawnStar(); }
      stars = stars.filter((s) => s.life < s.max);
      for (const s of stars) {
        s.life++; s.x += s.vx; s.y += s.vy;
        const a = Math.sin((s.life / s.max) * Math.PI);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 3, s.y - s.vy * 3);
        ctx.strokeStyle = `hsla(148,90%,72%,${a * 0.9})`;
        ctx.lineWidth = 1.6; ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(148,90%,80%,${a})`; ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }
    resize(); seed();
    if (reduce) frame(0); else raf = requestAnimationFrame(frame);
    const onR = () => { resize(); seed(); };
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, [intensity]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}
