import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Cpu, Plus, Pencil, Trash2, Lock } from "lucide-react";
import { authFetch, useAdminMe } from "@/lib/admin";

interface CatalogModule {
  id: number;
  slug: string;
  group: string;
  displayName: string;
  model: string;
  description: string;
  sensors: string[];
  pinHints: string;
  notes: string;
}

const EMPTY: Partial<CatalogModule> = {
  group: "Modules", displayName: "", model: "", description: "", sensors: [], pinHints: "", notes: "",
};

export default function AdminModules() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { data: me } = useAdminMe();
  const canEdit = !!me?.canManageContent;
  const [editing, setEditing] = useState<Partial<CatalogModule> | null>(null);
  const [sensorsText, setSensorsText] = useState("");

  const { data: modules = [], isLoading } = useQuery<CatalogModule[]>({
    queryKey: ["catalog-modules"],
    queryFn: async () => {
      const r = await fetch("/api/catalog-modules");
      if (!r.ok) throw new Error("failed");
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (m: Partial<CatalogModule>) => {
      const payload = { ...m, sensors: sensorsText.split(",").map((s) => s.trim()).filter(Boolean) };
      const isEdit = !!m.id;
      const r = await authFetch(
        isEdit ? `/api/catalog-modules/${m.id}` : "/api/catalog-modules",
        getToken,
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      if (!r.ok) throw new Error("save failed");
      return r.json();
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["catalog-modules"] });
      qc.invalidateQueries({ queryKey: ["modules-catalog"] });
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(`/api/catalog-modules/${id}`, getToken, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-modules"] });
      qc.invalidateQueries({ queryKey: ["modules-catalog"] });
    },
  });

  const openEdit = (m: Partial<CatalogModule>) => {
    setSensorsText((m.sensors ?? []).join(", "));
    setEditing(m);
  };

  if (me && !canEdit) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-2xl font-bold">Admins only</h1>
        <p className="text-muted-foreground mt-2">You don't have access to module management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-primary">Catalog</div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Manage Modules</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Add, edit, or remove hardware modules. Changes appear in the store instantly.
          </p>
        </div>
        <Button onClick={() => openEdit({ ...EMPTY })} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Module
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {modules.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{m.displayName} <span className="text-xs text-muted-foreground">{m.model}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>
                    <p className="text-[10px] text-primary/60 mt-1">{m.group}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive"
                    onClick={() => { if (confirm(`Delete "${m.displayName}"?`)) delMut.mutate(m.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit module" : "New module"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input placeholder="Display name" value={editing.displayName ?? ""} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} />
              <div className="flex gap-3">
                <Input placeholder="Model (e.g. HC-SR04)" value={editing.model ?? ""} onChange={(e) => setEditing({ ...editing, model: e.target.value })} />
                <Input placeholder="Group (e.g. Eyes & Senses)" value={editing.group ?? ""} onChange={(e) => setEditing({ ...editing, group: e.target.value })} />
              </div>
              <Textarea placeholder="Description" rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <Input placeholder="Sensors (comma-separated, e.g. distance_cm, temp)" value={sensorsText} onChange={(e) => setSensorsText(e.target.value)} />
              <Input placeholder="Pin hints" value={editing.pinHints ?? ""} onChange={(e) => setEditing({ ...editing, pinHints: e.target.value })} />
              <Textarea placeholder="Notes" rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && saveMut.mutate(editing)} disabled={!editing?.displayName || saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
