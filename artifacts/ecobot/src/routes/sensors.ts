import { Router } from "express";
import { db } from "@workspace/db";
import { sensorReadingsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { GetSensorHistoryQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /api/sensors - latest reading per sensor
router.get("/sensors", async (req, res) => {
  const readings = await db
    .select()
    .from(sensorReadingsTable)
    .orderBy(desc(sensorReadingsTable.timestamp))
    .limit(20);
  res.json(readings);
});

// GET /api/sensors/summary
router.get("/sensors/summary", async (req, res) => {
  const readings = await db
    .select()
    .from(sensorReadingsTable)
    .orderBy(desc(sensorReadingsTable.timestamp))
    .limit(200);

  const byModule: Record<string, { values: number[]; unit: string }> = {};
  for (const r of readings) {
    if (!byModule[r.moduleType]) {
      byModule[r.moduleType] = { values: [], unit: r.unit };
    }
    byModule[r.moduleType].values.push(r.value);
  }

  const byModuleArr = Object.entries(byModule).map(([moduleType, { values, unit }]) => ({
    moduleType,
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    unit,
    readingCount: values.length,
  }));

  const activeModules = new Set(readings.map((r) => r.moduleType)).size;

  res.json({
    totalReadings: readings.length,
    activeModules,
    byModule: byModuleArr,
  });
});

// GET /api/sensors/history
router.get("/sensors/history", async (req, res) => {
  const parsed = GetSensorHistoryQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const moduleType = req.query.moduleType as string | undefined;

  const query = db
    .select()
    .from(sensorReadingsTable)
    .orderBy(desc(sensorReadingsTable.timestamp))
    .limit(limit);

  let readings;
  if (moduleType) {
    readings = await db
      .select()
      .from(sensorReadingsTable)
      .where(eq(sensorReadingsTable.moduleType, moduleType))
      .orderBy(desc(sensorReadingsTable.timestamp))
      .limit(limit);
  } else {
    readings = await query;
  }

  res.json(readings.reverse());
});

// GET /api/sensors/modules
router.get("/sensors/modules", async (req, res) => {
  const readings = await db
    .select()
    .from(sensorReadingsTable)
    .orderBy(desc(sensorReadingsTable.timestamp))
    .limit(100);

  const moduleMap: Record<string, { lastSeen: Date; pinConfig: string }> = {};
  const moduleNames: Record<string, string> = {
    ultrasonic: "Ultrasonic Distance Sensor",
    joystick: "Joystick Controller",
    led_matrix: "LED Matrix Display",
    temperature: "Temperature & Humidity Sensor",
    light: "Ambient Light Sensor",
    motor: "Motor Controller",
    ir: "Infrared Sensor",
  };

  for (const r of readings) {
    if (!moduleMap[r.moduleType]) {
      moduleMap[r.moduleType] = {
        lastSeen: r.timestamp,
        pinConfig: "GP0, GP1",
      };
    }
  }

  const modules = Object.entries(moduleMap).map(([moduleType, { lastSeen, pinConfig }], idx) => ({
    id: idx + 1,
    moduleType,
    displayName: moduleNames[moduleType] ?? moduleType,
    isConnected: true,
    lastSeen: lastSeen.toISOString(),
    pinConfig,
  }));

  res.json(modules);
});

export default router;
