import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Palette, User, CreditCard, LogOut, Check, Sparkles, Moon, Sun, Plus } from "lucide-react";
import {
  ACCENTS, applyAccent, applyCustomAccent, getSavedAccentId, getSavedCustomHex,
  applyMode, getSavedMode, type Mode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [accentId, setAccentId] = useState<string>(getSavedAccentId());
  const [customHex, setCustomHex] = useState<string>(getSavedCustomHex());
  const [mode, setMode] = useState<Mode>(getSavedMode());

  const displayName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
      : "EcoBot Builder";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  const pickAccent = (id: string) => {
    setAccentId(id);
    applyAccent(id); // live
  };
  const pickCustom = (hex: string) => {
    setCustomHex(hex);
    setAccentId("custom");
    applyCustomAccent(hex); // live
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    applyMode(m); // live
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-primary">Preferences</div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Make EcoBot yours. Changes to your theme apply instantly.
        </p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-medium">Accent color</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sets the glow and highlight color across the whole app.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pickAccent(a.id)}
                  className={cn(
                    "group relative flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors",
                    accentId === a.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-border hover:border-primary/30",
                  )}
                  data-testid={`accent-${a.id}`}
                >
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-white/20"
                    style={{ background: a.swatch, boxShadow: `0 0 10px ${a.swatch}` }}
                  />
                  {a.id}
                  {accentId === a.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}

              {/* Custom color — the "+" swatch opens a native color picker */}
              <label
                className={cn(
                  "group relative flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors",
                  accentId === "custom"
                    ? "border-primary/60 bg-primary/10"
                    : "border-dashed border-border hover:border-primary/30",
                )}
              >
                <span
                  className="grid h-4 w-4 place-items-center rounded-full ring-1 ring-white/20"
                  style={
                    accentId === "custom"
                      ? { background: customHex, boxShadow: `0 0 10px ${customHex}` }
                      : {}
                  }
                >
                  {accentId !== "custom" && <Plus className="h-3 w-3" />}
                </span>
                Custom
                {accentId === "custom" && <Check className="h-3.5 w-3.5 text-primary" />}
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => pickCustom(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  data-testid="accent-custom"
                />
              </label>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Switch between the dark command-center look and a light theme.
              </p>
            </div>
            <div className="inline-flex rounded border border-border p-0.5">
              <button
                onClick={() => pickMode("dark")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                  mode === "dark" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="mode-dark"
              >
                <Moon className="h-3.5 w-3.5" /> Dark
              </button>
              <button
                onClick={() => pickMode("light")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                  mode === "light" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="mode-light"
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={displayName} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
                {displayName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Manage your profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update your name, email, and password.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => user?.update && window.open("https://accounts.clerk.com", "_blank")}
            >
              Manage profile
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sign out of EcoBot on this device.
              </p>
            </div>
            <Button variant="outline" onClick={() => signOut()} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing & Credits — coming soon */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" /> Billing &amp; AI Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mt-3 font-semibold">Credits are coming soon</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Sprocket, your AI tutor, will run on a simple credit system so you only
              pay for what you use. We&rsquo;re still building it — for now, enjoy it on us.
            </p>
            <span className="mt-4 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Coming soon
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
