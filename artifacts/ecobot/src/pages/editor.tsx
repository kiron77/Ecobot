import { useState, useCallback } from "react";
import MonacoEditor from "@monaco-editor/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Play, Save, Code, Plus, FileCode, Loader2, CheckCircle2, Trash2, Bug, X, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, AlertCircle, PanelLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/react";

// ── Local sketch storage (localStorage, never touches the Projects DB) ────────
const SKETCHES_KEY = "ecobot_sketches_v1";

interface LocalSketch {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

function loadSketches(): LocalSketch[] {
  try { return JSON.parse(localStorage.getItem(SKETCHES_KEY) ?? "[]") as LocalSketch[]; }
  catch { return []; }
}
function saveSketches(sketches: LocalSketch[]): void {
  localStorage.setItem(SKETCHES_KEY, JSON.stringify(sketches));
}
function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CODE = `# EcoBot MicroPython Sketch
from ecobot_os import EcoBotOS
import time

bot = EcoBotOS()

# Drive forward for 2 seconds, then stop
bot.m1.spin(50)
bot.m2.spin(50)
time.sleep(2)
bot.m1.spin(0)
bot.m2.spin(0)
`;

async function authFetch(
  url: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

interface DebugIssue {
  line: number | null;
  type: "error" | "warning" | "tip";
  message: string;
  fix: string | null;
}

interface DebugResult {
  issues: DebugIssue[];
  summary: string;
}

function IssueIcon({ type }: { type: DebugIssue["type"] }) {
  if (type === "error") return <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />;
  if (type === "warning") return <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />;
  return <Lightbulb className="w-4 h-4 shrink-0 text-blue-500" />;
}

function IssueBadge({ type }: { type: DebugIssue["type"] }) {
  if (type === "error") return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Error</Badge>;
  if (type === "warning") return <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-600 border-amber-300 hover:bg-amber-500/15">Warning</Badge>;
  return <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-600 border-blue-300 hover:bg-blue-500/15">Tip</Badge>;
}

export default function CodeEditorPage() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [sketches, setSketches] = useState<LocalSketch[]>(() => loadSketches());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [newSketchName, setNewSketchName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [sketchSheetOpen, setSketchSheetOpen] = useState(false);

  const selected = sketches.find((s) => s.id === selectedId) ?? null;

  const loadSketch = (id: string) => {
    const sketch = sketches.find((s) => s.id === id);
    if (!sketch) return;
    setSelectedId(id);
    setCode(sketch.code || DEFAULT_CODE);
    setSavedAt(null);
    setDebugResult(null);
    setDebugOpen(false);
  };

  const handleCreate = useCallback(() => {
    const name = newSketchName.trim() || `Sketch ${sketches.length + 1}`;
    setIsCreating(true);
    const sketch: LocalSketch = {
      id: makeId(),
      name,
      code: DEFAULT_CODE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [sketch, ...sketches];
    saveSketches(updated);
    setSketches(updated);
    setSelectedId(sketch.id);
    setCode(DEFAULT_CODE);
    setNewSketchName("");
    setShowNewForm(false);
    setSavedAt(null);
    setDebugResult(null);
    setDebugOpen(false);
    setIsCreating(false);
    toast({ title: "Sketch created", description: name });
  }, [newSketchName, sketches, toast]);

  const handleSave = useCallback(() => {
    if (!selectedId) return;
    setIsSaving(true);
    const updated = sketches.map((s) =>
      s.id === selectedId ? { ...s, code, updatedAt: new Date().toISOString() } : s
    );
    saveSketches(updated);
    setSketches(updated);
    setSavedAt(new Date());
    setIsSaving(false);
    toast({ title: "Saved" });
  }, [selectedId, code, sketches, toast]);

  const handleDelete = useCallback((id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    const updated = sketches.filter((s) => s.id !== id);
    saveSketches(updated);
    setSketches(updated);
    if (selectedId === id) {
      setSelectedId(null);
      setCode(DEFAULT_CODE);
      setSavedAt(null);
      setDebugResult(null);
      setDebugOpen(false);
    }
    setDeletingId(null);
    toast({ title: "Sketch deleted" });
  }, [sketches, selectedId, toast]);

  const handleRun = () => {
    setIsRunning(true);
    toast({ title: "Sending to Pico W...", description: "Make sure your device is connected." });
    setTimeout(() => {
      setIsRunning(false);
      toast({ title: "Sent!", description: "Code uploaded to device." });
    }, 1500);
  };

  const handleDebug = useCallback(async () => {
    if (!code.trim()) return;
    setIsDebugging(true);
    setDebugResult(null);
    setDebugOpen(true);
    try {
      const res = await authFetch("/api/debug/analyze", getToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        const detail = errBody.detail ?? errBody.error ?? `HTTP ${res.status}`;
        toast({ title: "Debug failed", description: detail, variant: "destructive" });
        setDebugOpen(false);
        return;
      }
      const data = await res.json() as DebugResult;
      setDebugResult(data);
    } catch (err) {
      toast({ title: "Debug failed", description: err instanceof Error ? err.message : "Could not reach the server.", variant: "destructive" });
      setDebugOpen(false);
    } finally {
      setIsDebugging(false);
    }
  }, [code, getToken, toast]);

  const errorCount = debugResult?.issues.filter((i) => i.type === "error").length ?? 0;
  const warnCount = debugResult?.issues.filter((i) => i.type === "warning").length ?? 0;
  const tipCount = debugResult?.issues.filter((i) => i.type === "tip").length ?? 0;

  const SketchList = ({ onSelect }: { onSelect?: () => void }) => (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5" />
          Sketches
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setShowNewForm((v) => !v)}
          title="New sketch"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {showNewForm && (
        <div className="flex flex-col gap-2 p-2 bg-muted/50 rounded-lg border border-dashed animate-in fade-in duration-200">
          <Input
            autoFocus
            value={newSketchName}
            onChange={(e) => setNewSketchName(e.target.value)}
            placeholder="Sketch name..."
            className="h-7 text-xs"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewForm(false); }}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-xs flex-1 gap-1" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Create
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setShowNewForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {sketches.length > 0 ? (
          sketches.map((s) => (
            <div
              key={s.id}
              className={`group w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors hover:bg-muted ${selectedId === s.id ? "bg-muted font-medium" : ""}`}
            >
              <button
                className="flex-1 flex items-center gap-2 text-left min-w-0"
                onClick={() => { loadSketch(s.id); onSelect?.(); }}
              >
                <Code className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.name}</span>
              </button>
              <button
                onClick={(e) => handleDelete(s.id, s.name, e)}
                disabled={deletingId === s.id}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                title="Delete sketch"
              >
                {deletingId === s.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            </div>
          ))
        ) : (
          <div className="pt-4 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">No sketches yet.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="text-xs text-primary hover:underline mt-1"
            >
              Create your first sketch →
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col md:flex-row gap-3 md:gap-4 animate-in fade-in duration-500" style={{ minHeight: 0 }}>
      {/* Mobile sketch Sheet */}
      <Sheet open={sketchSheetOpen} onOpenChange={setSketchSheetOpen}>
        <SheetContent side="left" className="w-72 flex flex-col gap-3 pt-10">
          <SheetHeader>
            <SheetTitle>Sketches</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <SketchList onSelect={() => setSketchSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Sketches sidebar — desktop only */}
      <div className="hidden md:flex md:w-56 md:shrink-0 flex-col gap-3">
        <SketchList />
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile: sketches drawer button */}
            <Button
              variant="outline"
              size="sm"
              className="md:hidden gap-1.5 h-8 shrink-0"
              onClick={() => setSketchSheetOpen(true)}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              {selected ? <span className="truncate max-w-[100px]">{selected.name}</span> : "Sketches"}
            </Button>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold tracking-tight leading-none">
                {selected ? selected.name : "Code Editor"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected
                  ? `Updated ${new Date(selected.updatedAt).toLocaleDateString()}`
                  : "Select a sketch or create a new one"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {savedAt && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Saved {savedAt.toLocaleTimeString()}</span>
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDebug}
              disabled={isDebugging || !code.trim()}
              className="gap-1.5 h-8"
              title="Check code for errors with AI"
            >
              {isDebugging ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bug className="w-3.5 h-3.5" />
              )}
              {isDebugging ? "Checking..." : "Debug"}
              {debugResult && !isDebugging && (
                <span className={`ml-0.5 text-[10px] font-bold ${errorCount > 0 ? "text-destructive" : warnCount > 0 ? "text-amber-500" : "text-green-600"}`}>
                  {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? "s" : ""}` : warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? "s" : ""}` : "✓"}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={!selectedId || isSaving}
              className="gap-1.5 h-8"
              data-testid="button-save-sandbox"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
            <Button
              size="sm"
              onClick={handleRun}
              disabled={isRunning}
              className="gap-1.5 h-8"
              data-testid="button-run-sandbox"
            >
              {isRunning ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden sm:inline">Running...</span></>
              ) : (
                <><Play className="w-3.5 h-3.5" /><span className="hidden sm:inline">Run on Device</span><span className="sm:hidden">Run</span></>
              )}
            </Button>
          </div>
        </div>

        {/* Monaco + new sketch empty state */}
        {!selectedId ? (
          <Card className="flex-1 flex items-center justify-center border-dashed">
            <div className="text-center py-12 px-8">
              <FileCode className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No sketch open</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Select a sketch from the list or create a new one to start coding.
              </p>
              <Button onClick={() => setShowNewForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create new sketch
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* Editor card */}
            <Card className={`flex flex-col overflow-hidden border-2 min-h-0 transition-all duration-300 ${debugOpen && debugResult ? "flex-[0_0_auto] h-[55%]" : "flex-1"}`}>
              <div className="bg-muted px-4 py-2 border-b flex items-center gap-3 shrink-0">
                <Code className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">
                  {selected ? `${selected.name.toLowerCase().replace(/\s+/g, "_")}.py` : "main.py"}
                </span>
                {selected && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    MicroPython
                  </Badge>
                )}
              </div>
              <div className="flex-1 min-h-[200px]">
                <MonacoEditor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value ?? "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "var(--app-font-mono)",
                    lineHeight: 1.6,
                    padding: { top: 16, bottom: 16 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    renderLineHighlight: "all",
                  }}
                />
              </div>
            </Card>

            {/* Debug panel */}
            {debugOpen && (
              <Card className="shrink-0 flex flex-col overflow-hidden border animate-in slide-in-from-bottom-2 duration-300" style={{ maxHeight: "45%", minHeight: "160px" }}>
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/50 shrink-0">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Debug Results</span>
                    {debugResult && (
                      <div className="flex items-center gap-1.5 ml-1">
                        {errorCount > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{errorCount} error{errorCount > 1 ? "s" : ""}</Badge>}
                        {warnCount > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-600 border-amber-300 hover:bg-amber-500/15">{warnCount} warning{warnCount > 1 ? "s" : ""}</Badge>}
                        {tipCount > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/15 text-blue-600 border-blue-300 hover:bg-blue-500/15">{tipCount} tip{tipCount > 1 ? "s" : ""}</Badge>}
                        {errorCount === 0 && warnCount === 0 && <Badge className="text-[10px] px-1.5 py-0 bg-green-500/15 text-green-600 border-green-300 hover:bg-green-500/15">✓ Looks good!</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {debugResult && (
                      <button
                        onClick={() => setDebugOpen((v) => !v)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Collapse"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => { setDebugOpen(false); setDebugResult(null); }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Panel body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {isDebugging ? (
                    <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Analysing your code with AI...</span>
                    </div>
                  ) : debugResult ? (
                    <>
                      {/* Summary */}
                      <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
                        {debugResult.summary}
                      </div>

                      {/* Issues */}
                      {debugResult.issues.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-green-600 px-1">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          No issues found — great work!
                        </div>
                      ) : (
                        debugResult.issues.map((issue, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-3 text-sm space-y-1.5 ${
                              issue.type === "error"
                                ? "border-destructive/30 bg-destructive/5"
                                : issue.type === "warning"
                                ? "border-amber-300/40 bg-amber-50/30 dark:bg-amber-900/10"
                                : "border-blue-300/40 bg-blue-50/30 dark:bg-blue-900/10"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <IssueIcon type={issue.type} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <IssueBadge type={issue.type} />
                                  {issue.line != null && (
                                    <span className="text-[10px] text-muted-foreground font-mono">Line {issue.line}</span>
                                  )}
                                </div>
                                <p className="mt-1 text-foreground leading-snug">{issue.message}</p>
                              </div>
                            </div>
                            {issue.fix && (
                              <div className="ml-6">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Suggested fix</p>
                                <pre className="text-xs bg-background/80 border rounded px-3 py-2 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">{issue.fix}</pre>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </>
                  ) : null}
                </div>
              </Card>
            )}

            {/* Collapsed debug bar */}
            {!debugOpen && debugResult && (
              <button
                onClick={() => setDebugOpen(true)}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-xs text-muted-foreground hover:bg-muted transition-colors animate-in fade-in duration-200"
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Debug results</span>
                {errorCount > 0 && <span className="text-destructive font-semibold">{errorCount} error{errorCount > 1 ? "s" : ""}</span>}
                {warnCount > 0 && <span className="text-amber-500 font-semibold">{warnCount} warning{warnCount > 1 ? "s" : ""}</span>}
                {errorCount === 0 && warnCount === 0 && <span className="text-green-600 font-semibold">✓ No issues</span>}
                <ChevronUp className="w-3.5 h-3.5 ml-auto" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
