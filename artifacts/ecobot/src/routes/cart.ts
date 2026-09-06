import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userCartTable, userModulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { MODULE_CATALOG } from "../lib/moduleCatalog";

const router = Router();

// GET /api/cart
router.get("/cart", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select().from(userCartTable).where(eq(userCartTable.userId, userId));
  const result = rows.map((row) => ({
    ...row,
    catalogInfo: MODULE_CATALOG.find((m) => m.id === row.moduleId) ?? null,
  }));
  res.json(result);
});

// POST /api/cart
router.post("/cart", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { moduleId } = req.body as { moduleId?: string };
  if (!moduleId) { res.status(400).json({ error: "moduleId required" }); return; }

  const catalogItem = MODULE_CATALOG.find((m) => m.id === moduleId);
  if (!catalogItem) { res.status(404).json({ error: "Module not found" }); return; }

  await db
    .insert(userCartTable)
    .values({ userId, moduleId })
    .onConflictDoNothing();

  res.json({ userId, moduleId, catalogInfo: catalogItem });
});

// DELETE /api/cart/:moduleId
router.delete("/cart/:moduleId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db
    .delete(userCartTable)
    .where(and(eq(userCartTable.userId, userId), eq(userCartTable.moduleId, req.params.moduleId)));

  res.json({ success: true });
});

// POST /api/cart/checkout — Stripe checkout ($0 per module)
router.post("/cart/checkout", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select().from(userCartTable).where(eq(userCartTable.userId, userId));
  if (rows.length === 0) { res.status(400).json({ error: "Cart is empty" }); return; }

  try {
    const { getUncachableStripeClient } = await import("../lib/stripeClient");
    const stripe = await getUncachableStripeClient();

    const domains = process.env.REPLIT_DOMAINS?.split(",");
    const baseUrl = domains?.[0] ? `https://${domains[0]}` : "http://localhost";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: rows.map((row) => {
        const catalog = MODULE_CATALOG.find((m) => m.id === row.moduleId);
        return {
          price_data: {
            currency: "usd",
            unit_amount: 0,
            product_data: {
              name: catalog?.displayName ?? row.moduleId,
              description: catalog?.description?.slice(0, 200) ?? "EcoBot PCB Module",
            },
          },
          quantity: 1,
        };
      }),
      success_url: `${baseUrl}/cart?success=true`,
      cancel_url: `${baseUrl}/cart`,
    });

    // Add all cart modules to the user's collection on checkout
    for (const row of rows) {
      await db
        .insert(userModulesTable)
        .values({ userId, moduleId: row.moduleId })
        .onConflictDoNothing();
    }

    // Clear cart after checkout
    await db.delete(userCartTable).where(eq(userCartTable.userId, userId));

    res.json({ url: session.url });
  } catch (err) {
    // Stripe not configured — still add to collection (free checkout simulation)
    for (const row of rows) {
      await db
        .insert(userModulesTable)
        .values({ userId, moduleId: row.moduleId })
        .onConflictDoNothing();
    }
    await db.delete(userCartTable).where(eq(userCartTable.userId, userId));
    res.json({ success: true, simulated: true });
  }
});

export default router;
