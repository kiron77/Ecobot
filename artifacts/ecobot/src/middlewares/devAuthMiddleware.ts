import type { Request, Response, NextFunction } from "express";

/**
 * DEV-ONLY auth bypass for local testing without a Clerk account.
 *
 * When NODE_ENV=development AND DEV_AUTH_BYPASS=1, this injects a fake signed-in
 * user so every route's `getAuth(req)` returns a stable dev user id. This lets you
 * run and click through the whole app locally with no login and no Clerk keys.
 *
 * It is HARD-GATED: if NODE_ENV is anything other than "development", or the flag
 * isn't set, it does nothing at all. It can never affect a deployed/production app.
 */
export const DEV_USER_ID = "user_local_dev_0001";

export function devAuthMiddleware() {
  const enabled =
    process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!enabled) return next();
    // Shape mimics what @clerk/express attaches; getAuth(req) reads req.auth.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).auth = {
      userId: DEV_USER_ID,
      sessionId: "sess_local_dev",
      getToken: async () => "dev-token",
      has: () => false,
      debug: () => ({}),
    };
    next();
  };
}
