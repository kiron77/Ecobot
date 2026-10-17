import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CursorSprocket, BouncingBars, Waveform } from "@/components/sprocket";
import {
  ArrowRight, Terminal,
  Radio, UploadCloud, Bug, Code2, ShoppingCart, Cpu, Wifi, Gauge,
} from "lucide-react";

/* ===================== scroll reveal ===================== */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".fade-scroll, .zoom-in, .eco-reveal"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver(
      (ents) => ents.forEach((en) => {
        // Reveal ONCE: as soon as it enters, lock it in and stop watching it.
        // (Toggling in/out caused violent flashing when an element sat on the
        // viewport edge and kept re-crossing the trigger line.)
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      }),
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/* ===================== live terminal ===================== */
const TERMINAL_LINES = [
  "from ecobot_os import EcoBotOS",
  "bot = EcoBotOS()",
  "bot.m1.spin(80)",
  "bot.s1.read()        # 142 mm",
  "if bot.s1.read(bool):",
  "    bot.m1.spin(0)   # obstacle!",
];
function useTypewriter(lines: string[]) {
  const [display, setDisplay] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    let li = 0, ci = 0, committed: string[] = [];
    const on = (fn: () => void, ms: number) => { if (!cancelled) timer = setTimeout(fn, ms); };
    const step = () => {
      const line = lines[li % lines.length];
      if (ci <= line.length) { setCurrent(line.slice(0, ci)); ci++; on(step, 44 + Math.random() * 46); }
      else on(() => {
        committed = [...committed.slice(-4), line]; setDisplay(committed);
        setCurrent(""); ci = 0; li++;
        if (li % lines.length === 0) on(() => { committed = []; setDisplay([]); on(step, 520); }, 1150);
        else on(step, 270);
      }, 680);
    };
    step();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [lines]);
  return { display, current };
}
function Highlight({ text }: { text: string }) {
  const [code, comment] = text.split("#");
  const toks = code.split(/(\bfrom\b|\bimport\b|\bif\b|bot|\.\w+|\(|\)|\d+)/g);
  return (
    <>
      {toks.map((t, i) => {
        let c = "";
        if (t === "from" || t === "import" || t === "if") c = "text-primary";
        else if (t === "bot") c = "text-readout";
        else if (/^\.\w+/.test(t)) c = "text-sky-300";
        else if (/^\d+$/.test(t)) c = "text-amber-300";
        return <span key={i} className={c}>{t}</span>;
      })}
      {comment !== undefined && <span className="text-muted-foreground">#{comment}</span>}
    </>
  );
}
function LiveTerminal() {
  const { display, current } = useTypewriter(TERMINAL_LINES);
  return (
    <div className="term-glow relative rounded-sm border border-primary/25 bg-card/95">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--readout))" }} />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/80" />
        <span className="ml-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" /> ecobot_os · main.py
        </span>
      </div>
      <div className="min-h-[200px] px-4 py-3.5 font-mono text-[12.5px] leading-relaxed">
        {display.map((l, i) => (
          <div key={i} className="whitespace-pre text-foreground/80">
            <span className="mr-3 select-none text-primary/50">{">>>"}</span><Highlight text={l} />
          </div>
        ))}
        <div className="whitespace-pre text-foreground/90">
          <span className="mr-3 select-none text-primary/70">{">>>"}</span><Highlight text={current} />
          <span className="cursor-blink ml-0.5 inline-block h-[15px] w-[7px] -mb-0.5 bg-primary" />
        </div>
      </div>
    </div>
  );
}

