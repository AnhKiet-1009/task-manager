import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { InMemoryEventBus } from "../realtime/event-bus.js";

describe("API Core Routes", () => {
  const app = createApp({ enableLogger: false });

  it("returns ok on GET /health", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("@taskmanager/api");
  });

  it("returns domain capabilities on GET /api/v1/meta", async () => {
    const res = await app.request("/api/v1/meta");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      capabilities: { aiCopilot: { features: string[] } };
      domain: { defaultWorkflowStates: unknown[] };
    };
    expect(body.capabilities.aiCopilot.features).toContain("prd_to_backlog");
    expect(body.domain.defaultWorkflowStates).toHaveLength(5);
  });

  it("returns structured JSON error on 404", async () => {
    const res = await app.request("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("InMemoryEventBus", () => {
  it("delivers workspace-scoped events and cleans up on unsubscribe", () => {
    const bus = new InMemoryEventBus();
    const ws1 = "11111111-1111-4111-8111-111111111111";
    const ws2 = "22222222-2222-4222-8222-222222222222";

    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsub1 = bus.subscribe(ws1, listener1);
    const unsub2 = bus.subscribe(ws2, listener2);

    bus.publish({
      id: "evt-1",
      workspaceId: ws1,
      type: "issue.moved",
      actorId: "user-1",
      timestamp: Date.now(),
      payload: { issueId: "ENG-42" },
    });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).not.toHaveBeenCalled();

    unsub1();
    unsub2();
    expect(bus.getSubscriberCount(ws1)).toBe(0);
    expect(bus.getSubscriberCount(ws2)).toBe(0);
  });
});
