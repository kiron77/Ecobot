import { useRef, useState, useCallback, useEffect } from "react";

/**
 * SpeedDial — a round rotary knob (like a volume dial) that sits in the centre
 * of the grid path. Drag around it (or up/down) to rotate; rotation sets the
 * grid speed written into speedRef. Shows the multiplier under the knob.
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
  const [angle, setAngle] = useState(() => {
    // start at 1× -> map to angle
    const frac = (1 - min) / (max - min);
    return -135 + frac * 270; // -135°..+135° sweep
  });
  const [speed, setSpeed] = useState(1);
  const knob = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const setFromAngle = useCallback(
    (deg: number) => {
      const clamped = Math.max(-135, Math.min(135, deg));
      const frac = (clamped + 135) / 270;
      const v = min + frac * (max - min);
      setAngle(clamped);
      setSpeed(v);
      speedRef.current = v;
    },
    [min, max, speedRef],
  );

  const angleFromEvent = useCallback((clientX: number, clientY: number) => {
    const el = knob.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 0° points up; clockwise positive
    const deg = (Math.atan2(clientX - cx, cy - clientY) * 180) / Math.PI;
    return deg;
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      setFromAngle(angleFromEvent(x, y));
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
  }, [angleFromEvent, setFromAngle]);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary/60">speed</span>
      <div
        ref={knob}
        onMouseDown={(e) => { dragging.current = true; setFromAngle(angleFromEvent(e.clientX, e.clientY)); }}
        onTouchStart={(e) => { dragging.current = true; setFromAngle(angleFromEvent(e.touches[0].clientX, e.touches[0].clientY)); }}
        className="relative h-16 w-16 cursor-grab rounded-full border border-primary/40 bg-background/50 backdrop-blur-sm active:cursor-grabbing"
        style={{ boxShadow: "0 0 20px -4px hsl(var(--primary) / 0.5), inset 0 0 12px -4px hsl(var(--primary) / 0.4)" }}
        title="Drag to set speed"
      >
        {/* tick marks around the dial */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = (-135 + (i / 10) * 270) * (Math.PI / 180);
          const r1 = 26, r2 = 30;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 bg-primary/40"
              style={{
                width: 1.5, height: 4,
                transform: `translate(-50%,-50%) translate(${Math.sin(a) * ((r1 + r2) / 2)}px, ${-Math.cos(a) * ((r1 + r2) / 2)}px) rotate(${-135 + (i / 10) * 270}deg)`,
              }}
            />
          );
        })}
        {/* rotating indicator */}
        <div
          className="absolute inset-0 transition-transform duration-75"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span
            className="absolute left-1/2 top-2 h-4 w-1 -translate-x-1/2 rounded-full bg-primary"
            style={{ boxShadow: "0 0 8px hsl(var(--primary))" }}
          />
        </div>
        {/* center hub */}
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/70" />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-primary/80">{speed.toFixed(1)}×</span>
    </div>
  );
}
