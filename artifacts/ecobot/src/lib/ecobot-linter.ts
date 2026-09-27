// EcoBot code linter — two tiers, both producing the shared DebugResult shape.
//
//  Tier 1  quickLint(code)      : instant, no deps. Bracket/quote/colon/indent +
//                                 ecobotOS-shape checks. Drives live red squiggles.
//  Tier 2  pyodideLint(code)    : loads Pyodide on first use, compiles the code for
//                                 real against an ecobotOS stub → accurate Python
//                                 errors with line numbers. Drives the Debug panel.
//
// The ecobotOS API modelled here: EcoBotOS(), motors m1..m4 with .spin(forward|reverse),
// ports p1..p8 with .read(units), plus the auto-available names forward / reverse.

export interface DebugIssue {
  line: number | null;
  type: "error" | "warning" | "tip";
  message: string;
  fix: string | null;
}
export interface DebugResult {
  issues: DebugIssue[];
  summary: string;
}

const MOTORS = new Set(["m1", "m2", "m3", "m4"]);
const PORTS = new Set(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]);

// ───────────────────────── Tier 1: fast local lint ─────────────────────────
export function quickLint(code: string): DebugIssue[] {
  const issues: DebugIssue[] = [];
  const lines = code.split("\n");

  // running bracket/quote balance across the whole file
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw;

    // strip a trailing comment (naive — ignores # inside strings, fine for lint)
    const codePart = line.split("#")[0];

    // --- unbalanced quotes on a single line ---
    const singles = (codePart.match(/'/g) || []).length;
    const doubles = (codePart.match(/"/g) || []).length;
    if (singles % 2 !== 0) {
      issues.push({ line: lineNo, type: "error", message: "Unclosed single quote ( ' ).", fix: "Add the missing ' to close the string." });
    }
    if (doubles % 2 !== 0) {
      issues.push({ line: lineNo, type: "error", message: 'Unclosed double quote ( " ).', fix: 'Add the missing " to close the string.' });
    }

    // --- bracket tracking (ignore quoted content roughly) ---
    const noStr = codePart.replace(/'[^']*'/g, "").replace(/"[^"]*"/g, "");
    for (const ch of noStr) {
      if (ch === "(" || ch === "[" || ch === "{") stack.push({ ch, line: lineNo });
      else if (ch === ")" || ch === "]" || ch === "}") {
        const top = stack.pop();
        if (!top || top.ch !== pairs[ch]) {
          issues.push({ line: lineNo, type: "error", message: `Unexpected '${ch}' — no matching opener.`, fix: "Check your brackets/parentheses." });
        }
      }
    }

    // --- missing colon after block keywords ---
    const trimmed = codePart.trim();
    if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(trimmed)) {
      // else/try/finally may legitimately be just "else:" etc; all should end in :
      if (trimmed.length && !trimmed.endsWith(":") && !trimmed.endsWith("\\")) {
        issues.push({ line: lineNo, type: "error", message: `Missing colon ( : ) at the end of this ${trimmed.split(/\s/)[0]} statement.`, fix: "Add a : to the end of the line." });
      }
    }

    // --- tabs mixed with spaces (classic beginner indent bug) ---
    const indent = line.match(/^[ \t]*/)?.[0] ?? "";
    if (indent.includes("\t") && indent.includes(" ")) {
      issues.push({ line: lineNo, type: "warning", message: "Mixed tabs and spaces in indentation.", fix: "Use only spaces (4 per level) for indentation." });
    }

    // --- ecobotOS shape checks ---
    // out-of-range motor/port, e.g. bot.m5 / bot.p9
    const mMatch = codePart.match(/\.\s*m(\d+)\b/g);
    if (mMatch) {
      for (const m of mMatch) {
        const n = m.match(/m(\d+)/)![1];
        if (!MOTORS.has("m" + n)) {
          issues.push({ line: lineNo, type: "error", message: `Motor "m${n}" doesn't exist — motors are m1 to m4.`, fix: "Use m1, m2, m3, or m4." });
        }
      }
    }
    const pMatch = codePart.match(/\.\s*p(\d+)\b/g);
    if (pMatch) {
      for (const p of pMatch) {
        const n = p.match(/p(\d+)/)![1];
        if (!PORTS.has("p" + n)) {
          issues.push({ line: lineNo, type: "error", message: `Port "p${n}" doesn't exist — ports are p1 to p8.`, fix: "Use p1 through p8." });
        }
      }
    }
    // wrong verb: motors spin, ports read
    if (/\.\s*m\d\s*\.\s*read\s*\(/.test(codePart)) {
      issues.push({ line: lineNo, type: "warning", message: "Motors don't have read() — did you mean spin()?", fix: "Use bot.m1.spin(forward) or spin(reverse)." });
    }
    if (/\.\s*p\d\s*\.\s*spin\s*\(/.test(codePart)) {
      issues.push({ line: lineNo, type: "warning", message: "Ports don't have spin() — did you mean read()?", fix: "Use bot.p1.read(units)." });
    }
  });

  // leftover unclosed openers
  for (const open of stack) {
    issues.push({ line: open.line, type: "error", message: `Unclosed '${open.ch}' — never closed.`, fix: "Add the matching closing bracket." });
  }

  return issues;
}

// ───────────────────────── Tier 2: Pyodide deep check ─────────────────────────
// The ecobotOS stub: makes `from ecobot_os import EcoBotOS` resolve, defines the
// real API surface so typos/out-of-range/wrong-args raise real Python errors,
// and exposes forward/reverse. We compile (not run) the user's code inside a
// namespace that already has forward/reverse available.
const ECOBOT_STUB = `
import sys, types
_m = types.ModuleType("ecobot_os")

class _Motor:
    def __init__(self, name): self._name = name
    def spin(self, direction):  # expects forward or reverse
        pass

class _Port:
    def __init__(self, name): self._name = name
    def read(self, units=None):
        return 0

class EcoBotOS:
    def __init__(self):
        for i in range(1, 5): setattr(self, "m%d" % i, _Motor("m%d" % i))
        for i in range(1, 9): setattr(self, "p%d" % i, _Port("p%d" % i))

forward = "forward"
reverse = "reverse"

_m.EcoBotOS = EcoBotOS
_m.forward = forward
_m.reverse = reverse
sys.modules["ecobot_os"] = _m
`;

// Cache the Pyodide instance across calls.
let pyodidePromise: Promise<any> | null = null;

async function getPyodide(onStatus?: (s: string) => void): Promise<any> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    onStatus?.("Loading Python engine…");
    // load the loader script from the CDN if not present
    if (!(window as any).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Pyodide"));
        document.head.appendChild(s);
      });
    }
    const pyodide = await (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
    });
    await pyodide.runPythonAsync(ECOBOT_STUB);
    onStatus?.("Ready");
    return pyodide;
  })();
  return pyodidePromise;
}

