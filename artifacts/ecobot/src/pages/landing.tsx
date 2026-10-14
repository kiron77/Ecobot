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
    const els = Array.from(document.querySelectorAll<HTMLElement>(".fade-scroll, .zoom-in"));
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
        @media (prefers-reduced-motion: reduce) { .eco-float { animation: none; } }
      `}</style>
      {/* ---------- HERO: hardware showcase ---------- */}
      <section className="relative overflow-hidden">
        {/* ambient command-center background */}
        <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-40" />
        <div className="horizon-glow pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
        {/* handwritten math scattered in the hero (desktop) */}
        <div className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block" aria-hidden="true">
          <span className="eco-note absolute right-[6%] top-[14%] text-2xl rotate-6">V = I × R</span>
          <span className="eco-note absolute right-[44%] bottom-[12%] text-xl -rotate-3">3 × 1.5V = 4.5V</span>
          <span className="eco-note absolute right-[2%] bottom-[20%] text-lg rotate-3">← Pico W</span>
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

        {/* hero content: text left, board right */}
        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-20 pt-10 md:grid-cols-2 md:gap-8 md:pb-28 md:pt-16">
          {/* left: copy */}
          <div className="order-2 text-center md:order-1 md:text-left">
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

          {/* right: the real board, with a soft green glow */}
          <div className="fade-scroll in relative order-1 mx-auto w-full max-w-xl md:order-2">
            <div className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-full bg-primary/20 blur-3xl" />
            <img
              src="/hardware-hero.png"
              alt="The EcoBot motherboard — a custom PCB with a Raspberry Pi Pico W, module ports, and power, powered on."
              className="w-full h-auto drop-shadow-[0_8px_40px_rgba(20,224,122,0.25)]"
            />
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

      {/* ---------- CATALOG: real modules + handwritten math ---------- */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24 md:py-28">
        {/* scattered handwritten equations + sketch doodles (desktop only) */}
        <div className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block" aria-hidden="true">
          <span className="eco-note absolute left-[2%] top-[22%] text-2xl -rotate-6">v = d / t</span>
          <span className="eco-note absolute right-[3%] top-[30%] text-3xl rotate-6">distance = (v × t) / 2</span>
          <span className="eco-note absolute left-[6%] bottom-[18%] text-2xl rotate-3">P = I × V</span>
          <span className="eco-note absolute right-[7%] bottom-[22%] text-xl -rotate-3">F = m·a</span>
          <span className="eco-note absolute left-[44%] top-[8%] text-lg rotate-2">↳ reads distance</span>
          {/* little sketch arrow */}
          <svg className="eco-doodle absolute right-[18%] top-[44%]" width="90" height="60" viewBox="0 0 90 60" fill="none">
            <path d="M5 50 C 30 10, 55 55, 82 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M82 12 l -12 2 M82 12 l -3 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          {/* circled note */}
          <svg className="eco-doodle absolute left-[16%] top-[40%]" width="120" height="70" viewBox="0 0 120 70" fill="none">
            <ellipse cx="60" cy="35" rx="54" ry="26" stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 0" transform="rotate(-6 60 35)"/>
          </svg>
          {/* underline squiggle */}
          <svg className="eco-doodle absolute right-[30%] bottom-[14%]" width="110" height="16" viewBox="0 0 110 16" fill="none">
            <path d="M2 8 Q 18 2, 34 8 T 68 8 T 104 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
          {/* more equations */}
          <span className="eco-note absolute left-[30%] bottom-[8%] text-xl -rotate-2">ω = v / r</span>
          <span className="eco-note absolute right-[2%] top-[58%] text-2xl rotate-6">τ = F × r</span>
          <span className="eco-note absolute left-[2%] top-[52%] text-lg rotate-4">RPM ∝ duty%</span>
          <span className="eco-note absolute right-[20%] top-[8%] text-lg -rotate-3">if dist &lt; 10: stop()</span>
          {/* stacked wheels — floating hardware accent with its own note */}
          <div className="absolute right-[1%] bottom-[2%] w-40 opacity-90">
            <img src="/wheels-stacked.png" alt="A pair of EcoBot drive wheels." className="eco-float w-full object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]" style={{ animationDelay: "1.2s" }} />
            <span className="eco-note absolute -left-16 top-4 text-lg rotate-6" style={{ opacity: 0.7 }}>C = 2πr</span>
          </div>
        </div>
        <div className="fade-scroll relative z-10 mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">The catalog</div>
        <div className="fade-scroll relative z-10 mb-12 max-w-xl">
          <h2 className="font-display text-4xl font-bold sm:text-5xl" style={{ textWrap: "balance" }}>Snap on what your build needs</h2>
          <p className="mt-3 text-lg text-muted-foreground">One module at a time. Each carries its own brain and speaks over a single wire.</p>
        </div>
        <div className="relative z-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <div
              key={m.name}
              className="eco-float fade-scroll group relative overflow-hidden rounded-sm border border-border bg-card/60 p-5 transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_12px_48px_-12px_rgba(20,224,122,0.4)]"
              style={{ transitionDelay: `${i * 90}ms`, animationDelay: `${i * 0.4}s` }}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-40" />
              <div className="relative mb-4 flex h-40 items-center justify-center">
                <img src={m.img} alt={m.name} className="max-h-40 w-auto object-contain drop-shadow-[0_6px_24px_rgba(20,224,122,0.2)] transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <m.icon className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
          {/* phones */}
          <div className="relative flex items-end justify-center gap-4 sm:gap-6">
            <div className="pointer-events-none absolute inset-0 -z-10 mx-auto h-full w-3/4 rounded-full bg-primary/15 blur-3xl" />
            <img
              src="/app-dashboard.png"
              alt="EcoBot dashboard on a phone — connect your Pico W, see your sketches and AI sessions."
              className="eco-float w-[46%] max-w-[240px] translate-y-4 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              style={{ animationDelay: "0s" }}
            />
            <img
              src="/app-editor.png"
              alt="EcoBot code editor on a phone — live debugging with error explanations and suggested fixes."
              className="eco-float w-[46%] max-w-[240px] -translate-y-4 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              style={{ animationDelay: "0.8s" }}
            />
          </div>

          {/* feature points */}
          <div className="space-y-6">
            {[
              { icon: Code2, title: "A real code editor", line: "Full MicroPython editor with syntax highlighting, right in the browser." },
              { icon: Bug, title: "Instant debugging", line: "Errors are caught and highlighted as you type, before you ever run." },
              { icon: Terminal, title: "Sprocket explains it", line: "Stuck on an error? Your AI tutor breaks it down in plain language." },
              { icon: Wifi, title: "Upload over USB or WiFi", line: "Push your code straight to the Pico W and watch it come alive." },
            ].map((f, i) => (
              <div key={f.title} className="fade-scroll flex items-start gap-4" style={{ transitionDelay: `${i * 80}ms` }}>
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
