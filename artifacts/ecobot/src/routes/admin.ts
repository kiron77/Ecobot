import { Router } from "express";
import { db, userRolesTable, lessonsTable, catalogModulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { MODULE_CATALOG } from "../lib/moduleCatalog";
import {
  getRequestRole,
  getUserEmail,
  getRoleForEmail,
  canManageContent,
  canManageRoles,
  SEED_LEADERS,
  type Role,
} from "../lib/permissions";

const router = Router();
const VALID_ROLES: Role[] = ["leadership", "administrator", "moderator", "user"];

// GET /api/admin/me — the current user's role + email (drives the UI)
router.get("/admin/me", async (req, res) => {
  const { email, role } = await getRequestRole(req);
  res.json({
    email,
    role,
    canManageContent: canManageContent(role),
    canManageRoles: canManageRoles(role),
    isSeedLeader: email ? SEED_LEADERS.includes(email) : false,
  });
});

// ---- ROLE MANAGEMENT (leadership only) ----

// GET /api/admin/roles — list all role assignments
router.get("/admin/roles", async (req, res) => {
  const { role } = await getRequestRole(req);
  if (!canManageRoles(role)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const rows = await db.select().from(userRolesTable);
    // fold in the seed leaders so they always appear
    const seeded = SEED_LEADERS.filter((e) => !rows.some((r) => r.email === e)).map((email) => ({
      email, role: "leadership" as const, grantedBy: "seed", updatedAt: new Date(), seed: true,
    }));
    res.json([...seeded, ...rows.map((r) => ({ ...r, seed: SEED_LEADERS.includes(r.email) }))]);
  } catch {
    // Table may not exist yet — still show the seed leaders.
    res.json(SEED_LEADERS.map((email) => ({
      email, role: "leadership" as const, grantedBy: "seed", updatedAt: new Date(), seed: true,
    })));
  }
});

// POST /api/admin/roles — set a role for an email  { email, role }
router.post("/admin/roles", async (req, res) => {
  const email = await getUserEmail(req);
  const role = await getRoleForEmail(email);
  if (!canManageRoles(role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const target = String(req.body?.email ?? "").trim().toLowerCase();
  const newRole = String(req.body?.role ?? "").trim() as Role;
  if (!target || !target.includes("@")) { res.status(400).json({ error: "Valid email required" }); return; }
  if (!VALID_ROLES.includes(newRole)) { res.status(400).json({ error: "Invalid role" }); return; }

  // Guard: leadership cannot demote/change THEMSELVES (prevents self-lockout;
  // guarantees at least one leader remains).
  if (target === email && newRole !== "leadership") {
    res.status(400).json({ error: "You can't change your own leadership role." });
    return;
  }

  // "user" means remove the assignment. Seed leaders can't be reduced below
  // leadership (they're enforced in code anyway), so block confusing writes.
  if (SEED_LEADERS.includes(target) && newRole !== "leadership") {
    res.status(400).json({ error: "This account is a permanent leader and can't be demoted." });
    return;
  }

  try {
    if (newRole === "user") {
      await db.delete(userRolesTable).where(eq(userRolesTable.email, target));
      res.json({ email: target, role: "user" });
      return;
    }
    await db
      .insert(userRolesTable)
      .values({ email: target, role: newRole, grantedBy: email ?? "" })
      .onConflictDoUpdate({
        target: userRolesTable.email,
        set: { role: newRole, grantedBy: email ?? "", updatedAt: new Date() },
      });
    res.json({ email: target, role: newRole });
  } catch {
    res.status(500).json({ error: "Could not save role. Has the database been set up (db push)?" });
  }
});

// ---- LESSONS (read: everyone; write: content managers) ----

// GET /api/lessons — published lessons for everyone; admins get drafts too
router.get("/lessons", async (req, res) => {
  try {
    const { role } = await getRequestRole(req);
    const rows = await db.select().from(lessonsTable);
    const visible = canManageContent(role) ? rows : rows.filter((l) => l.published === 1);
    res.json(visible);
  } catch {
    // Table may not exist yet (before db push) — return empty rather than 500.
    res.json([]);
  }
});

// POST /api/lessons — create  (content managers only)
router.post("/lessons", async (req, res) => {
  const { email, role } = await getRequestRole(req);
  if (!canManageContent(role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const b = req.body ?? {};
  try {
    const [row] = await db
      .insert(lessonsTable)
      .values({
        title: String(b.title ?? "Untitled"),
        summary: String(b.summary ?? ""),
        category: String(b.category ?? "Getting Started"),
        level: String(b.level ?? "Beginner"),
        minutes: Number.isFinite(+b.minutes) ? +b.minutes : 10,
        content: String(b.content ?? ""),
        published: b.published === 0 || b.published === false ? 0 : 1,
        createdBy: email ?? "",
      })
      .returning();
    res.json(row);
  } catch {
    res.status(500).json({ error: "Could not save lesson. Has the database been set up (db push)?" });
  }
});

// PUT /api/lessons/:id — update  (content managers only)
router.put("/lessons/:id", async (req, res) => {
  const { role } = await getRequestRole(req);
  if (!canManageContent(role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Bad id" }); return; }
  const b = req.body ?? {};
  try {
    const [row] = await db
      .update(lessonsTable)
      .set({
        title: String(b.title ?? "Untitled"),
        summary: String(b.summary ?? ""),
        category: String(b.category ?? "Getting Started"),
        level: String(b.level ?? "Beginner"),
        minutes: Number.isFinite(+b.minutes) ? +b.minutes : 10,
        content: String(b.content ?? ""),
        published: b.published === 0 || b.published === false ? 0 : 1,
        updatedAt: new Date(),
      })
      .where(eq(lessonsTable.id, id))
      .returning();
    res.json(row);
  } catch {
    res.status(500).json({ error: "Could not update lesson." });
  }
});

// DELETE /api/lessons/:id — delete  (content managers only)
router.delete("/lessons/:id", async (req, res) => {
  const { role } = await getRequestRole(req);
  if (!canManageContent(role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Bad id" }); return; }
  try {
    await db.delete(lessonsTable).where(eq(lessonsTable.id, id));
    res.json({ ok: true, id });
  } catch {
    res.status(500).json({ error: "Could not delete lesson." });
  }
});

// ---- CATALOG MODULES (read: everyone; write: content managers) ----

// One-time seed: if the DB catalog is empty, copy the historical static catalog
// so nothing is lost when switching to DB-backed modules.
let seeded = false;
async function seedCatalogIfEmpty() {
  if (seeded) return;
  try {
    const existing = await db.select().from(catalogModulesTable).limit(1);
    if (existing.length === 0) {
      await db.insert(catalogModulesTable).values(
        MODULE_CATALOG.map((m) => ({
          slug: m.id,
          group: m.group,
          displayName: m.displayName,
          model: m.model,
          description: m.description,
          sensors: (m.sensors ?? []).join(","),
          pinHints: m.pinHints,
          notes: m.notes,
          createdBy: "seed",
        })),
      );
    }
    seeded = true;
  } catch {
    /* ignore — leave seeded false to retry next call */
  }
}

// GET /api/catalog-modules — everyone
router.get("/catalog-modules", async (_req, res) => {
  try {
    await seedCatalogIfEmpty();
    const rows = await db.select().from(catalogModulesTable);
    if (rows.length === 0) throw new Error("empty");
    res.json(
      rows.map((m) => ({ ...m, sensors: m.sensors ? m.sensors.split(",").filter(Boolean) : [] })),
    );
  } catch {
    // Table missing/empty (e.g. before db push) — fall back to the static catalog
    // so the store always shows the hardware, mapped to the same shape.
    res.json(
      MODULE_CATALOG.map((m, i) => ({
        id: i + 1,
        slug: m.id,
        group: m.group,
        displayName: m.displayName,
        model: m.model,
        description: m.description,
        sensors: m.sensors ?? [],
        pinHints: m.pinHints,
        notes: m.notes,
      })),
    );
  }
});

// POST /api/catalog-modules — create (content managers)
router.post("/catalog-modules", async (req, res) => {
  const { email, role } = await getRequestRole(req);
  if (!canManageContent(role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const b = req.body ?? {};
  try {
    const [row] = await db
      .insert(catalogModulesTable)
      .values({
        slug: String(b.slug ?? "").trim() || String(b.displayName ?? "module").toLowerCase().replace(/\s+/g, "-"),
        group: String(b.group ?? "Modules"),
        displayName: String(b.displayName ?? "New Module"),
        model: String(b.model ?? ""),
        description: String(b.description ?? ""),
        sensors: Array.isArray(b.sensors) ? b.sensors.join(",") : String(b.sensors ?? ""),
        pinHints: String(b.pinHints ?? ""),
        notes: String(b.notes ?? ""),
        createdBy: email ?? "",
      })
      .returning();
    res.json(row);
  } catch {
    res.status(500).json({ error: "Could not save module. Has the database been set up (db push)?" });
  }
});

// PUT /api/catalog-modules/:id — update (content managers)
router.put("/catalog-modules/:id", async (req, res) => {
  const { role } = await getRequestRole(req);
  if (!canManageContent(role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Bad id" }); return; }
  const b = req.body ?? {};
  try {
    const [row] = await db
      .update(catalogModulesTable)
      .set({
        slug: String(b.slug ?? ""),
        group: String(b.group ?? "Modules"),
        displayName: String(b.displayName ?? "Module"),
        model: String(b.model ?? ""),
        description: String(b.description ?? ""),
        sensors: Array.isArray(b.sensors) ? b.sensors.join(",") : String(b.sensors ?? ""),
        pinHints: String(b.pinHints ?? ""),
        notes: String(b.notes ?? ""),
        updatedAt: new Date(),
      })
      .where(eq(catalogModulesTable.id, id))
      .returning();
    res.json(row);
  } catch {
    res.status(500).json({ error: "Could not update module." });
  }
});

// DELETE /api/catalog-modules/:id — delete (content managers)
router.delete("/catalog-modules/:id", async (req, res) => {
  const { role } = await getRequestRole(req);
  if (!canManageContent(role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Bad id" }); return; }
  try {
    await db.delete(catalogModulesTable).where(eq(catalogModulesTable.id, id));
    res.json({ ok: true, id });
  } catch {
    res.status(500).json({ error: "Could not delete module." });
  }
});

export default router;
