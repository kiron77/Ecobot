import express, { type Express } from "express";
import path from "node:path";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/webhookHandlers";
import { devAuthMiddleware } from "./middlewares/devAuthMiddleware";

const app: Express = express();

// Stripe webhook MUST be registered before express.json() (needs raw Buffer)
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) { res.status(400).json({ error: "Missing stripe-signature" }); return; }
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, Array.isArray(sig) ? sig[0]! : sig);
      res.json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook error" });
    }
  }
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Clerk proxy must come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// DEV-ONLY: fake a signed-in user for local testing (no-op unless
// NODE_ENV=development AND DEV_AUTH_BYPASS=1). See devAuthMiddleware.ts.
app.use(devAuthMiddleware());

app.use("/api", router);

// --- Serve the built frontend (single-service deploy) ---
// In production the React app is built to artifacts/ecobot/dist/public. We serve
// those static files, and fall back to index.html for client-side routing so
// deep links (e.g. /lessons) work on refresh. API routes above take priority.
if (process.env.NODE_ENV === "production") {
  const clientDir = path.resolve(
    import.meta.dirname,
    "../../ecobot/dist/public",
  );
  app.use(express.static(clientDir));
  app.get("/*splat", (req, res, next) => {
    // don't hijack API or websocket paths
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

export default app;
