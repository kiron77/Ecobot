import { Wifi } from "lucide-react";

/**
 * PingRadar — concentric pulse rings radiating out from a wifi icon, like the
 * robot broadcasting a signal. Pure CSS animation, accent-colored.
 */
export function PingRadar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-sm border border-primary/25 bg-background/60 backdrop-blur-sm p-4 ${className}`}
      aria-hidden="true"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-primary/60">link</span>
        <span className="font-mono text-[9px] text-primary/80">online</span>
      </div>
      <div className="relative mx-auto grid h-20 w-20 place-items-center">
        {/* pulse rings */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border border-primary/50"
            style={{
              animation: "ping-ring 2.4s cubic-bezier(0,0,0.2,1) infinite",
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
        {/* center wifi */}
        <span
          className="relative grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary"
          style={{ boxShadow: "0 0 16px -2px hsl(var(--primary) / 0.6)" }}
        >
          <Wifi className="h-4 w-4" />
        </span>
      </div>
      <style>{`
        @keyframes ping-ring {
          0%   { transform: scale(0.35); opacity: 0.9; }
          80%  { opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rounded-full { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
