import { useEffect, useRef, useState } from "react";

/**
 * CodeTerminal — a small terminal panel that types out ecobotOS Python code
 * line by line with a blinking cursor. Decorative "programming the robot live"
 * feel for the hero. Accent-colored, respects reduced-motion.
 */
const LINES = [
  "from ecobotos import robot, sensors",
  "",
  "robot.connect(wifi=True)",
  "robot.motor.speed = 180",
  "",
  "while sensors.distance() > 15:",
  "    robot.move(forward=1)",
  "",
  "robot.turn(deg=90)",
  "robot.led.pulse('green')",
];

export function CodeTerminal({ className = "" }: { className?: string }) {
  const [shown, setShown] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const line = useRef(0);
  const col = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(LINES); return; }

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const l = LINES[line.current];
      if (l === undefined) {
        // done — hold, then restart the loop
        timer = setTimeout(() => {
          setShown([]); setCurrent(""); line.current = 0; col.current = 0; tick();
        }, 2600);
        return;
      }
      if (col.current <= l.length) {
        setCurrent(l.slice(0, col.current));
        col.current++;
        timer = setTimeout(tick, 34 + Math.random() * 40);
      } else {
        setShown((s) => [...s, l]);
        setCurrent("");
        line.current++;
        col.current = 0;
        timer = setTimeout(tick, 260);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`rounded-sm border border-primary/25 bg-background/70 backdrop-blur-sm font-mono text-[11px] leading-relaxed shadow-lg ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 border-b border-primary/15 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-primary/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/15" />
        <span className="ml-2 text-[9px] uppercase tracking-[0.12em] text-primary/50">first_program.py</span>
      </div>
      <div className="p-3 h-40 overflow-hidden">
        {shown.map((l, i) => (
          <div key={i} className="whitespace-pre text-foreground/80">
            <Syntax line={l} />
          </div>
        ))}
        <div className="whitespace-pre text-foreground/80">
          <Syntax line={current} />
          <span className="ml-0.5 inline-block h-3.5 w-1.5 -mb-0.5 animate-pulse bg-primary" />
        </div>
      </div>
    </div>
  );
}

// very small syntax tinting: keywords + strings in accent, comments dim
function Syntax({ line }: { line: string }) {
  const kw = /\b(from|import|while|True|False|def|return)\b/g;
  const parts: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let key = 0;
  while ((m = kw.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(<span key={key++} className="text-primary">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <>{parts}</>;
}
