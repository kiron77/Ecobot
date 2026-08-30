// Theming for EcoBot: dark/light mode + accent color (preset spectrum or custom).
// Applies via CSS variables on <html> and remembers choices in localStorage.
// No backend needed.

export interface Accent {
  id: string;      // also the label shown to the user
  hsl: string;     // "H S% L%" — matches how index.css writes --primary
  swatch: string;  // css color for the picker dot
}

export const ACCENTS: Accent[] = [
  { id: "Green",  hsl: "148 82% 46%", swatch: "hsl(148 82% 46%)" },
  { id: "Teal",   hsl: "172 80% 42%", swatch: "hsl(172 80% 42%)" },
  { id: "Cyan",   hsl: "190 86% 48%", swatch: "hsl(190 86% 48%)" },
  { id: "Sky",    hsl: "204 88% 54%", swatch: "hsl(204 88% 54%)" },
  { id: "Blue",   hsl: "222 84% 58%", swatch: "hsl(222 84% 58%)" },
  { id: "Indigo", hsl: "245 80% 64%", swatch: "hsl(245 80% 64%)" },
  { id: "Violet", hsl: "265 84% 64%", swatch: "hsl(265 84% 64%)" },
  { id: "Purple", hsl: "285 78% 62%", swatch: "hsl(285 78% 62%)" },
  { id: "Pink",   hsl: "325 82% 60%", swatch: "hsl(325 82% 60%)" },
  { id: "Rose",   hsl: "342 84% 58%", swatch: "hsl(342 84% 58%)" },
  { id: "Red",    hsl: "0 84% 60%",   swatch: "hsl(0 84% 60%)" },
  { id: "Orange", hsl: "24 92% 54%",  swatch: "hsl(24 92% 54%)" },
  { id: "Amber",  hsl: "38 96% 56%",  swatch: "hsl(38 96% 56%)" },
  { id: "Lime",   hsl: "84 74% 46%",  swatch: "hsl(84 74% 46%)" },
];

const ACCENT_KEY = "ecobot-accent";
const CUSTOM_KEY = "ecobot-accent-custom";
const MODE_KEY = "ecobot-mode";

export type Mode = "dark" | "light";

export function hexToHslTriplet(hex: string): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

export function getSavedAccentId(): string {
  try { return localStorage.getItem(ACCENT_KEY) ?? "Green"; } catch { return "Green"; }
}
export function getSavedCustomHex(): string {
  try { return localStorage.getItem(CUSTOM_KEY) ?? "#14e07a"; } catch { return "#14e07a"; }
}

function setPrimary(hsl: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--ring", hsl);
}

export function applyAccent(id: string): void {
  const accent = ACCENTS.find((a) => a.id === id);
  if (accent) {
    setPrimary(accent.hsl);
    try { localStorage.setItem(ACCENT_KEY, id); } catch { /* ignore */ }
  }
}

export function applyCustomAccent(hex: string): void {
  setPrimary(hexToHslTriplet(hex));
  try {
    localStorage.setItem(ACCENT_KEY, "custom");
    localStorage.setItem(CUSTOM_KEY, hex);
  } catch { /* ignore */ }
}

export function getSavedMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "light" || m === "dark") return m;
  } catch { /* ignore */ }
  return "dark";
}

export function applyMode(mode: Mode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}

export function initTheme(): void {
  applyMode(getSavedMode());
  const id = getSavedAccentId();
  if (id === "custom") applyCustomAccent(getSavedCustomHex());
  else applyAccent(id);
}