export async function pyodideLint(code: string, onStatus?: (s: string) => void): Promise<DebugResult> {
  // Always run the fast checks too — they catch ecobotOS-shape issues Python won't.
  const quick = quickLint(code);

  let pyodide: any;
  try {
    pyodide = await getPyodide(onStatus);
  } catch {
    return {
      issues: quick.length ? quick : [{ line: null, type: "warning", message: "Couldn't load the Python checker (offline?). Showing quick checks only.", fix: null }],
      summary: quick.length ? `${quick.length} issue(s) from quick check.` : "Quick check found no obvious problems.",
    };
  }

  const pyIssues: DebugIssue[] = [];
  try {
    // compile() catches syntax errors without executing. We escape the user code.
    pyodide.globals.set("__user_code__", code);
    await pyodide.runPythonAsync(`
import json as _json
__err__ = None
try:
    compile(__user_code__, "<sketch>", "exec")
except SyntaxError as e:
    __err__ = _json.dumps({"line": e.lineno, "msg": e.msg, "text": (e.text or "").strip()})
except Exception as e:
    __err__ = _json.dumps({"line": None, "msg": str(e), "text": ""})
`);
    const errRaw = pyodide.globals.get("__err__");
    if (errRaw) {
      const err = JSON.parse(errRaw as string) as { line: number | null; msg: string; text: string };
      pyIssues.push({
        line: err.line,
        type: "error",
        message: `Python syntax error: ${err.msg}${err.text ? ` — near "${err.text}"` : ""}`,
        fix: null,
      });
    }
  } catch (e) {
    pyIssues.push({ line: null, type: "warning", message: "The Python checker hit a problem analysing this code.", fix: null });
  }

  // Merge: Python errors first (most authoritative), then quick issues not already covered by line.
  const seenLines = new Set(pyIssues.map((i) => i.line));
  const merged = [...pyIssues, ...quick.filter((q) => !(q.type === "error" && seenLines.has(q.line)))];

  const errors = merged.filter((i) => i.type === "error").length;
  const warns = merged.filter((i) => i.type === "warning").length;
  const summary = errors > 0
    ? `Found ${errors} error${errors > 1 ? "s" : ""}${warns ? ` and ${warns} warning${warns > 1 ? "s" : ""}` : ""}.`
    : warns > 0
      ? `No errors, but ${warns} warning${warns > 1 ? "s" : ""} to review.`
      : "No problems found — your code looks good!";

  return { issues: merged, summary };
}
