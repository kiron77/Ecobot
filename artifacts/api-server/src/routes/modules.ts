import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userModulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { MODULE_CATALOG } from "../lib/moduleCatalog";

const router = Router();

// GET /api/modules/catalog — full catalog of available EcoBot modules
router.get("/modules/catalog", (_req, res) => {
  res.json(MODULE_CATALOG);
});

// GET /api/modules — legacy compat
router.get("/modules", (_req, res) => {
  res.json(
    MODULE_CATALOG.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      description: m.description,
      sensors: m.sensors,
      icon: "cpu",
    })),
  );
});

// GET /api/modules/user — get the current user's owned modules
router.get("/modules/user", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(userModulesTable)
    .where(eq(userModulesTable.userId, userId));

  const result = rows.map((row) => {
    const catalog = MODULE_CATALOG.find((m) => m.id === row.moduleId);
    return { ...row, catalogInfo: catalog ?? null };
  });

  res.json(result);
});

// POST /api/modules/user — add a module to the user's collection
router.post("/modules/user", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { moduleId, quantity = 1, notes = "" } = req.body as {
    moduleId: string;
    quantity?: number;
    notes?: string;
  };

  if (!moduleId) { res.status(400).json({ error: "moduleId is required" }); return; }

  const catalogItem = MODULE_CATALOG.find((m) => m.id === moduleId);
  if (!catalogItem) { res.status(404).json({ error: "Module not found in catalog" }); return; }

  const [row] = await db
    .insert(userModulesTable)
    .values({ userId, moduleId, quantity, notes })
    .onConflictDoUpdate({
      target: [userModulesTable.userId, userModulesTable.moduleId],
      set: { quantity, notes },
    })
    .returning();

  res.json({ ...row, catalogInfo: catalogItem });
});

// DELETE /api/modules/user/:moduleId — remove a module from the user's collection
router.delete("/modules/user/:moduleId", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { moduleId } = req.params;

  await db
    .delete(userModulesTable)
    .where(
      and(
        eq(userModulesTable.userId, userId),
        eq(userModulesTable.moduleId, moduleId),
      ),
    );

  res.json({ success: true });
});

export default router;
