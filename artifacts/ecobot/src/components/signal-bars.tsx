import { useEffect, useRef } from "react";

/**
 * SignalBars — a small decorative "live signal" bar graph that dances on its
 * own (sine-driven, no data). Uses the app accent color. For the hero corner.
 */
export function SignalBars({ bars = 16, className = "" }: { bars?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>("span[data-bar]"));
    if (reduce) {
      spans.forEach((s) => (s.style.height = "40%"));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      spans.forEach((s, i) => {
        const v =
          (Math.sin(t * 2.4 + i * 0.55) * 0.5 + 0.5) * 0.6 +
          (Math.sin(t * 5.1 + i * 1.3) * 0.5 + 0.5) * 0.3 +
          0.1;
        s.style.height = `${Math.min(100, v * 100)}%`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bars]);

  return (
    <div
      className={`rounded-sm border border-primary/20 bg-background/40 backdrop-blur-sm p-3 ${className}`}
      aria-hidden="true"
    >
      <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-primary/70">
        signal · live
      </div>
      <div ref={ref} className="flex h-12 items-end gap-[3px]">
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            data-bar
            className="flex-1 rounded-[1px] bg-primary"
            style={{ height: "30%", boxShadow: "0 0 6px hsl(var(--primary) / 0.6)" }}
          />
        ))}
      </div>
    </div>
  );
}
