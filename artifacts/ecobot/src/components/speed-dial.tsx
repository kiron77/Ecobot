import { useRef, useState, useCallback, useEffect } from "react";
import { Gauge } from "lucide-react";

/**
 * SpeedDial — a clean gauge icon that sits in the centre of the grid path.
 * Drag up/down (or left/right) to change the grid speed written into speedRef.
 * The gauge needle rotates with the speed. No hand-drawn knob.
 */
export function SpeedDial({
  speedRef,
  min = 0.2,
  max = 3,
}: {
  speedRef: React.MutableRefObject<number>;
  min?: number;
  max?: number;
}) {
  const [speed, setSpeed] = useState(1);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startSpeed = useRef(1);

  const apply = useCallback((v: number) => {
    const c = Math.max(min, Math.min(max, v));
    setSpeed(c);
    speedRef.current = c;
  }, [min, max, speedRef]);

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      // drag up = faster, down = slower
      const dy = startY.current - y;
      apply(startSpeed.current + dy / 60);
    };
    const up = () => (dragging.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [apply]);

  const begin = (clientY: number) => {
    dragging.current = true;
    startY.current = clientY;
    startSpeed.current = speed;
  };

  // map speed → subtle rotation for a "needle moving" feel
  const rot = ((speed - min) / (max - min)) * 90 - 45;

  return (
    <div className="flex select-none flex-col items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary/60">speed</span>
      <button
        onMouseDown={(e) => begin(e.clientY)}
        onTouchStart={(e) => begin(e.touches[0].clientY)}
        className="grid h-12 w-12 cursor-ns-resize place-items-center rounded-full border border-primary/40 bg-background/50 text-primary backdrop-blur-sm transition-transform active:scale-95"
        style={{ boxShadow: "0 0 18px -4px hsl(var(--primary) / 0.5)" }}
        title="Drag up/down to set speed"
        aria-label="Grid speed control"
      >
        <Gauge className="h-6 w-6 transition-transform" style={{ transform: `rotate(${rot}deg)` }} />
      </button>
      <span className="font-mono text-[10px] tabular-nums text-primary/80">{speed.toFixed(1)}×</span>
    </div>
  );
}
