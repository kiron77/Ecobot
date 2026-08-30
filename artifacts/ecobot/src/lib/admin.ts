import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

export type Role = "leadership" | "administrator" | "moderator" | "user";

export interface AdminMe {
  email: string | null;
  role: Role;
  canManageContent: boolean;
  canManageRoles: boolean;
  isSeedLeader: boolean;
}

export interface RoleRow {
  email: string;
  role: Role;
  grantedBy: string;
  updatedAt: string;
  seed?: boolean;
}

export interface Lesson {
  id: number;
  title: string;
  summary: string;
  category: string;
  level: string;
  minutes: number;
  content: string;
  published: number;
  createdBy: string;
}

/** Attach the Clerk bearer token to a fetch. */
export async function authFetch(
  url: string,
  getToken: () => Promise<string | null>,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers });
}

/** Current user's role/permissions. Safe default = plain user. */
export function useAdminMe() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<AdminMe>({
    queryKey: ["admin-me"],
    enabled: !!isSignedIn,
    queryFn: async () => {
      const r = await authFetch("/api/admin/me", getToken);
      if (!r.ok) throw new Error("me failed");
      return r.json() as Promise<AdminMe>;
    },
    staleTime: 60_000,
  });
}