/* ===================== live readouts ===================== */
function Readout({ label, unit, min, max, icon: Icon }: {
  label: string; unit: string; min: number; max: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const [val, setVal] = useState((min + max) / 2);
  useEffect(() => {
    const id = setInterval(() => setVal((v) => {
      const n = v + (Math.random() - 0.5) * (max - min) * 0.25;
      return Math.max(min, Math.min(max, n));
    }), 1400);
    return () => clearInterval(id);
  }, [min, max]);
  return (
    <div className="edge flex items-center gap-2.5 rounded-lg border border-border bg-card/80 px-3 py-2.5">
      <Icon className="h-4 w-4 text-primary/70" />
      <div className="flex-1">
        <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-mono text-lg font-semibold tabular-nums text-readout leading-none">
          {val.toFixed(0)}<span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}


/* ===================== feature rundown ===================== */
const MODULES = [
  { name: "Ultrasonic Sensor", desc: "Measures distance so your robot can see and avoid obstacles.", img: "/module-ultrasonic.png", icon: Radio },
  { name: "Motor + Wheel", desc: "Drives your robot forward, reverse, and turns on command.", img: "/module-motor.png", icon: Cpu },
  { name: "The EcoBot Kit", desc: "Pico W brain, power, and module ports on one custom board.", img: "/kit-assembled.png", icon: Terminal },
];

/* handwritten annotations drawn ON each module image (desktop), by card index.
   Each card's sketch ILLUSTRATES its own physics — echo for the ultrasonic,
   a spinning wheel for the motor, a circuit for the board. */
const CARD_NOTES: {
  notes: { cls: string; txt: string }[];
  sketch?: { kind: SketchKind; cls: string };
}[] = [
  { // Ultrasonic — sound bouncing off a wall
    notes: [
      { cls: "left-[2%] top-[4%] text-lg -rotate-3", txt: "d = v·t / 2" },
      { cls: "right-[1%] bottom-[5%] text-base rotate-3", txt: "↳ echo back" },
    ],
    sketch: { kind: "echo", cls: "left-[6%] bottom-[14%]" },
  },
  { // Motor + Wheel — rotation
    notes: [
      { cls: "right-[2%] top-[4%] text-lg rotate-3", txt: "ω = v / r" },
      { cls: "left-[2%] bottom-[5%] text-base -rotate-2", txt: "τ = F·r" },
    ],
    sketch: { kind: "rotation", cls: "right-[8%] bottom-[12%]" },
  },
  { // The EcoBot Kit — circuit
    notes: [
      { cls: "left-[2%] top-[4%] text-lg rotate-2", txt: "V = I·R" },
      { cls: "right-[2%] bottom-[5%] text-base -rotate-3", txt: "↳ Pico W" },
    ],
    sketch: { kind: "circuit", cls: "right-[6%] top-[12%]" },
  },
];

/* modules designed in the PCB editor, not yet fabbed — the growing roadmap */
const ROADMAP: { name: string; file: string; status: string; img: string; desc: string }[] = [
  {
    name: "Camera Module",
    file: "camera.sch",
    status: "In design",
    img: "/camera-module.png",
    desc: "Capture images and stream video — a DVP camera with onboard power monitoring (INA226), built for a dedicated camera port on the next EcoBot motherboard via a ribbon cable.",
  },
  {
    name: "Magnetometer",
    file: "magnetometer.sch",
    status: "In design",
    img: "/magnetometer-module.png",
    desc: "Sense heading and magnetic fields over I²C — a 3-axis magnetometer on an STM32F030 brain with a data-ready interrupt, snapping onto the same bus.",
  },
  {
    name: "Microphone",
    file: "mic.sch",
    status: "In design",
    img: "/mic-module.png",
    desc: "Let your robot hear — a KY-037 sound sensor on an STM32F030 with both analog level and digital threshold output, reporting over the bus.",
  },
  {
    name: "9-Axis IMU",
    file: "imu.sch",
    status: "In design",
    img: "/imu-module.png",
    desc: "Full motion sensing — an MPU-9250 (accelerometer + gyroscope + magnetometer) on an STM32F030, streaming fused orientation over I²C on the same bus.",
  },
  {
    name: "Servo Driver",
    file: "servo.sch",
    status: "In design",
    img: "/servo-module.png",
    desc: "Precise, angle-controlled movement — drive a servo with smooth PWM from an STM32F030 (a 100µF reservoir cap keeps power clean). Where the DC motors just move, this one hits exact positions.",
  },
  {
    name: "Water Level Sensor",
    file: "waterlevel.sch",
    status: "In design",
    img: "/waterlevel-module.png",
    desc: "Sense liquid depth — an analog water-level probe on an STM32F030, reporting fill level over the bus. Built for eco and environmental projects.",
  },
];

const FEATURES = [
  { icon: Radio, name: "IoT dashboard", line: "Live sensor data, streamed" },
  { icon: UploadCloud, name: "OTA upload", line: "Push code over WiFi" },
  { icon: Terminal, name: "Sprocket, your AI tutor", line: "Asks the right questions, not answers" },
  { icon: Bug, name: "AI debug", line: "Catches MicroPython bugs" },
  { icon: Code2, name: "Code editor", line: "MicroPython in the browser" },
  { icon: ShoppingCart, name: "Built-in shop", line: "Buy modules as you grow" },
];

/* ================================ Page ================================ */

/* turning gear (deliberate signature machinery) */
function Gear({ size = 120, dir = "cw", className = "" }: { size?: number; dir?: "cw" | "ccw"; className?: string }) {
  const teeth = 10;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`${dir === "cw" ? "gear-cw" : "gear-ccw"} ${className}`} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="7">
        {Array.from({ length: teeth }).map((_, i) => {
          const a = (i / teeth) * Math.PI * 2;
          return <line key={i} x1={50 + Math.cos(a) * 35} y1={50 + Math.sin(a) * 35} x2={50 + Math.cos(a) * 47} y2={50 + Math.sin(a) * 47} />;
        })}
        <circle cx="50" cy="50" r="35" />
        <circle cx="50" cy="50" r="12" strokeWidth="5" />
      </g>
    </svg>
  );
}

