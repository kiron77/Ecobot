import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Crown, Wrench, MessageSquare, UserX, Lock } from "lucide-react";
import { authFetch, useAdminMe, type Role, type RoleRow } from "@/lib/admin";
import { cn } from "@/lib/utils";

const ROLE_META: Record<Exclude<Role, "user">, { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  leadership: { label: "Leadership", icon: Crown, hint: "Full control + manage roles" },
  administrator: { label: "Administrator", icon: Wrench, hint: "Add/edit lessons & modules" },
  moderator: { label: "Moderator", icon: MessageSquare, hint: "Community tools (coming soon)" },
};

export default function AdminRoles() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { data: me } = useAdminMe();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("administrator");
  const [error, setError] = useState("");

  const { data: roles = [] } = useQuery<RoleRow[]>({
    queryKey: ["admin-roles"],
    enabled: !!me?.canManageRoles,
    queryFn: async () => {
      const r = await authFetch("/api/admin/roles", getToken);
      if (!r.ok) throw new Error("roles failed");
      const data = await r.json();
      return Array.isArray(data) ? (data as RoleRow[]) : [];
    },
  });

  const setRoleMut = useMutation({
    mutationFn: async (payload: { email: string; role: Role }) => {
      const r = await authFetch("/api/admin/roles", getToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Failed to set role");
      }
      return r.json();
    },
    onSuccess: () => {
      setEmail(""); setError("");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (me && !me.canManageRoles) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-2xl font-bold">Leadership only</h1>
        <p className="text-muted-foreground mt-2">You don't have access to role management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-primary">Leadership</div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Manage Roles</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          Grant or revoke access. Leadership can manage everyone's role except their own.
        </p>
      </div>

      {/* Assign form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Assign a role
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="person@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sm:flex-1"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="leadership">Leadership</option>
              <option value="administrator">Administrator</option>
              <option value="moderator">Moderator</option>
              <option value="user">Remove (User)</option>
            </select>
            <Button
              onClick={() => setRoleMut.mutate({ email, role })}
              disabled={!email.includes("@") || setRoleMut.isPending}
            >
              Apply
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Current roles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.length === 0 && (
            <p className="text-sm text-muted-foreground">No roles assigned yet.</p>
          )}
          {roles.map((r) => {
            const meta = ROLE_META[r.role as Exclude<Role, "user">];
            const Icon = meta?.icon ?? Wrench;
            const isSelf = me?.email === r.email;
            return (
              <div key={r.email} className="flex items-center justify-between gap-3 rounded-sm border border-border px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta?.label ?? r.role}
                      {r.seed && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">permanent</span>}
                      {isSelf && <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("gap-1.5", (r.seed || isSelf) && "opacity-40")}
                  disabled={r.seed || isSelf || setRoleMut.isPending}
                  onClick={() => setRoleMut.mutate({ email: r.email, role: "user" })}
                  title={r.seed ? "Permanent leader" : isSelf ? "You can't change your own role" : "Revoke"}
                >
                  <UserX className="h-3.5 w-3.5" /> Revoke
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
