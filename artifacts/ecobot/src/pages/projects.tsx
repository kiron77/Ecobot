import { useState, useEffect, useRef, useCallback } from "react";
import {
  useListProjects, useCreateProject, useUpdateProject, useDeleteProject, getListProjectsQueryKey,
  useListTutorConversations, useGetTutorConversation,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import {
  Plus, Folder, FolderOpen, ChevronDown, ChevronRight,
  Pencil, Trash2, Loader2, MessageSquare, Image as ImageIcon,
  Code, List, X, Check, Upload, Bot, FileCode, ChevronUp, Sparkles
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

function readSummaryCache(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeSummaryCache(key: string, summary: string) {
  try { localStorage.setItem(key, summary); } catch { /* ignore */ }
}

type Section = "chats" | "images" | "sketches" | "components";

type LinkedChat = { id: string; convId: number };
type LinkedSketch = { id: string; projectId: number };
type FolderImage = { id: string; name: string; dataUrl?: string };
type ComponentEntry = { id: string; modules: string[] };

interface FolderContent {
  linkedChats: LinkedChat[];
  linkedSketches: LinkedSketch[];
  images: FolderImage[];
  componentLists: ComponentEntry[];
}

function loadContent(id: number): FolderContent {
  try {
    const raw = localStorage.getItem(`ecobot-folder-${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        linkedChats: parsed.linkedChats ?? parsed.chats?.map((c: any) => ({ id: c.id, convId: 0 })).filter((c: any) => c.convId) ?? [],
        linkedSketches: parsed.linkedSketches ?? [],
        images: parsed.images ?? [],
        componentLists: parsed.componentLists ?? [],
      };
    }
  } catch {}
  return { linkedChats: [], linkedSketches: [], images: [], componentLists: [] };
}

function saveContent(id: number, content: FolderContent) {
  localStorage.setItem(`ecobot-folder-${id}`, JSON.stringify(content));
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function useFolderContent(id: number | null) {
  const [content, setContent] = useState<FolderContent>({ linkedChats: [], linkedSketches: [], images: [], componentLists: [] });

  useEffect(() => {
    if (id !== null) setContent(loadContent(id));
  }, [id]);

  const update = useCallback((updater: (c: FolderContent) => FolderContent) => {
    setContent((prev) => {
      const next = updater(prev);
      if (id !== null) saveContent(id, next);
      return next;
    });
  }, [id]);

  return { content, update };
}

const SECTION_META: Record<Section, { label: string; icon: React.ReactNode }> = {
  chats: { label: "Chats", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  images: { label: "Images", icon: <ImageIcon className="w-3.5 h-3.5" /> },
  sketches: { label: "Sketches", icon: <Code className="w-3.5 h-3.5" /> },
  components: { label: "Component Lists", icon: <List className="w-3.5 h-3.5" /> },
};

const STAGE_COLORS: Record<string, string> = {
  idea:      "bg-sky-500/10 text-sky-600",
  hardware:  "bg-violet-500/10 text-violet-600",
  software:  "bg-indigo-500/10 text-indigo-600",
  chassis:   "bg-amber-500/10 text-amber-600",
  prototype: "bg-orange-500/10 text-orange-600",
  debug:     "bg-rose-500/10 text-rose-600",
  product:   "bg-emerald-500/10 text-emerald-600",
};

// ── Chat Card ────────────────────────────────────────────────────────────────

function ChatCard({
  link,
  onRemove,
  getToken,
}: {
  link: LinkedChat;
  onRemove: () => void;
  getToken: () => Promise<string | null>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Load conv metadata (title, stage, messageCount)
  const { data: conv } = useGetTutorConversation(link.convId, {
    query: { queryKey: ["tutor-conversation-meta", link.convId] },
  });

  const cacheKey = `ecobot-sum-conv-${link.convId}-v${conv?.messages?.length ?? 0}`;

  useEffect(() => {
    const cached = readSummaryCache(cacheKey);
    if (cached) { setSummary(cached); return; }
    if (!conv) return;

    setSummaryLoading(true);
    authFetch(`/api/summarize/conversation/${link.convId}`, getToken, { method: "POST" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const s = (data as { summary?: string })?.summary ?? null;
        if (s) { setSummary(s); writeSummaryCache(cacheKey, s); }
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.messages?.length, link.convId]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/30">
        <Bot className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{conv?.title ?? `Chat #${link.convId}`}</p>
          {conv && (
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", STAGE_COLORS[conv.workflowStage] ?? "bg-secondary text-secondary-foreground")}>
              {conv.workflowStage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            title={expanded ? "Collapse summary" : "Show AI summary"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <Link href="/tutor" className="p-1 rounded hover:bg-muted text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
          </Link>
          <button onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 py-2.5 border-t bg-primary/[0.02] animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Summary</p>
          </div>
          {summaryLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ) : summary ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No messages yet in this chat.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ChatsSection({ content, update, getToken }: { content: FolderContent; update: ReturnType<typeof useFolderContent>["update"]; getToken: () => Promise<string | null> }) {
  const { data: allConvsRaw, isLoading } = useListTutorConversations();
  const allConvs = Array.isArray(allConvsRaw) ? allConvsRaw : [];
  const [picking, setPicking] = useState(false);

  const linkedIds = new Set(content.linkedChats.map((c) => c.convId));
  const available = (allConvs ?? []).filter((c) => !linkedIds.has(c.id));

  const addChat = (convId: number) => {
    update((c) => ({ ...c, linkedChats: [...c.linkedChats, { id: uid(), convId }] }));
    setPicking(false);
  };

  const removeChat = (id: string) => update((c) => ({ ...c, linkedChats: c.linkedChats.filter((ch) => ch.id !== id) }));

  return (
    <div className="space-y-3">
      {content.linkedChats.length === 0 && !picking && (
        <p className="text-sm text-muted-foreground text-center py-4">No chats linked. Click + to add one.</p>
      )}
      {content.linkedChats.map((link) => (
        <ChatCard key={link.id} link={link} onRemove={() => removeChat(link.id)} getToken={getToken} />
      ))}

      {picking ? (
        <div className="border rounded-lg bg-muted/30 divide-y animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choose a chat</p>
            <button onClick={() => setPicking(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          {isLoading ? (
            <div className="p-3"><Skeleton className="h-8 w-full" /></div>
          ) : available.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              {(allConvs ?? []).length === 0 ? "No AI chats yet — start one in the Tutor page." : "All chats are already linked."}
            </p>
          ) : (
            available.map((conv) => (
              <button
                key={conv.id}
                onClick={() => addChat(conv.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
              >
                <Bot className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title}</p>
                  <p className="text-[10px] text-muted-foreground">{conv.messageCount} messages · {conv.workflowStage}</p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setPicking(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Chat
        </Button>
      )}
    </div>
  );
}

// ── Images Section ────────────────────────────────────────────────────────────

function ImagesSection({ content, update }: { content: FolderContent; update: ReturnType<typeof useFolderContent>["update"] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (file: File) => {
    if (file.size > 1024 * 1024) {
      toast({ title: "Image too large", description: "Please use an image under 1 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      update((c) => ({ ...c, images: [...c.images, { id: uid(), name: file.name, dataUrl }] }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (id: string) => update((c) => ({ ...c, images: c.images.filter((img) => img.id !== id) }));

  return (
    <div className="space-y-3">
      {content.images.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No images yet. Upload one below.</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {content.images.map((img) => (
          <div key={img.id} className="group relative rounded-lg overflow-hidden border bg-muted aspect-square flex items-center justify-center">
            {img.dataUrl ? (
              <img src={img.dataUrl} alt={img.name} className="object-cover w-full h-full" />
            ) : (
              <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onClick={() => removeImage(img.id)} className="p-1.5 rounded-full bg-destructive/90 text-white hover:bg-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">{img.name}</p>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
        <Upload className="w-3.5 h-3.5" />
        Upload Image
      </Button>
    </div>
  );
}

// ── Sketch Card ───────────────────────────────────────────────────────────────

function SketchCard({
  link,
  onRemove,
  getToken,
}: {
  link: LinkedSketch;
  onRemove: () => void;
  getToken: () => Promise<string | null>;
}) {
  const { data: projectsRaw } = useListProjects();
  const projects = Array.isArray(projectsRaw) ? projectsRaw : [];
  const project = projects?.find((p) => p.id === link.projectId);
  const [expanded, setExpanded] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const cacheKey = `ecobot-sum-code-${link.projectId}-v${project?.updatedAt ?? ""}`;

  useEffect(() => {
    if (!project?.code?.trim()) return;
    const cached = readSummaryCache(cacheKey);
    if (cached) { setSummary(cached); return; }

    setSummaryLoading(true);
    authFetch("/api/summarize/code", getToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: project.code, projectName: project.name }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const s = (data as { summary?: string })?.summary ?? null;
        if (s) { setSummary(s); writeSummaryCache(cacheKey, s); }
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.projectId, project?.updatedAt, project?.code]);

  if (!project) return null;

  const preview = (project.code ?? "").split("\n").slice(0, 5).join("\n");

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/30">
        <FileCode className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">{project.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            title={expanded ? "Collapse" : "Show summary"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <Link href="/editor" className="p-1 rounded hover:bg-muted text-muted-foreground">
            <Code className="w-3.5 h-3.5" />
          </Link>
          <button onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {preview && (
        <div className="bg-zinc-950 text-zinc-400 font-mono text-[11px] px-3 py-2 overflow-hidden max-h-20">
          <pre className="whitespace-pre-wrap">{preview}</pre>
        </div>
      )}
      {expanded && (
        <div className="px-3 py-2.5 border-t bg-primary/[0.02] animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Summary</p>
          </div>
          {summaryLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : summary ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
          ) : !project.code?.trim() ? (
            <p className="text-sm text-muted-foreground italic">No code written yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SketchesSection({ content, update, getToken }: { content: FolderContent; update: ReturnType<typeof useFolderContent>["update"]; getToken: () => Promise<string | null> }) {
  const { data: allProjectsRaw, isLoading } = useListProjects();
  const allProjects = Array.isArray(allProjectsRaw) ? allProjectsRaw : [];
  const [picking, setPicking] = useState(false);

  const linkedIds = new Set(content.linkedSketches.map((s) => s.projectId));
  const available = (allProjects ?? []).filter((p) => !linkedIds.has(p.id));

  const addSketch = (projectId: number) => {
    update((c) => ({ ...c, linkedSketches: [...c.linkedSketches, { id: uid(), projectId }] }));
    setPicking(false);
  };

  const removeSketch = (id: string) => update((c) => ({ ...c, linkedSketches: c.linkedSketches.filter((s) => s.id !== id) }));

  return (
    <div className="space-y-3">
      {content.linkedSketches.length === 0 && !picking && (
        <p className="text-sm text-muted-foreground text-center py-4">No sketches linked. Click + to pick one from your Code Editor.</p>
      )}
      {content.linkedSketches.map((link) => (
        <SketchCard key={link.id} link={link} onRemove={() => removeSketch(link.id)} getToken={getToken} />
      ))}

      {picking ? (
        <div className="border rounded-lg bg-muted/30 divide-y animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choose a sketch</p>
            <button onClick={() => setPicking(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          {isLoading ? (
            <div className="p-3"><Skeleton className="h-8 w-full" /></div>
          ) : available.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">
              {(allProjects ?? []).length === 0
                ? "No sketches yet — create one in the Code Editor."
                : "All sketches are already linked."}
            </p>
          ) : (
            available.map((p) => (
              <button
                key={p.id}
                onClick={() => addSketch(p.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
              >
                <FileCode className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setPicking(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Sketch
        </Button>
      )}
    </div>
  );
}

// ── Component Lists Section ───────────────────────────────────────────────────

function ComponentListItem({ list, listIdx, update }: {
  list: ComponentEntry;
  listIdx: number;
  update: ReturnType<typeof useFolderContent>["update"];
}) {
  const [newModule, setNewModule] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addModule = () => {
    const trimmed = newModule.trim();
    if (!trimmed) return;
    update((c) => ({
      ...c,
      componentLists: c.componentLists.map((l) =>
        l.id === list.id ? { ...l, modules: [...l.modules, trimmed] } : l
      ),
    }));
    setNewModule("");
    inputRef.current?.focus();
  };

  const removeModule = (idx: number) => {
    update((c) => ({
      ...c,
      componentLists: c.componentLists.map((l) =>
        l.id === list.id ? { ...l, modules: l.modules.filter((_, i) => i !== idx) } : l
      ),
    }));
  };

  const removeList = () => {
    update((c) => ({ ...c, componentLists: c.componentLists.filter((l) => l.id !== list.id) }));
  };

  return (
    <div className="border rounded-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">List {listIdx + 1}</span>
        <button
          onClick={removeList}
          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
          title="Delete list"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {list.modules.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No components added yet.</p>
      )}

      <ol className="space-y-1.5">
        {list.modules.map((mod, idx) => (
          <li key={idx} className="flex items-center gap-2 group">
            <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-right">{idx + 1}.</span>
            <span className="text-sm flex-1">{mod}</span>
            <button
              onClick={() => removeModule(idx)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive text-muted-foreground"
              title="Remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ol>

      {/* Inline add row */}
      <div className="flex gap-2 pt-1">
        <Input
          ref={inputRef}
          value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
          placeholder="Module name or part…"
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") addModule(); }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={addModule}
          disabled={!newModule.trim()}
          className="h-8 gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

function ComponentsSection({ content, update }: { content: FolderContent; update: ReturnType<typeof useFolderContent>["update"] }) {
  const addList = () => {
    update((c) => ({ ...c, componentLists: [...c.componentLists, { id: uid(), modules: [] }] }));
  };

  return (
    <div className="space-y-3">
      {content.componentLists.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No component lists yet. Create one below.</p>
      )}
      {content.componentLists.map((list, idx) => (
        <ComponentListItem key={list.id} list={list} listIdx={idx} update={update} />
      ))}
      <Button variant="outline" size="sm" onClick={addList} className="gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        New Component List
      </Button>
    </div>
  );
}

// ── Folder Row ────────────────────────────────────────────────────────────────

function FolderRow({ project }: { project: { id: number; name: string; code: string; updatedAt: string } }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { mutateAsync: updateProject } = useUpdateProject();
  const { mutateAsync: deleteProject } = useDeleteProject();

  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>("chats");
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { content, update } = useFolderContent(open ? project.id : null);

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === project.name) { setRenaming(false); return; }
    setSaving(true);
    try {
      await updateProject({ id: project.id, data: { name: trimmed } });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "Folder renamed" });
    } catch {
      toast({ title: "Failed to rename", variant: "destructive" });
      setNameValue(project.name);
    } finally {
      setSaving(false);
      setRenaming(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete folder "${project.name}" and all its contents? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteProject({ id: project.id });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      localStorage.removeItem(`ecobot-folder-${project.id}`);
      toast({ title: "Folder deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <div className={cn("border rounded-xl overflow-hidden transition-all duration-200", open ? "shadow-md" : "hover:shadow-sm")}>
      {/* Folder header */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors",
          open ? "bg-primary/5 border-b" : "hover:bg-muted/40"
        )}
        onClick={() => !renaming && setOpen((v) => !v)}
      >
        {open
          ? <FolderOpen className="w-5 h-5 text-primary shrink-0" />
          : <Folder className="w-5 h-5 text-muted-foreground shrink-0" />
        }

        {renaming ? (
          <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Input
              ref={renameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="h-7 text-sm font-medium"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") { setRenaming(false); setNameValue(project.name); }
              }}
              onBlur={handleSaveName}
            />
            {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
        ) : (
          <span className="flex-1 font-medium truncate">{project.name}</span>
        )}

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground mr-1 hidden sm:block">
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
          <button
            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
            onClick={handleRename}
            title="Rename"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete folder"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />}
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Section tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(SECTION_META) as Section[]).map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  section === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                {SECTION_META[s].icon}
                {SECTION_META[s].label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="min-h-[80px]">
            {section === "chats" && <ChatsSection content={content} update={update} getToken={getToken} />}
            {section === "images" && <ImagesSection content={content} update={update} />}
            {section === "sketches" && <SketchesSection content={content} update={update} getToken={getToken} />}
            {section === "components" && <ComponentsSection content={content} update={update} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Projects() {
  const { data: projectsRaw2, isLoading } = useListProjects();
  const projects = Array.isArray(projectsRaw2) ? projectsRaw2 : [];
  const createProject = useCreateProject();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim() || "New Folder";
    try {
      await createProject.mutateAsync({
        data: { name, description: "", language: "micropython", workflowStage: "idea" }
      });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "Folder created", description: name });
      setCreating(false);
      setNewName("");
    } catch {
      toast({ title: "Failed to create folder", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-primary">Your work</div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">My Folders</h1>
          <p className="text-muted-foreground mt-1">Organise your projects, chats, sketches, and component lists.</p>
        </div>
        {!isLoading && (projects?.length ?? 0) > 0 && (
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Folder
          </Button>
        )}
      </div>

      {/* Inline create form */}
      {creating && (
        <div className="flex gap-2 items-center p-3 border rounded-xl bg-muted/30 animate-in fade-in duration-200">
          <Folder className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
          />
          <Button size="sm" className="gap-1.5 shrink-0" onClick={handleCreate} disabled={createProject.isPending}>
            {createProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Create
          </Button>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { setCreating(false); setNewName(""); }}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-xl p-4">
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="space-y-3">
          {projects.map((p) => (
            <FolderRow key={p.id} project={p} />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Folder className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">No folders yet</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Create your first folder to organise your projects, sketches, and ideas.
            </p>
          </div>
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
              data-testid="button-create-project"
            >
              <Plus className="w-10 h-10" />
            </button>
          ) : (
            <div className="flex gap-2 items-center w-full max-w-sm">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Folder name..."
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
              />
              <Button onClick={handleCreate} disabled={createProject.isPending} className="gap-1.5 shrink-0">
                {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