/* ===================== handwritten math decor ===================== */
function Note({ className = "", style, children }: {
  className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  return <span className={`eco-note absolute ${className}`} style={style}>{children}</span>;
}

/* little concept sketches — each one illustrates the IDEA behind its equation,
   not a random circle or arrow. Drawn in the handwriting-green eco-doodle color. */
type SketchKind =
  | "circuit" | "triangle" | "atom" | "force" | "wave"
  | "rotation" | "torque" | "echo" | "circleR" | "unitCircle";
function Sketch({ kind, className = "", style, scale = 1 }: {
  kind: SketchKind; className?: string; style?: React.CSSProperties; scale?: number;
}) {
  const p = { className: `eco-doodle ${className}`, fill: "none", stroke: "currentColor", "aria-hidden": true, style } as const;
  const T = (x: number, y: number, t: string, s = 18) => (
    <text x={x} y={y} fontFamily="'Caveat', cursive" fontSize={s} fill="currentColor" stroke="none">{t}</text>
  );
  switch (kind) {
    case "circleR": // C = 2πr / A = πr²  →  circle with a radius line
      return (<svg {...p} width={120 * scale} height={96 * scale} viewBox="0 0 120 96" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="52" cy="52" r="38" /><line x1="52" y1="52" x2="90" y2="52" />
        <circle cx="52" cy="52" r="2.6" fill="currentColor" stroke="none" />{T(66, 46, "r")}</svg>);
    case "triangle": // a² + b² = c²  →  right triangle
      return (<svg {...p} width={112 * scale} height={96 * scale} viewBox="0 0 112 96" strokeWidth={2.5} strokeLinejoin="round">
        <path d="M18 78 L18 20 L88 78 Z" /><path d="M18 66 L30 66 L30 78" strokeWidth={1.8} />
        {T(3, 54, "a")}{T(46, 92, "b")}{T(58, 44, "c")}</svg>);
    case "atom": // E = mc²  →  nucleus + orbits
      return (<svg {...p} width={104 * scale} height={92 * scale} viewBox="0 0 104 92" strokeWidth={1.8}>
        <ellipse cx="52" cy="46" rx="42" ry="16" /><ellipse cx="52" cy="46" rx="42" ry="16" transform="rotate(60 52 46)" />
        <ellipse cx="52" cy="46" rx="42" ry="16" transform="rotate(120 52 46)" />
        <circle cx="52" cy="46" r="5" fill="currentColor" stroke="none" /><circle cx="94" cy="46" r="3" fill="currentColor" stroke="none" /></svg>);
    case "force": // ∑F = m·a  →  arrow pushing a block, with motion lines
      return (<svg {...p} width={124 * scale} height={80 * scale} viewBox="0 0 124 80" strokeWidth={2.5} strokeLinecap="round">
        <rect x="46" y="28" width="34" height="30" rx="2" /><line x1="10" y1="43" x2="42" y2="43" /><path d="M42 43 l -10 -5 M42 43 l -10 5" />
        <line x1="86" y1="34" x2="100" y2="34" strokeWidth={1.8} /><line x1="86" y1="43" x2="104" y2="43" strokeWidth={1.8} /><line x1="86" y1="52" x2="100" y2="52" strokeWidth={1.8} /></svg>);
    case "wave": // λ = c/f , f = 1/T  →  sine wave with wavelength bracket
      return (<svg {...p} width={132 * scale} height={70 * scale} viewBox="0 0 132 70" strokeWidth={2.5} strokeLinecap="round">
        <path d="M6 36 Q 22 8, 38 36 T 70 36 T 102 36 T 134 36" />
        <line x1="38" y1="50" x2="102" y2="50" strokeWidth={1.6} /><line x1="38" y1="46" x2="38" y2="54" strokeWidth={1.6} /><line x1="102" y1="46" x2="102" y2="54" strokeWidth={1.6} />{T(64, 68, "λ")}</svg>);
    case "rotation": // ω = v/r  →  wheel with spin arrow + radius
      return (<svg {...p} width={104 * scale} height={96 * scale} viewBox="0 0 104 96" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="50" cy="50" r="32" /><line x1="50" y1="50" x2="82" y2="50" /><circle cx="50" cy="50" r="2.4" fill="currentColor" stroke="none" />
        <path d="M70 24 A 32 32 0 0 1 86 54" /><path d="M86 54 l 1 -12 M86 54 l -10 -3" />{T(58, 44, "r")}</svg>);
    case "torque": // τ = F × r  →  lever arm on a pivot, perpendicular force
      return (<svg {...p} width={124 * scale} height={84 * scale} viewBox="0 0 124 84" strokeWidth={2.5} strokeLinecap="round">
        <line x1="22" y1="60" x2="94" y2="60" /><circle cx="22" cy="60" r="4" /><line x1="94" y1="60" x2="94" y2="28" /><path d="M94 28 l -5 10 M94 28 l 5 10" />{T(50, 78, "r")}{T(99, 34, "F")}</svg>);
    case "echo": // d = v·t / 2  →  sensor pinging a wall
      return (<svg {...p} width={132 * scale} height={72 * scale} viewBox="0 0 132 72" strokeWidth={2.2} strokeLinecap="round">
        <rect x="6" y="26" width="18" height="20" rx="2" strokeWidth={2.5} />
        <path d="M28 20 A 18 18 0 0 1 28 52" /><path d="M36 16 A 24 24 0 0 1 36 56" /><path d="M44 12 A 30 30 0 0 1 44 60" />
        <line x1="104" y1="12" x2="104" y2="60" strokeWidth={3} />{T(58, 70, "ping")}</svg>);
    case "unitCircle": // eⁱᵖ+1=0 / sin²+cos²=1  →  unit circle + angle
      return (<svg {...p} width={104 * scale} height={92 * scale} viewBox="0 0 104 92" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="48" cy="48" r="32" /><line x1="12" y1="48" x2="84" y2="48" strokeWidth={1.4} /><line x1="48" y1="14" x2="48" y2="82" strokeWidth={1.4} />
        <line x1="48" y1="48" x2="71" y2="26" /><line x1="71" y1="26" x2="71" y2="48" strokeWidth={1.6} strokeDasharray="3 3" /><circle cx="71" cy="26" r="2.4" fill="currentColor" stroke="none" /></svg>);
    case "circuit": // V = I·R  →  battery + resistor loop
    default:
      return (<svg {...p} width={126 * scale} height={76 * scale} viewBox="0 0 126 76" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 56 L30 22 L52 22" /><path d="M52 22 l 6 -9 l 8 18 l 8 -18 l 8 18 l 6 -9" /><path d="M88 22 L104 22 L104 56" />
        <path d="M104 56 L76 56" /><line x1="70" y1="45" x2="70" y2="67" strokeWidth={3} /><line x1="62" y1="49" x2="62" y2="63" strokeWidth={2} /><path d="M56 56 L30 56" /></svg>);
  }
}

/* A single sparse side mark: one equation + one concept sketch, tucked into the
   page's side gutter (never over content). Rendered inside a <SideGutter/>. */
function SideMark({ side, top, eq, sketch, rot = 0, big = false }: {
  side: "left" | "right"; top: string; eq: string; sketch: SketchKind; rot?: number; big?: boolean;
}) {
  const edge = side === "left" ? "left-3 2xl:left-8 items-start" : "right-3 2xl:right-8 items-end";
  return (
    <div className={`absolute ${edge} ${top} flex max-w-[150px] flex-col`} style={{ transform: `rotate(${rot}deg)` }}>
      <span className={`eco-note ${big ? "text-3xl" : "text-2xl"} leading-none ${side === "right" ? "text-right" : "text-left"}`}>{eq}</span>
      <div className={`mt-2 ${side === "right" ? "self-end" : "self-start"}`}>
        <Sketch kind={sketch} scale={0.72} />
      </div>
    </div>
  );
}

/* Full-bleed gutter layer for one section: pins its SideMarks to the viewport
   edges and only appears when the screen is wide enough to have a real gutter,
   so the math never overlaps the centered content. */
function SideGutter({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-0 hidden h-full w-screen -translate-x-1/2 overflow-hidden min-[1360px]:block" aria-hidden="true">
      {children}
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const go = (p: string) => navigate(p);
  useReveal();

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      {/* motion styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap');
        @keyframes eco-float-kf {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        .eco-float { animation: eco-float-kf 5s ease-in-out infinite; }
        .eco-note {
          font-family: 'Caveat', cursive;
          color: hsl(148 60% 62%);
          opacity: 0.55;
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
          text-shadow: 0 0 12px rgba(20,224,122,0.25);
        }
        .eco-doodle { color: hsl(148 60% 62%); opacity: 0.45; pointer-events: none; }
        /* scroll-in movement: elements slide + fade into place once revealed */
        .eco-reveal {
          opacity: 0;
          transition: opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1);
          will-change: transform, opacity;
        }
        .eco-reveal.in { opacity: 1 !important; transform: none !important; }
        .rv-l { transform: translateX(-60px); }
        .rv-r { transform: translateX(60px); }
        .rv-u { transform: translateY(52px); }
        .rv-z { transform: scale(0.9); }
        @media (prefers-reduced-motion: reduce) {
          .eco-float { animation: none; }
          .eco-reveal { opacity: 1 !important; transform: none !important; transition: none; }
        }
      `}</style>

      {/* ---------- HERO: hardware showcase ---------- */}
      <section className="relative overflow-hidden">
        {/* ambient command-center background */}
        <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-40" />
        <div className="horizon-glow pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
        {/* a few equations in the hero side gutters (never over the content) */}
        <SideGutter>
          <SideMark side="left"  top="top-[24%]" eq="V = I · R"    sketch="circuit"  rot={-6} big />
          <SideMark side="left"  top="top-[64%]" eq="λ = c / f"    sketch="wave"     rot={4} />
          <SideMark side="right" top="top-[20%]" eq="E = mc²"      sketch="atom"     rot={-4} />
          <SideMark side="right" top="top-[60%]" eq="a² + b² = c²" sketch="triangle" rot={5} big />
        </SideGutter>

        {/* nav */}
        <header className="relative z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <img src="/ecobot-logo.png" alt="EcoBot" className="h-8 w-auto" />
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => go("/sign-in")}>Log in</Button>
              <Button onClick={() => go("/sign-up")} className="bg-primary text-primary-foreground hover:brightness-110">
                Sign up <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* hero content: text left, board right */}
        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-20 pt-10 md:grid-cols-2 md:gap-8 md:pb-28 md:pt-16">
          {/* left: copy */}
          <div className="eco-reveal rv-l order-2 text-center md:order-1 md:text-left">
            <div className="fade-scroll in mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 font-mono text-xs text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Raspberry Pi Pico W · modular robotics
            </div>
            <h1 className="fade-scroll in font-display text-[2.6rem] font-bold leading-[1.04] sm:text-6xl md:text-6xl lg:text-7xl" style={{ textWrap: "balance" }}>
              <span className="grad-type">Real robots,</span>{" "}
              <span className="text-primary text-glow">built from scratch.</span>
            </h1>
            <p className="fade-scroll in mx-auto mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl md:mx-0">
              A modular kit that teaches kids to build and program robots that actually move, sense, and respond to the real world.
            </p>
            <div className="fade-scroll in mt-9 flex flex-wrap justify-center gap-3 md:justify-start">
              <Button size="lg" onClick={() => go("/sign-up")} className="bg-primary text-primary-foreground hover:brightness-110">
                Start building <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <a href="#workbench" className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-5 py-3 text-sm font-semibold transition hover:border-primary/60 hover:bg-primary/8">
                Get the kit
              </a>
            </div>
          </div>

          {/* right: the real board, with a soft green glow + math drawn ON it */}
          <div className="eco-reveal rv-r relative order-1 mx-auto w-full max-w-xl md:order-2">
            <div className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-full bg-primary/20 blur-3xl" />
            <img
              src="/hardware-hero.png"
              alt="The EcoBot motherboard — a custom PCB with a Raspberry Pi Pico W, module ports, and power, powered on."
              className="w-full h-auto drop-shadow-[0_8px_40px_rgba(20,224,122,0.25)]"
            />
            {/* annotations drawn directly over the board (desktop) */}
            <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
              <Note className="left-[6%] top-[8%] text-xl rotate-3" style={{ opacity: 0.75 }}>3 × 1.5V = 4.5V</Note>
              <Note className="right-[8%] top-[22%] text-2xl -rotate-3" style={{ opacity: 0.75 }}>V = I · R</Note>
              {/* circle around the Pico W (points at the real part) */}
              <svg className="eco-doodle absolute left-[46%] top-[30%]" width="120" height="76" viewBox="0 0 130 80" fill="none" aria-hidden="true">
                <ellipse cx="65" cy="40" rx="58" ry="32" stroke="currentColor" strokeWidth="2.5" transform="rotate(-6 65 40)" />
              </svg>
              <Note className="left-[30%] top-[18%] text-base rotate-2" style={{ opacity: 0.8 }}>↳ Pico W</Note>
              {/* arrow pointing at a module port */}
              <svg className="eco-doodle absolute right-[20%] bottom-[24%]" width="90" height="60" viewBox="0 0 90 60" fill="none" aria-hidden="true">
                <path d="M5 50 C 30 10, 55 55, 82 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M82 12 l -12 2 M82 12 l -3 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <Note className="right-[6%] bottom-[14%] text-lg rotate-3" style={{ opacity: 0.75 }}>module port</Note>
              <Note className="left-[8%] bottom-[16%] text-xl -rotate-2" style={{ opacity: 0.75 }}>GPIO → one wire</Note>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- WORKBENCH: terminal window bleeding off the right ---------- */}
      <section id="workbench" className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-32">
        <SideGutter>
          <SideMark side="left"  top="top-[32%]" eq="f = 1 / T" sketch="wave"    rot={-5} />
          <SideMark side="right" top="top-[58%]" eq="P = I · V" sketch="circuit" rot={4} />
        </SideGutter>
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.15fr] md:gap-8">
          <div className="eco-reveal rv-l">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">Real code, real hardware</div>
            <h2 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl" style={{ textWrap: "balance" }}>
              Your robot’s <span className="text-primary text-glow">command center</span>.
            </h2>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Everything you type runs on your own board over WiFi. This is the real EcoBotOS API, preloaded on every Pico W.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-2">
              <Readout label="Distance" unit="mm" min={40} max={480} icon={Gauge} />
              <Readout label="Motor" unit="%" min={0} max={100} icon={Cpu} />
              <Readout label="Signal" unit="dBm" min={40} max={90} icon={Wifi} />
            </div>
            <div className="mt-3 grid max-w-md grid-cols-2 gap-2">
              <div className="edge rounded-lg border border-border bg-card/80 p-3">
                <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Motor load</div>
                <BouncingBars bars={14} className="h-12" />
              </div>
              <div className="edge rounded-lg border border-border bg-card/80 p-3">
                <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Ultrasonic echo</div>
                <Waveform className="h-[52px] w-full" />
              </div>
            </div>
          </div>
          {/* tilted terminal, bleeds slightly off the right edge */}
          <div className="eco-reveal rv-r relative md:-mr-20">
            <div className="tilt-window-r">
              <LiveTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CATALOG: real modules + handwritten math ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-28">
        {/* hardware accents flush against the VIEWPORT edges (full-bleed layer) */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-full w-screen -translate-x-1/2 hidden overflow-hidden min-[1360px]:block" aria-hidden="true">
          {/* right edge: stacked wheels with the circle math they earn */}
          <div className="absolute right-0 top-[26%] w-44 opacity-90">
            <img src="/wheels-stacked.png" alt="A pair of EcoBot drive wheels." className="eco-float w-full object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]" style={{ animationDelay: "1.2s" }} />
            <Note className="-left-20 top-2 text-2xl rotate-6" style={{ opacity: 0.75 }}>C = 2πr</Note>
            <Note className="-left-16 top-12 text-lg -rotate-3" style={{ opacity: 0.7 }}>A = πr²</Note>
            <Sketch kind="circleR" className="absolute -left-24 top-20" style={{ opacity: 0.55 }} />
          </div>
          {/* left edge: the ultrasonic being plugged in by hand, touching the screen */}
          <div className="absolute left-0 bottom-[8%] w-60 opacity-95">
            <img src="/ultrasonic-plugged.png" alt="A hand plugging an ultrasonic sensor module into the board." className="eco-float w-full object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]" style={{ animationDelay: "0.6s" }} />
            <Note className="right-2 -top-2 text-xl -rotate-6" style={{ opacity: 0.75 }}>plug &amp; sense</Note>
            <Sketch kind="echo" className="absolute right-0 top-6" scale={0.75} style={{ opacity: 0.5 }} />
          </div>
        </div>
        <div className="fade-scroll relative z-10 mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">The catalog</div>
        <div className="fade-scroll relative z-10 mb-12 max-w-xl">
          <h2 className="font-display text-4xl font-bold sm:text-5xl" style={{ textWrap: "balance" }}>Snap on what your build needs</h2>
          <p className="mt-3 text-lg text-muted-foreground">One module at a time. Each carries its own brain and speaks over a single wire.</p>
        </div>
        <div className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <div key={m.name} className="eco-reveal rv-u" style={{ transitionDelay: `${i * 140}ms` }}>
            <div
              className="eco-float group relative h-full overflow-hidden rounded-sm border border-border bg-card/60 p-5 transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_12px_48px_-12px_rgba(20,224,122,0.4)]"
              style={{ animationDelay: `${i * 0.4}s` }}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-40" />
              <div className="relative mb-4 flex h-40 items-center justify-center">
                <img src={m.img} alt={m.name} className="max-h-40 w-auto object-contain drop-shadow-[0_6px_24px_rgba(20,224,122,0.2)] transition-transform duration-500 group-hover:scale-105" />
                {/* handwritten math drawn ON the module image (desktop) */}
                {CARD_NOTES[i] && (
                  <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
                    {CARD_NOTES[i].notes.map((n, k) => (
                      <Note key={k} className={n.cls} style={{ opacity: 0.8 }}>{n.txt}</Note>
                    ))}
                    {CARD_NOTES[i].sketch && (
                      <Sketch kind={CARD_NOTES[i].sketch!.kind} className={`absolute ${CARD_NOTES[i].sketch!.cls}`} scale={0.8} style={{ opacity: 0.55 }} />
                    )}
                  </div>
                )}
              </div>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <m.icon className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- PIPELINE: modules designed, not yet fabbed ---------- */}
      {ROADMAP.length > 0 && (
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-28">
        <SideGutter>
          <SideMark side="left" top="top-[36%]" eq="ƒ/2.8" sketch="echo" rot={-5} />
        </SideGutter>
        <div className="fade-scroll mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">On the workbench</div>
        <div className="fade-scroll mb-12 max-w-xl">
          <h2 className="font-display text-4xl font-bold sm:text-5xl" style={{ textWrap: "balance" }}>More modules in the pipeline</h2>
          <p className="mt-3 text-lg text-muted-foreground">Designed in a PCB editor and ready for fabrication the moment there's funding behind them. The EcoBot ecosystem keeps growing.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map((m, i) => (
            <div key={m.name} className="eco-reveal rv-u" style={{ transitionDelay: `${i * 120}ms` }}>
              <div className="group relative h-full overflow-hidden rounded-sm border border-border bg-card/60 p-5 transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_12px_48px_-12px_rgba(20,224,122,0.4)]">
                {/* PCB-editor viewport showing the schematic */}
                <div className="mb-4 overflow-hidden rounded-md border border-primary/20 bg-[#f6f6f1]">
                  <div className="flex items-center gap-1.5 border-b border-black/10 bg-[#ecece4] px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                    <span className="ml-2 font-mono text-[10px] text-black/50">{m.file}</span>
                  </div>
                  <img src={m.img} alt={`${m.name} schematic`} className="h-40 w-full object-contain p-2" />
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />{m.status}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold">{m.name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ---------- WHAT'S INSIDE: feature rundown ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-28">
        <SideGutter>
          <SideMark side="right" top="top-[28%]" eq="λ = c / f" sketch="wave"   rot={5} />
          <SideMark side="left"  top="top-[60%]" eq="τ = F × r" sketch="torque" rot={-5} />
        </SideGutter>
        <div className="fade-scroll mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">What’s inside</div>
        <div className="fade-scroll mb-12 max-w-xl">
          <h2 className="font-display text-4xl font-bold sm:text-5xl" style={{ textWrap: "balance" }}>One place for the whole build</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.name}
              className="feat-card eco-reveal rv-u edge relative flex items-start gap-3 overflow-hidden rounded-sm border border-border bg-card/60 p-4"
              style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="feat-icon grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="text-sm font-semibold">{f.name}</div>
                <div className="text-xs text-muted-foreground">{f.line}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- THE APP: iPhone mockups ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl overflow-hidden px-5 py-24 md:py-28">
        <div className="fade-scroll mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">The app</div>
        <div className="fade-scroll mb-14 max-w-xl">
          <h2 className="font-display text-4xl font-bold sm:text-5xl" style={{ textWrap: "balance" }}>
            Code it from <span className="text-primary text-glow">anywhere</span>.
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Write real MicroPython, catch your own bugs instantly, and let Sprocket explain anything. On your laptop, tablet, or phone.
          </p>
        </div>

        <div className="relative grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          {/* phones — slide in from opposite sides, kept clean (no math over them) */}
          <div className="relative flex items-end justify-center gap-4 sm:gap-6">
            <div className="pointer-events-none absolute inset-0 -z-10 mx-auto h-full w-3/4 rounded-full bg-primary/15 blur-3xl" />
            <div className="eco-reveal rv-l w-[46%] max-w-[240px]">
              <img
                src="/app-dashboard.png"
                alt="EcoBot dashboard on a phone — connect your Pico W, see your sketches and AI sessions."
                className="eco-float w-full translate-y-4 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                style={{ animationDelay: "0s" }}
              />
            </div>
            <div className="eco-reveal rv-r w-[46%] max-w-[240px]" style={{ transitionDelay: "140ms" }}>
              <img
                src="/app-editor.png"
                alt="EcoBot code editor on a phone — live debugging with error explanations and suggested fixes."
                className="eco-float w-full -translate-y-4 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                style={{ animationDelay: "0.8s" }}
              />
            </div>
          </div>

          {/* feature points */}
          <div className="space-y-6">
            {[
              { icon: Code2, title: "A real code editor", line: "Full MicroPython editor with syntax highlighting, right in the browser." },
              { icon: Bug, title: "Instant debugging", line: "Errors are caught and highlighted as you type, before you ever run." },
              { icon: Terminal, title: "Sprocket explains it", line: "Stuck on an error? Your AI tutor breaks it down in plain language." },
              { icon: Wifi, title: "Upload over USB or WiFi", line: "Push your code straight to the Pico W and watch it come alive." },
            ].map((f, i) => (
              <div key={f.title} className="eco-reveal rv-r flex items-start gap-4" style={{ transitionDelay: `${i * 90}ms` }}>
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-base font-semibold">{f.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{f.line}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA: cinematic, Sprocket stands to the side ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-28">
        <SideGutter>
          <SideMark side="left"  top="top-[26%]" eq="E = mc²"  sketch="atom"  rot={-6} />
          <SideMark side="right" top="top-[52%]" eq="∑F = m·a" sketch="force" rot={5} />
        </SideGutter>
        <div className="zoom-in cta-box glow-pulse relative overflow-hidden rounded-md border border-primary/30 bg-card/70 px-6 py-20 text-center">
          <div className="horizon-glow pointer-events-none absolute inset-x-0 bottom-0 h-2/3 opacity-70" />
          <div className="pointer-events-none absolute right-6 top-6 text-primary/12"><Gear size={90} dir="ccw" /></div>
          {/* Sprocket stands at the lower-left, peeking in, watching your cursor */}
          <div className="pointer-events-none absolute bottom-0 left-2 z-20 hidden sm:block md:left-8">
            <CursorSprocket size={150} />
          </div>
          <div className="relative sm:pl-40 md:pl-48">
            <h2 className="font-display text-4xl font-bold sm:text-6xl" style={{ textWrap: "balance" }}>
              Ready to bring it to life?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
              Sprocket is watching. He'll walk you through your first build, one question at a time.
            </p>
            <Button size="lg" onClick={() => go("/sign-up")} className="mt-8 bg-primary text-primary-foreground hover:brightness-110">
              Start building <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            {/* Sprocket appears above text on mobile (no side room) */}
            <div className="mt-8 flex justify-center sm:hidden">
              <CursorSprocket size={120} />
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 font-mono text-xs text-muted-foreground sm:flex-row">
          <img src="/ecobot-logo.png" alt="EcoBot" className="h-6 w-auto opacity-80" />
          <span>Built from recycling up · Powered by Raspberry Pi Pico W</span>
        </div>
      </footer>
    </div>
  );
}
