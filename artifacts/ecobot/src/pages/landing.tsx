import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { GridTerrain } from "@/components/grid-terrain";
import { CodeTerminal } from "@/components/code-terminal";
import { SpeedDial } from "@/components/speed-dial";
import { PingRadar } from "@/components/ping-radar";
import { CursorSprocket, BouncingBars, Waveform } from "@/components/sprocket";
import {
  ArrowRight, ChevronLeft, ChevronRight, Terminal,
  Radio, UploadCloud, Bug, Code2, ShoppingCart, Cpu, Wifi, Gauge,
} from "lucide-react";

/* ===================== scroll reveal ===================== */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".fade-scroll, .zoom-in"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver(
      (ents) => ents.forEach((en) => {
        // fade in AND out: toggle based on whether it's in view
        en.target.classList.toggle("in", en.isIntersecting);
      }),
      { threshold: 0.12, rootMargin: "-8% 0px -8% 0px" },
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

/* ===================== coverflow ===================== */
type Slide = { title: string; caption: string };
const SLIDES: Slide[] = [
  { title: "Ultrasonic module", caption: "STM32 + HC-SR04, one I2C address" },
  { title: "Motor driver board", caption: "Dual H-bridge, four motors" },
  { title: "Live IoT dashboard", caption: "Sensor data, streamed in real time" },
  { title: "The motherboard", caption: "Pico W, 8 sensor ports, 2 motor rails" },
  { title: "Servo module", caption: "Precise angle control, snap-on" },
];
function Coverflow() {
  const [idx, setIdx] = useState(0);
  const n = SLIDES.length;
  const paused = useRef(false);
  const go = useCallback((dir: number) => setIdx((i) => (i + dir + n) % n), [n]);
  useEffect(() => {
    const id = setInterval(() => { if (!paused.current) setIdx((i) => (i + 1) % n); }, 3200);
    return () => clearInterval(id);
  }, [n]);
  const startX = useRef<number | null>(null);
  const onDown = (x: number) => { startX.current = x; paused.current = true; };
  const onUp = (x: number) => {
    if (startX.current !== null) { const dx = x - startX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }
    startX.current = null; setTimeout(() => (paused.current = false), 600);
  };
  const offsetOf = (i: number) => { let d = i - idx; if (d > n / 2) d -= n; if (d < -n / 2) d += n; return d; };
  return (
    <div
      className="relative select-none"
      onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}
      onTouchStart={(e) => onDown(e.touches[0].clientX)} onTouchEnd={(e) => onUp(e.changedTouches[0].clientX)}
      onMouseDown={(e) => onDown(e.clientX)} onMouseUp={(e) => onUp(e.clientX)}
    >
      <div className="relative mx-auto h-[300px] max-w-3xl sm:h-[340px]" style={{ perspective: "1400px" }}>
        {SLIDES.map((s, i) => {
          const d = offsetOf(i); const abs = Math.abs(d);
          if (abs > 1) return <div key={i} aria-hidden className="pointer-events-none absolute inset-0 opacity-0" />;
          const isCenter = d === 0;
          return (
            <div key={i}
              className="absolute left-1/2 top-1/2 w-[62%] max-w-md transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] sm:w-[56%]"
              style={{
                transform: `translate(-50%,-50%) translateX(${d * 62}%) scale(${isCenter ? 1 : 0.78}) rotateY(${d * -22}deg)`,
                zIndex: isCenter ? 30 : 10, opacity: isCenter ? 1 : 0.5,
              }}>
              <div className={`edge overflow-hidden rounded-sm border bg-card ${isCenter ? "border-primary/30 term-glow" : "border-border"}`}>
                <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-card to-background">
                  <div className="px-5 text-center">
                    <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg bg-primary/10">
                      <Cpu className={`h-5 w-5 ${isCenter ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">[ photo ]</div>
                  </div>
                </div>
                <div className="border-t border-border px-4 py-2.5">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.caption}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => go(-1)} aria-label="Previous"
        className="absolute left-0 top-1/2 z-40 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground transition hover:border-primary/50 hover:text-primary">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={() => go(1)} aria-label="Next"
        className="absolute right-0 top-1/2 z-40 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground transition hover:border-primary/50 hover:text-primary">
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="mt-14 flex justify-center gap-2.5">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === idx ? "w-7 bg-primary" : "w-2 bg-border hover:bg-muted-foreground"}`} />
        ))}
      </div>
    </div>
  );
}

/* ===================== feature rundown ===================== */
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

export default function Landing() {
  const speedRef = useRef(1);
  const [, navigate] = useLocation();
  const go = (p: string) => navigate(p);
  useReveal();

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      {/* ---------- HERO: signature living background ---------- */}
      <section className="relative min-h-[92vh] overflow-hidden">
        {/* synthwave 3D grid terrain */}
        <GridTerrain speedRef={speedRef} />
        {/* horizon grid + glow */}
        <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-50" />
        <div className="horizon-glow pointer-events-none absolute inset-x-0 bottom-0 h-2/3" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        <div className="pointer-events-none absolute -left-10 top-32 text-primary/20"><Gear size={150} dir="cw" /></div>
        <div className="pointer-events-none absolute right-8 top-52 text-primary/15 hidden sm:block"><Gear size={90} dir="ccw" /></div>

        {/* ecobotOS code typing terminal, bottom-left over the terrain */}
        <div className="absolute bottom-24 left-4 z-10 hidden w-64 sm:block md:left-8">
          <CodeTerminal />
        </div>

        {/* speed dial in the centre of the path */}
        <div className="absolute bottom-20 left-1/2 z-10 hidden -translate-x-1/2 sm:block">
          <SpeedDial speedRef={speedRef} />
        </div>

        {/* wifi ping radar, bottom-right over the terrain */}
        <div className="absolute bottom-24 right-4 z-10 hidden w-36 sm:block md:right-8">
          <PingRadar />
        </div>

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

        {/* hero content */}
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 pb-24 pt-16 text-center sm:pt-24">
          <div className="fade-scroll in mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 font-mono text-xs text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Raspberry Pi Pico W · modular robotics
          </div>
          <h1 className="fade-scroll in font-display text-[2.75rem] font-bold leading-[1.02] sm:text-7xl sm:leading-[0.98] md:text-8xl" style={{ textWrap: "balance" }}>
            <span className="grad-type">Build something</span>
            <br className="hidden sm:block" />{" "}
            <span className="text-primary text-glow">that moves.</span>
          </h1>
          <p className="fade-scroll in mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
            A real robot from bare boards. Write the code that runs it, and watch its sensors report back live.
          </p>
          <div className="fade-scroll in mt-9 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => go("/sign-up")} className="bg-primary text-primary-foreground hover:brightness-110">
              Open the workbench <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <a href="#workbench" className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-5 py-3 text-sm font-semibold transition hover:border-primary/60 hover:bg-primary/8">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ---------- WORKBENCH: terminal window bleeding off the right ---------- */}
      <section id="workbench" className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-32">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.15fr] md:gap-8">
          <div className="fade-scroll">
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
          <div className="fade-scroll relative md:-mr-20">
            <div className="tilt-window-r">
              <LiveTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CATALOG: coverflow ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-28">
        <div className="fade-scroll mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">The catalog</div>
        <div className="fade-scroll mb-12 max-w-xl">
          <h2 className="font-display text-4xl font-bold sm:text-5xl" style={{ textWrap: "balance" }}>Snap on what your build needs</h2>
          <p className="mt-3 text-lg text-muted-foreground">One module at a time. Each carries its own brain and speaks over a single wire.</p>
        </div>
        <div className="fade-scroll"><Coverflow /></div>
      </section>

      {/* ---------- WHAT'S INSIDE: feature rundown ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-28">
        <div className="fade-scroll mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">What’s inside</div>
        <div className="fade-scroll mb-12 max-w-xl">
          <h2 className="font-display text-4xl font-bold sm:text-5xl" style={{ textWrap: "balance" }}>One place for the whole build</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.name}
              className="feat-card fade-scroll edge relative flex items-start gap-3 overflow-hidden rounded-sm border border-border bg-card/60 p-4"
              style={{ transitionDelay: `${i * 60}ms` }}>
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

      {/* ---------- CTA: cinematic, Sprocket stands to the side ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-28">
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
