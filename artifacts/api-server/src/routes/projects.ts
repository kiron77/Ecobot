import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import { CreateProjectBody, UpdateProjectBody, GetProjectParams, UpdateProjectParams, DeleteProjectParams } from "@workspace/api-zod";

const router = Router();

function getUser(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]): string | null {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

// GET /api/projects
router.get("/projects", async (req, res) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.updatedAt));
  res.json(projects.map(formatProject));
});

// GET /api/projects/recent
router.get("/projects/recent", async (req, res) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(5);
  res.json(projects.map(formatProject));
});

// POST /api/projects
router.post("/projects", async (req, res) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { name, description, language, workflowStage, tags } = parsed.data;
  const [project] = await db
    .insert(projectsTable)
    .values({
      userId,
      name,
      description,
      language: language ?? "micropython",
      workflowStage: workflowStage ?? "observe",
      tags: tags ?? [],
      code: getStarterCode(language ?? "micropython"),
    })
    .returning();
  res.status(201).json(formatProject(project));
});

// GET /api/projects/:id
router.get("/projects/:id", async (req, res) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const parsed = GetProjectParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, parsed.data.id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(formatProject(project));
});

// PUT /api/projects/:id
router.put("/projects/:id", async (req, res) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const params = UpdateProjectParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateProjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const updates: Partial<typeof projectsTable.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.code !== undefined) updates.code = body.data.code;
  if (body.data.workflowStage !== undefined) updates.workflowStage = body.data.workflowStage;
  if (body.data.tags !== undefined) updates.tags = body.data.tags;

  const [project] = await db
    .update(projectsTable)
    .set(updates)
    .where(and(eq(projectsTable.id, params.data.id), eq(projectsTable.userId, userId)))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(formatProject(project));
});

// DELETE /api/projects/:id
router.delete("/projects/:id", async (req, res) => {
  const userId = getUser(req, res);
  if (!userId) return;
  const parsed = DeleteProjectParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(projectsTable).where(
    and(eq(projectsTable.id, parsed.data.id), eq(projectsTable.userId, userId))
  );
  res.status(204).send();
});

function formatProject(p: typeof projectsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    code: p.code,
    language: p.language,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    workflowStage: p.workflowStage,
    tags: p.tags ?? [],
  };
}

function getStarterCode(language: string): string {
  if (language === "micropython") {
    return `# EcoBot MicroPython Starter
from machine import Pin, ADC
import time

# Initialize the onboard LED
led = Pin(25, Pin.OUT)

# Main loop
while True:
    led.on()
    time.sleep(0.5)
    led.off()
    time.sleep(0.5)
`;
  }
  return "";
}

export default router;
