import { useEffect, useRef } from "react";

/**
 * GridTerrain — synthwave 3D wireframe grid scrolling toward the viewer.
 * ACTUAL mountains: narrow bases, steep fast climbs, sharp peaks — scattered
 * across BOTH sides at full width, with a clear flat path down the centre.
 * Glowing horizon line + sun. Reads --primary at runtime (re-themes with
 * Settings). Respects prefers-reduced-motion.
 */
export function GridTerrain({ speedRef }: { speedRef?: React.MutableRefObject<number> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;

    function accent(alpha: number) {
      const p = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "148 82% 46%";
      return `hsla(${p.replace(/\s+/g, ",")},${alpha})`;
    }

    function resize() {
      w = canvas!.clientWidth; h = canvas!.clientHeight;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const COLS = 44;
    const ROWS = 24;
    const horizonY = () => h * 0.44;

    function rand(a: number, b: number) {
      const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return s - Math.floor(s);
    }

    // ---- Mountains as explicit PEAK SEEDS ----
    // Each grid cell (col, z-cell) can spawn a mountain peak. A peak is a sharp
    // cone: narrow base, steep sides, pointed top. We sum contributions from
    // nearby seeds so peaks can cluster into ranges but each stays sharp.
    // The centre columns are excluded => flat road; both sides are dense.
    function terrain(col: number, worldZ: number): number {
      const nx = (col - COLS / 2) / (COLS / 2); // -1..1
      const a = Math.abs(nx);
      const road = 0.14;
      if (a < road) return 0;
      const cover = Math.min(1, (a - road) / 0.22); // ramp up fast just outside road

      const zc = worldZ * 0.5;
      let height = 0;

      // check a small neighbourhood of potential peak seeds
      for (let dc = -2; dc <= 2; dc++) {
        for (let dz = -2; dz <= 2; dz++) {
          const sc = col + dc;
          const scz = Math.floor(zc) + dz;
          const r = rand(sc, scz);
          if (r < 0.72) continue;                 // ~28% of cells spawn a peak (dense)
          const r2 = rand(sc + 99, scz + 7);
          // Most peaks are 90..290px; a rare few are GIANTS that tower way up.
          const isGiant = rand(sc + 41, scz + 63) > 0.9; // ~10% of peaks
          const peakH = isGiant ? 320 + r2 * 220 : 90 + r2 * 200;
          // distance from this grid point to the seed centre, in cells
          const ddx = col - sc;
          const ddz = zc - scz;
          const dist = Math.sqrt(ddx * ddx + ddz * ddz);
          // sharp cone: full height at centre, linear-ish steep drop, zero past base
          const base = 1.35;                      // small base radius (in cells)
          if (dist >= base) continue;
          const t = 1 - dist / base;              // 1 at tip -> 0 at base edge
          const cone = Math.pow(t, 1.7);          // steep sides, pointed top
          height = Math.max(height, peakH * cone); // max => sharp overlapping peaks, not summed mush
        }
      }
      return height * cover;
    }

    function project(col: number, depth: number, scroll: number) {
      const hz = horizonY();
      const persp = depth * depth;
      const y = hz + (h - hz) * persp;
      const cx = w / 2;
      const nx = (col - COLS / 2) / (COLS / 2);
      const x = cx + nx * (w * 0.07 + persp * w * 1.18);
      const worldZ = scroll + (1 - depth) * ROWS;
      const lift = terrain(col, worldZ) * persp;
      return { x, y: y - lift };
    }

    let scroll = 0;
    function frame() {
      ctx!.clearRect(0, 0, w, h);
      const hz = horizonY();

      const sky = ctx!.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, accent(0));
      sky.addColorStop(1, accent(0.10));
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, w, hz);

      const sunR = Math.min(w, h) * 0.16;
      const sun = ctx!.createRadialGradient(w / 2, hz, 0, w / 2, hz, sunR * 1.7);
      sun.addColorStop(0, accent(0.55));
      sun.addColorStop(0.5, accent(0.20));
      sun.addColorStop(1, accent(0));
      ctx!.fillStyle = sun;
      ctx!.beginPath();
      ctx!.arc(w / 2, hz, sunR * 1.7, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.beginPath();
      ctx!.moveTo(0, hz);
      ctx!.lineTo(w, hz);
      ctx!.strokeStyle = accent(0.9);
      ctx!.lineWidth = 2;
      ctx!.shadowColor = accent(0.8);
      ctx!.shadowBlur = 18;
      ctx!.stroke();
      ctx!.shadowBlur = 0;

      for (let r = 1; r <= ROWS; r++) {
        const depth = r / ROWS;
        ctx!.beginPath();
        for (let c = 0; c <= COLS; c++) {
          const p = project(c, depth, scroll);
          c === 0 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = accent(0.12 + depth * 0.6);
        ctx!.lineWidth = 0.6 + depth * 1.3;
        ctx!.stroke();
      }

      for (let c = 0; c <= COLS; c++) {
        ctx!.beginPath();
        for (let r = 1; r <= ROWS; r++) {
          const depth = r / ROWS;
          const p = project(c, depth, scroll);
          r === 1 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = accent(0.14 + 0.22 * (1 - Math.abs(c - COLS / 2) / (COLS / 2)));
        ctx!.lineWidth = 0.7;
        ctx!.stroke();
      }

      scroll += 0.14 * (speedRef?.current ?? 1);
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    resize();
    frame();
    const onR = () => { resize(); if (reduce) frame(); };
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}
