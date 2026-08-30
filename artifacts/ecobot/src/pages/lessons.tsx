import { useState, useMemo } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, BookOpen, Clock, Plus, Pencil, Trash2, GraduationCap } from "lucide-react";
import { authFetch, useAdminMe, type Lesson } from "@/lib/admin";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Getting Started", "Sensors", "Code", "Hardware", "Projects"] as const;
const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

const LEVEL_STYLES: Record<string, string> = {
  Beginner: "bg-primary/15 text-primary",
  Intermediate: "bg-amber-500/15 text-amber-600",
  Advanced: "bg-destructive/15 text-destructive",
};

const EMPTY: Partial<Lesson> = {
  title: "", summary: "", category: "Getting Started", level: "Beginner", minutes: 10, content: "", published: 1,
};

export default function Lessons() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { data: me } = useAdminMe();
  const canEdit = !!me?.canManageContent;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [editing, setEditing] = useState<Partial<Lesson> | null>(null);

  const { data: lessons = [], isLoading } = useQuery<Lesson[]>({
    queryKey: ["lessons"],
    queryFn: async () => {
      const r = await authFetch("/api/lessons", getToken);
      if (!r.ok) throw new Error("lessons failed");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (l: Partial<Lesson>) => {
      const isEdit = !!l.id;
      const r = await authFetch(
        isEdit ? `/api/lessons/${l.id}` : "/api/lessons",
        getToken,
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(l) },
      );
      if (!r.ok) throw new Error("save failed");
      return r.json();
    },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["lessons"] }); },
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/lessons/${id}`, getToken, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons"] }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter((l) => {
      const matchesCat = category === "All" || l.category === category;
      const matchesQuery =
        q === "" ||
        l.title.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [lessons, query, category]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-primary">Learn</div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Lessons</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Step-by-step guides from a bare board to a robot that moves.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY })} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Add Lesson
          </Button>
        )}
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lessons…" className="pl-9" />
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded border px-3 py-1.5 text-sm font-medium transition-colors",
              category === cat
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading lessons…</p>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lesson) => (
            <div
              key={lesson.id}
              className="group relative flex flex-col items-start gap-3 rounded-sm border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:-translate-y-1"
            >
              <div className="flex w-full items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded bg-primary/10 text-primary">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <Badge variant="secondary" className={cn("text-xs", LEVEL_STYLES[lesson.level])}>
                  {lesson.level}
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold leading-snug">
                  {lesson.title}
                  {lesson.published === 0 && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">draft</span>
                  )}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{lesson.summary}</p>
              </div>
              <div className="mt-auto flex w-full items-center justify-between pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {lesson.minutes} min · {lesson.category}
                </span>
              </div>
              {canEdit && (
                <div className="flex w-full gap-2 border-t border-border pt-3">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setEditing(lesson)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 text-destructive"
                    onClick={() => { if (confirm(`Delete "${lesson.title}"?`)) delMut.mutate(lesson.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border py-16 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No lessons yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit ? "Click Add Lesson to create the first one." : "Check back soon."}
          </p>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit lesson" : "New lesson"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input placeholder="Title" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <Input placeholder="One-line summary" value={editing.summary ?? ""} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
              <div className="flex gap-3">
                <select className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                  value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
                </select>
                <select className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                  value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
                <Input type="number" className="w-24" placeholder="min" value={editing.minutes ?? 10}
                  onChange={(e) => setEditing({ ...editing, minutes: +e.target.value })} />
              </div>
              <Textarea placeholder="Lesson content…" rows={8} value={editing.content ?? ""}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={editing.published !== 0}
                  onChange={(e) => setEditing({ ...editing, published: e.target.checked ? 1 : 0 })} />
                Published (uncheck to save as draft)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && saveMut.mutate(editing)} disabled={!editing?.title || saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
