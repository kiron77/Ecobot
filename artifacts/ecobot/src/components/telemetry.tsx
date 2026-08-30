import { useEffect, useState } from "react";

/**
 * Telemetry — three rapidly flickering fake sensor readouts for the hero.
 * Decorative "command center" vibe. Uses the app accent color.
 */
const ROWS = [
  { label: "VEL", unit: "mm/s", min: 120, max: 480 },
  { label: "PWR", unit: "mA", min: 300, max: 900 },
  { label: "SIG", unit: "dBm", min: 40, max: 92 },
];

export function Telemetry({ className = "" }: { className?: string }) {
  const [vals, setVals] = useState<number[]>(ROWS.map((r) => (r.min + r.max) / 2));

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => {
      setVals(ROWS.map((r) => r.min + Math.random() * (r.max - r.min)));
    }, 90); // rapid flicker
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`rounded-sm border border-primary/20 bg-background/40 backdrop-blur-sm px-3 py-2.5 ${className}`}
      aria-hidden="true"
    >
      <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-primary/70">
        telemetry
      </div>
      <div className="space-y-1">
        {ROWS.map((r, i) => (
          <div key={r.label} className="flex items-center justify-between gap-4 font-mono text-[11px]">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tabular-nums text-primary" style={{ textShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}>
              {Math.round(vals[i])}
              <span className="ml-1 text-[9px] text-primary/50">{r.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
