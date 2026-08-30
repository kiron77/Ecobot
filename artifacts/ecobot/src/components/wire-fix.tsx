import { useState } from "react";
import { Bug, BugOff, Check } from "lucide-react";

/**
 * WireFixWidget — a little interactive-in-place moment.
 * A wire split into two sparking halves with a red glowing bug.
 * Click it: the halves slide together, sparks stop, the bug goes green
 * and a checkmark appears. Click again to reset.
 */
export function WireFixWidget() {
  const [fixed, setFixed] = useState(false);

  return (
    <button
      onClick={() => setFixed((f) => !f)}
      aria-label={fixed ? "Bug fixed — click to break again" : "Broken wire — click to fix"}
      className="group relative flex items-center gap-1 rounded-xl border border-border bg-card/70 p-3 backdrop-blur transition-colors hover:border-primary/40"
      style={{ width: 168 }}
    >
      {/* left wire half */}
      <span
        className="relative h-1.5 rounded-full bg-primary/70 transition-all duration-500"
        style={{ width: fixed ? 46 : 38 }}
      >
        <span className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 8px hsl(148 84% 47% / 0.6)" }} />
      </span>

      {/* gap + sparks / connector */}
      <span className="relative flex h-6 items-center justify-center" style={{ width: fixed ? 4 : 20, transition: "width .5s" }}>
        {!fixed && (
          <>
            {/* animated sparks */}
            <span className="spark spark-a absolute h-1 w-1 rounded-full bg-amber-300" />
            <span className="spark spark-b absolute h-1 w-1 rounded-full bg-amber-200" />
            <span className="spark spark-c absolute h-[3px] w-[3px] rounded-full bg-readout" />
          </>
        )}
        {fixed && <span className="h-1.5 w-full rounded-full bg-primary" style={{ boxShadow: "0 0 10px hsl(148 84% 47%)" }} />}
      </span>

      {/* right wire half */}
      <span
        className="relative h-1.5 rounded-full bg-primary/70 transition-all duration-500"
        style={{ width: fixed ? 46 : 38 }}
      >
        <span className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 8px hsl(148 84% 47% / 0.6)" }} />
      </span>

      {/* bug status */}
      <span className="ml-2 flex items-center gap-1">
        {fixed ? (
          <>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/20 text-primary transition-all duration-500"
              style={{ boxShadow: "0 0 14px hsl(148 84% 47% / 0.55)" }}>
              <BugOff className="h-4 w-4" />
            </span>
            <Check className="h-4 w-4 text-primary" />
          </>
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/20 text-destructive"
            style={{ boxShadow: "0 0 14px hsl(0 72% 55% / 0.5)", animation: "bug-pulse 1.2s ease-in-out infinite" }}>
            <Bug className="h-4 w-4" />
          </span>
        )}
      </span>
    </button>
  );
}
