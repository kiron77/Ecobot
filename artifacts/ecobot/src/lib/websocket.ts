import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import { sensorReadingsTable } from "@workspace/db";
import { logger } from "./logger";

interface SensorPayload {
  type: "sensor_reading";
  moduleType: string;
  sensorName: string;
  value: number;
  unit: string;
  deviceId?: string;
}

interface PingPayload {
  type: "ping";
}

type WsPayload = SensorPayload | PingPayload;

const clients = new Set<WebSocket>();

export function createWebSocketServer(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    clients.add(ws);
    logger.info({ remoteAddress: req.socket.remoteAddress }, "WebSocket client connected");

    ws.send(JSON.stringify({ type: "connected", message: "EcoBot WebSocket ready" }));

    ws.on("message", async (raw) => {
      let payload: WsPayload;
      try {
        payload = JSON.parse(raw.toString()) as WsPayload;
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      if (payload.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (payload.type === "sensor_reading") {
        const { moduleType, sensorName, value, unit, deviceId } = payload;
        if (!moduleType || !sensorName || value === undefined || !unit) {
          ws.send(JSON.stringify({ type: "error", message: "Missing required sensor fields" }));
          return;
        }

        try {
          const [saved] = await db
            .insert(sensorReadingsTable)
            .values({
              moduleType,
              sensorName,
              value,
              unit,
              deviceId: deviceId ?? "pico-w-bt",
              timestamp: new Date(),
            })
            .returning();

          const broadcast = JSON.stringify({
            type: "sensor_update",
            reading: {
              id: saved.id,
              moduleType: saved.moduleType,
              sensorName: saved.sensorName,
              value: saved.value,
              unit: saved.unit,
              deviceId: saved.deviceId,
              timestamp: saved.timestamp.toISOString(),
            },
          });

          // Broadcast to all connected clients (including sender for UI confirmation)
          for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcast);
            }
          }
        } catch (err) {
          logger.error({ err }, "Error saving sensor reading from WebSocket");
          ws.send(JSON.stringify({ type: "error", message: "Database error" }));
        }
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
      clients.delete(ws);
    });
  });
}
