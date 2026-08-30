import { useEffect, useRef, useState } from "react";

/**
 * Sprocket — the mascot, watching your cursor.
 * The whole image tilts slightly toward the pointer, and a pair of pupils
 * (overlaid) track it. Uses the real pixel-art PNG at /sprocket.png.
 */
export function CursorSprocket({ size = 150 }: { size?: number }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / window.innerWidth;
      const dy = (e.clientY - cy) / window.innerHeight;
      // pupils drift toward cursor, clamped small
      setShift({
        x: Math.max(-1, Math.min(1, dx * 3)) * (size * 0.022),
        y: Math.max(-1, Math.min(1, dy * 3)) * (size * 0.022),
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [size]);

  const faceH = size * (474 / 276);
  const pupilStyle = (leftPct: string): React.CSSProperties => ({
    position: "absolute", left: leftPct, top: "30%", width: "8%",
    imageRendering: "pixelated",
    transform: `translate(-50%, -50%) translate(${shift.x}px, ${shift.y}px)`,
    transition: "transform .12s ease-out",
  });

  return (
    <div ref={wrap} className="relative inline-block float-slow" style={{ width: size, height: faceH }}>
      <img src="/sprocket-face.png" alt="Sprocket, the EcoBot tutor"
        className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} draggable={false} />
      <img src="/sprocket-pupil.png" alt="" aria-hidden style={pupilStyle("38%")} draggable={false} />
      <img src="/sprocket-pupil.png" alt="" aria-hidden style={pupilStyle("60%")} draggable={false} />
    </div>
  );
}

/** Bouncing bar graph — math-powered ambient motion (sine-driven bars). */
export function BouncingBars({ bars = 12, className = "" }: { bars?: number; className?: string }) {
  const [, force] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const loop = () => { force((n) => n + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const t = (performance.now() - start.current) / 1000;
  return (
    <div className={`flex items-end gap-1 ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const v = (Math.sin(t * 2 + i * 0.6) * 0.5 + 0.5) * 0.7 + 0.15;
        return <div key={i} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${v * 100}%`, boxShadow: "0 0 8px hsl(148 84% 47% / 0.5)" }} />;
      })}
    </div>
  );
}

/** Live sensor waveform — a scrolling oscilloscope line. */
export function Waveform({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, w = 0, h = 0;
    const data: number[] = [];
    function resize() { w = canvas!.clientWidth; h = canvas!.clientHeight; canvas!.width = w * dpr; canvas!.height = h * dpr; ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); }
    let last = 0;
    function frame(now: number) {
      if (now - last > 40) {
        last = now;
        data.push(Math.sin(now * 0.004) * 0.4 + (Math.random() - 0.5) * 0.5);
        if (data.length > 60) data.shift();
      }
      ctx!.clearRect(0, 0, w, h);
      ctx!.beginPath();
      data.forEach((d, i) => {
        const x = (i / 59) * w; const y = h / 2 + d * (h / 2 - 4);
        i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
      });
      ctx!.strokeStyle = "hsl(38 96% 58%)"; ctx!.lineWidth = 1.6;
      ctx!.shadowColor = "hsl(38 96% 58%)"; ctx!.shadowBlur = 8; ctx!.stroke(); ctx!.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    resize(); raf = requestAnimationFrame(frame);
    const onR = () => resize(); window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden />;
}
