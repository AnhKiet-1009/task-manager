import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const eventRoutes = new Hono<AppEnv>().get(
  "/api/v1/workspaces/:workspaceId/events",
  requireAuth,
  requireWorkspaceRole("viewer"),
  (c) => {
    const workspaceId = c.req.param("workspaceId");
    const bus = c.var.eventBus;

    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache, no-transform");

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          workspaceId,
          timestamp: Date.now(),
        }),
      });

      const unsubscribe = bus.subscribe(workspaceId, (event) => {
        void stream.writeSSE({
          id: event.id,
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      }, 25_000);

      const onRawAbort = () => {
        if (!stream.closed) stream.abort();
      };
      c.req.raw.signal?.addEventListener("abort", onRawAbort, { once: true });

      stream.onAbort(() => {
        clearInterval(heartbeat);
        unsubscribe();
        c.req.raw.signal?.removeEventListener("abort", onRawAbort);
      });

      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
      });
    });
  },
);
