import {
  cleanupExpiredSandboxes,
  eq,
  workspaceMembers,
  workspaces,
} from "@taskmanager/db";
import { createPgliteDb } from "@taskmanager/db/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import {
  decryptSecret,
  encryptSecret,
  signGitHubWebhookPayload,
} from "../lib/crypto.js";
import { InMemoryEventBus } from "../realtime/event-bus.js";

function extractCookieHeader(res: Response): string {
  const rawCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];

  if (rawCookies.length > 0) {
    return rawCookies.map((c) => c.split(";")[0]!).join("; ");
  }

  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0]! : "";
}

describe("Phase 1 API Integration (Real PostgreSQL via PGlite)", () => {
  let pg: Awaited<ReturnType<typeof createPgliteDb>>;
  let bus: InMemoryEventBus;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    pg = await createPgliteDb();
    bus = new InMemoryEventBus();
    app = createApp({
      db: pg.db,
      eventBus: bus,
      enableLogger: false,
      authBaseUrl: "http://localhost:8787",
      corsOrigin: "http://localhost:5173",
      authSecret: "test-secret-key-for-vitest-at-least-32-chars",
      byokEncryptionKey: "test-byok-master-key-at-least-32-chars",
      githubWebhookSecret: "test-github-webhook-secret",
    });
  });

  afterAll(async () => {
    await pg.close();
  });

  it("serves health, capabilities metadata, and structured 404 errors", async () => {
    const healthRes = await app.request("/health");
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { status: string; service: string };
    expect(health.status).toBe("ok");
    expect(health.service).toBe("@taskmanager/api");

    const metaRes = await app.request("/api/v1/meta");
    expect(metaRes.status).toBe(200);
    const meta = (await metaRes.json()) as {
      capabilities: { sandboxDemo: boolean; aiCopilot: { features: string[] } };
      domain: { defaultWorkflowStates: unknown[] };
    };
    expect(meta.capabilities.sandboxDemo).toBe(true);
    expect(meta.capabilities.aiCopilot.features).toContain("prd_to_backlog");
    expect(meta.domain.defaultWorkflowStates).toHaveLength(5);

    const notFound = await app.request("/api/v1/does-not-exist");
    expect(notFound.status).toBe(404);
    const errBody = (await notFound.json()) as { error: { code: string } };
    expect(errBody.error.code).toBe("NOT_FOUND");
  });

  it("rejects unauthenticated requests to protected routes with 401", async () => {
    const meRes = await app.request("/api/v1/me");
    expect(meRes.status).toBe(401);
    const body = (await meRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("launches a 1-Click Demo Sandbox with valid session cookie and rich Agile seed data", async () => {
    const res = await app.request("/api/v1/sandbox", { method: "POST" });
    expect(res.status).toBe(201);

    const cookie = extractCookieHeader(res);
    expect(cookie).toContain("better-auth.session_token=");

    const payload = (await res.json()) as {
      user: { id: string; email: string };
      workspace: { id: string; name: string; isSandbox: boolean };
      project: { id: string; key: string };
      activeSprint: { id: string; name: string };
      issueCount: number;
    };
    expect(payload.workspace.isSandbox).toBe(true);
    expect(payload.project.key).toBe("ENG");
    expect(payload.issueCount).toBe(18);

    // Session cookie works immediately on /api/v1/me
    const meRes = await app.request("/api/v1/me", {
      headers: { Cookie: cookie },
    });
    expect(meRes.status).toBe(200);
    const me = (await meRes.json()) as {
      user: { id: string };
      workspaces: Array<{ id: string; role: string; projects: unknown[] }>;
    };
    expect(me.user.id).toBe(payload.user.id);
    expect(me.workspaces[0]?.role).toBe("owner");
    expect(me.workspaces[0]?.projects).toHaveLength(1);

    // Inspect seeded Active Sprint issues + GitHub PR links
    const issuesRes = await app.request(
      `/api/v1/projects/${payload.project.id}/issues?sprintId=${payload.activeSprint.id}`,
      { headers: { Cookie: cookie } },
    );
    expect(issuesRes.status).toBe(200);
    const { issues: sprintIssues } = (await issuesRes.json()) as {
      issues: Array<{
        id: string;
        identifier: string;
        externalLinks: Array<{ status: string }>;
      }>;
    };
    expect(sprintIssues.length).toBe(14);
    expect(sprintIssues.some((i) => i.externalLinks.length > 0)).toBe(true);

    // Inspect deep issue detail (activity logs, relations, comments)
    const eng12 = sprintIssues.find((i) => i.identifier === "ENG-12");
    expect(eng12).toBeDefined();
    const detailRes = await app.request(`/api/v1/issues/${eng12!.id}`, {
      headers: { Cookie: cookie },
    });
    expect(detailRes.status).toBe(200);
    const { issue: detail } = (await detailRes.json()) as {
      issue: {
        identifier: string;
        comments: unknown[];
        activityLogs: unknown[];
        externalLinks: unknown[];
      };
    };
    expect(detail.identifier).toBe("ENG-12");
    expect(detail.comments.length).toBeGreaterThan(0);
    expect(detail.activityLogs.length).toBeGreaterThan(0);
    expect(detail.externalLinks.length).toBeGreaterThan(0);
  });

  it("enforces multi-tenant RBAC, atomic identifiers, LexoRank O(1) move, WIP warnings, and Sprint lifecycle", async () => {
    // 1. Sign up Owner (Alice) via real Better Auth endpoint
    const signUpAlice = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice Owner",
        email: "alice@acme-test.dev",
        password: "StrongPassword123!",
      }),
    });
    expect(signUpAlice.status).toBe(200);
    const aliceCookie = extractCookieHeader(signUpAlice);
    expect(aliceCookie).toContain("better-auth.session_token=");

    // 2. Sign up second user (Bob)
    const signUpBob = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bob Viewer",
        email: "bob@acme-test.dev",
        password: "StrongPassword123!",
      }),
    });
    expect(signUpBob.status).toBe(200);
    const bobCookie = extractCookieHeader(signUpBob);
    const bobAuth = (await signUpBob.json()) as { user: { id: string } };

    // 3. Alice creates Workspace & Project APP
    const wsRes = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie },
      body: JSON.stringify({ name: "Core Team", slug: "core-team" }),
    });
    expect(wsRes.status).toBe(201);
    const { workspace } = (await wsRes.json()) as { workspace: { id: string } };

    const projRes = await app.request(
      `/api/v1/workspaces/${workspace.id}/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: aliceCookie },
        body: JSON.stringify({
          name: "Mobile App",
          key: "APP",
          githubRepoFullName: "core/mobile-app",
        }),
      },
    );
    expect(projRes.status).toBe(201);
    const { project, workflowStates } = (await projRes.json()) as {
      project: { id: string; key: string };
      workflowStates: Array<{ id: string; name: string; category: string }>;
    };
    expect(workflowStates).toHaveLength(5);
    const todoState = workflowStates.find((s) => s.name === "Todo")!;
    const inProgressState = workflowStates.find(
      (s) => s.name === "In Progress",
    )!;
    const doneState = workflowStates.find((s) => s.name === "Done")!;

    // Set tight WIP limit = 1 on In Progress to verify WIP warning
    const wipPatch = await app.request(
      `/api/v1/projects/${project.id}/states/${inProgressState.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: aliceCookie },
        body: JSON.stringify({ wipLimit: 1 }),
      },
    );
    expect(wipPatch.status).toBe(200);

    // 4. Bob is NOT a member yet -> 403 FORBIDDEN
    const bobDenied = await app.request(
      `/api/v1/projects/${project.id}/issues`,
      { headers: { Cookie: bobCookie } },
    );
    expect(bobDenied.status).toBe(403);

    // Add Bob as viewer -> can read (200) but cannot create issue (403 INSUFFICIENT_ROLE)
    await pg.db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: bobAuth.user.id,
      role: "viewer",
    });

    const bobRead = await app.request(`/api/v1/projects/${project.id}/issues`, {
      headers: { Cookie: bobCookie },
    });
    expect(bobRead.status).toBe(200);

    const bobWrite = await app.request(
      `/api/v1/projects/${project.id}/issues`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: bobCookie },
        body: JSON.stringify({ title: "Unauthorized issue attempt" }),
      },
    );
    expect(bobWrite.status).toBe(403);
    const bobErr = (await bobWrite.json()) as { error: { code: string } };
    expect(bobErr.error.code).toBe("INSUFFICIENT_ROLE");

    // 5. Create 2 Sprints & Start Sprint 1
    const s1Res = await app.request(`/api/v1/projects/${project.id}/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie },
      body: JSON.stringify({ name: "Sprint 1", goal: "Ship MVP" }),
    });
    const { sprint: sprint1 } = (await s1Res.json()) as {
      sprint: { id: string };
    };

    const s2Res = await app.request(`/api/v1/projects/${project.id}/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie },
      body: JSON.stringify({ name: "Sprint 2" }),
    });
    const { sprint: sprint2 } = (await s2Res.json()) as {
      sprint: { id: string };
    };

    const startS1 = await app.request(`/api/v1/sprints/${sprint1.id}/start`, {
      method: "POST",
      headers: { Cookie: aliceCookie },
    });
    expect(startS1.status).toBe(200);

    // Cannot start Sprint 2 while Sprint 1 is active
    const startS2Conflict = await app.request(
      `/api/v1/sprints/${sprint2.id}/start`,
      { method: "POST", headers: { Cookie: aliceCookie } },
    );
    expect(startS2Conflict.status).toBe(409);

    // 6. Subscribe to EventBus and create 3 issues with atomic identifiers APP-1, APP-2, APP-3
    const eventSpy = vi.fn();
    const unsub = bus.subscribe(workspace.id, eventSpy);

    const createIssue = async (
      title: string,
      stateId: string,
      storyPoints: number,
    ) => {
      const r = await app.request(`/api/v1/projects/${project.id}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: aliceCookie },
        body: JSON.stringify({
          title,
          stateId,
          sprintId: sprint1.id,
          storyPoints,
          type: "story",
          priority: "high",
        }),
      });
      expect(r.status).toBe(201);
      const data = (await r.json()) as {
        issue: { id: string; identifier: string; position: string };
      };
      return data.issue;
    };

    const issue1 = await createIssue("First issue", inProgressState.id, 5);
    const issue2 = await createIssue("Second issue", todoState.id, 3);
    const issue3 = await createIssue("Third issue", doneState.id, 8);

    expect(issue1.identifier).toBe("APP-1");
    expect(issue2.identifier).toBe("APP-2");
    expect(issue3.identifier).toBe("APP-3");

    // 7. Move issue2 into In Progress (exceeds WIP limit = 1!)
    const moveRes = await app.request(`/api/v1/issues/${issue2.id}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie },
      body: JSON.stringify({
        stateId: inProgressState.id,
        prevPosition: issue1.position,
        nextPosition: null,
      }),
    });
    expect(moveRes.status).toBe(200);
    const movedBody = (await moveRes.json()) as {
      issue: { position: string; stateId: string };
      wipWarning: { wipLimit: number; currentCount: number } | null;
    };
    expect(issue1.position < movedBody.issue.position).toBe(true);
    expect(movedBody.wipWarning).toEqual({
      stateId: inProgressState.id,
      stateName: "In Progress",
      wipLimit: 1,
      currentCount: 2,
    });

    // Verify realtime events were published (3 created + 1 moved = 4)
    expect(eventSpy).toHaveBeenCalledTimes(4);
    expect(eventSpy.mock.calls[3]?.[0]).toMatchObject({
      type: "issue.moved",
      workspaceId: workspace.id,
    });
    unsub();

    // Prevent deleting workflow state that still contains issues
    const delStateConflict = await app.request(
      `/api/v1/projects/${project.id}/states/${inProgressState.id}`,
      { method: "DELETE", headers: { Cookie: aliceCookie } },
    );
    expect(delStateConflict.status).toBe(409);

    // 8. Complete Sprint 1 -> calculates velocitySnapshot (8 pts from APP-3) & rolls APP-1, APP-2 to Sprint 2
    const completeRes = await app.request(
      `/api/v1/sprints/${sprint1.id}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: aliceCookie },
        body: JSON.stringify({ moveIncompleteToSprintId: sprint2.id }),
      },
    );
    expect(completeRes.status).toBe(200);
    const completed = (await completeRes.json()) as {
      completedPoints: number;
      movedIncompleteCount: number;
      sprint: { status: string; velocitySnapshot: number };
    };
    expect(completed.sprint.status).toBe("completed");
    expect(completed.completedPoints).toBe(8);
    expect(completed.sprint.velocitySnapshot).toBe(8);
    expect(completed.movedIncompleteCount).toBe(2);

    // Verify APP-1 & APP-2 are now in Sprint 2
    const s2IssuesRes = await app.request(
      `/api/v1/projects/${project.id}/issues?sprintId=${sprint2.id}`,
      { headers: { Cookie: aliceCookie } },
    );
    const { issues: s2Issues } = (await s2IssuesRes.json()) as {
      issues: Array<{ identifier: string }>;
    };
    expect(s2Issues.map((i) => i.identifier).sort()).toEqual(["APP-1", "APP-2"]);
  });

  it("cleans up expired sandbox workspaces without deleting active workspaces", async () => {
    const expiredIdRes = await app.request("/api/v1/sandbox", {
      method: "POST",
    });
    const { workspace: expiredWs } = (await expiredIdRes.json()) as {
      workspace: { id: string };
    };

    // Force expiration into the past
    await pg.db
      .update(workspaces)
      .set({ sandboxExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(workspaces.id, expiredWs.id));

    const purged = await cleanupExpiredSandboxes(pg.db);
    expect(purged).toBe(1);

    const remaining = await pg.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, expiredWs.id));
    expect(remaining).toHaveLength(0);
  });

  it("supports comment deletion RBAC, issue relations with realtime broadcast, and SSE workspace stream", async () => {
    // 1. Sign up Owner (Dan), Member (Eve), and Non-member (Frank)
    const signUp = async (name: string, email: string) => {
      const r = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: "StrongPassword123!" }),
      });
      expect(r.status).toBe(200);
      const data = (await r.json()) as { user: { id: string } };
      return { userId: data.user.id, cookie: extractCookieHeader(r) };
    };

    const dan = await signUp("Dan Owner", "dan@rel-test.dev");
    const eve = await signUp("Eve Member", "eve@rel-test.dev");
    const frank = await signUp("Frank Outsider", "frank@rel-test.dev");

    // 2. Create workspace + project + 2 issues
    const wsRes = await app.request("/api/v1/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: dan.cookie },
      body: JSON.stringify({ name: "Rel Team", slug: "rel-team" }),
    });
    const { workspace } = (await wsRes.json()) as { workspace: { id: string } };

    await pg.db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: eve.userId,
      role: "member",
    });

    const projRes = await app.request(
      `/api/v1/workspaces/${workspace.id}/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: dan.cookie },
        body: JSON.stringify({ name: "Rel Engine", key: "REL" }),
      },
    );
    const { project } = (await projRes.json()) as { project: { id: string } };

    const makeIssue = async (title: string) => {
      const r = await app.request(`/api/v1/projects/${project.id}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: dan.cookie },
        body: JSON.stringify({ title, priority: "high" }),
      });
      expect(r.status).toBe(201);
      const body = (await r.json()) as {
        issue: { id: string; identifier: string };
      };
      return body.issue;
    };

    const rel1 = await makeIssue("Blocking API issue");
    const rel2 = await makeIssue("Blocked UI issue");

    // 3. Comment creation & deletion RBAC
    const danCommentRes = await app.request(
      `/api/v1/issues/${rel1.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: dan.cookie },
        body: JSON.stringify({ bodyMd: "Cần xử lý trước @Eve Member" }),
      },
    );
    expect(danCommentRes.status).toBe(201);
    const { comment: danComment } = (await danCommentRes.json()) as {
      comment: { id: string };
    };

    // Another member cannot delete Dan's comment -> 403
    const eveDeleteForbidden = await app.request(
      `/api/v1/comments/${danComment.id}`,
      { method: "DELETE", headers: { Cookie: eve.cookie } },
    );
    expect(eveDeleteForbidden.status).toBe(403);

    // Dan (author) deletes his own comment -> 200
    const eventSpy = vi.fn();
    const unsub = bus.subscribe(workspace.id, eventSpy);

    const danDeleteOk = await app.request(
      `/api/v1/comments/${danComment.id}`,
      { method: "DELETE", headers: { Cookie: dan.cookie } },
    );
    expect(danDeleteOk.status).toBe(200);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "issue.updated",
        payload: expect.objectContaining({
          issueId: rel1.id,
          action: "comment_deleted",
        }),
      }),
    );

    // 4. Issue Relations (self-relation guard, create, inspect outgoing/incoming, delete)
    const selfRelRes = await app.request(
      `/api/v1/issues/${rel1.id}/relations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: dan.cookie },
        body: JSON.stringify({ targetIssueId: rel1.id, type: "blocks" }),
      },
    );
    expect(selfRelRes.status).toBe(400);
    const selfErr = (await selfRelRes.json()) as { error: { code: string } };
    expect(selfErr.error.code).toBe("SELF_RELATION_FORBIDDEN");

    const relCreateRes = await app.request(
      `/api/v1/issues/${rel1.id}/relations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: dan.cookie },
        body: JSON.stringify({ targetIssueId: rel2.id, type: "blocks" }),
      },
    );
    expect(relCreateRes.status).toBe(201);
    const { relation } = (await relCreateRes.json()) as {
      relation: { id: string };
    };
    expect(relation.id).toBeTruthy();

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "issue.updated",
        payload: expect.objectContaining({
          issueId: rel1.id,
          targetIssueId: rel2.id,
          action: "relation_added",
        }),
      }),
    );

    // Verify enriched outgoing/incoming relations include stateId & priority
    const detail1Res = await app.request(`/api/v1/issues/${rel1.id}`, {
      headers: { Cookie: eve.cookie },
    });
    const detail1 = (await detail1Res.json()) as {
      issue: {
        relations: {
          outgoing: Array<{
            id: string;
            type: string;
            targetIssue: { identifier: string; stateId: string; priority: string };
          }>;
        };
      };
    };
    expect(detail1.issue.relations.outgoing[0]).toMatchObject({
      type: "blocks",
      targetIssue: { identifier: rel2.identifier, priority: "high" },
    });
    expect(detail1.issue.relations.outgoing[0]?.targetIssue.stateId).toBeTruthy();

    const detail2Res = await app.request(`/api/v1/issues/${rel2.id}`, {
      headers: { Cookie: eve.cookie },
    });
    const detail2 = (await detail2Res.json()) as {
      issue: {
        relations: {
          incoming: Array<{
            type: string;
            sourceIssue: { identifier: string; stateId: string };
          }>;
        };
      };
    };
    expect(detail2.issue.relations.incoming[0]).toMatchObject({
      type: "blocks",
      sourceIssue: { identifier: rel1.identifier },
    });

    const relDeleteRes = await app.request(
      `/api/v1/issue-relations/${relation.id}`,
      { method: "DELETE", headers: { Cookie: eve.cookie } },
    );
    expect(relDeleteRes.status).toBe(200);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "issue.updated",
        payload: expect.objectContaining({
          issueId: rel1.id,
          targetIssueId: rel2.id,
          action: "relation_removed",
        }),
      }),
    );
    unsub();

    // 5. SSE Events endpoint auth & stream verification
    const sseUnauth = await app.request(
      `/api/v1/workspaces/${workspace.id}/events`,
    );
    expect(sseUnauth.status).toBe(401);

    const sseForbidden = await app.request(
      `/api/v1/workspaces/${workspace.id}/events`,
      { headers: { Cookie: frank.cookie } },
    );
    expect(sseForbidden.status).toBe(403);

    const sseOk = await app.request(
      `/api/v1/workspaces/${workspace.id}/events`,
      { headers: { Cookie: eve.cookie } },
    );
    expect(sseOk.status).toBe(200);
    expect(sseOk.headers.get("content-type")).toContain("text/event-stream");

    const reader = sseOk.body!.getReader();
    const { value } = await reader.read();
    const chunkText = new TextDecoder().decode(value);
    expect(chunkText).toContain("event: connected");
    expect(chunkText).toContain(workspace.id);
    await reader.cancel();
  });

  it("supports Sprint Analytics, AES-256-GCM BYOK Vault, all 3 AI Copilot pillars, and HMAC-verified GitHub PR Automation", async () => {
    // 1. Verify AES-256-GCM encryption round-trip directly
    const cipher = await encryptSecret("sk-test-byok-secret-123456", "master-key");
    expect(cipher.encryptedApiKey).not.toContain("sk-test");
    const decrypted = await decryptSecret(cipher, "master-key");
    expect(decrypted).toBe("sk-test-byok-secret-123456");

    // 2. Launch a fresh Sandbox workspace (has ENG, Sprint 13/14/15, 2 stalled issues ENG-13 & ENG-14)
    const sbRes = await app.request("/api/v1/sandbox", { method: "POST" });
    expect(sbRes.status).toBe(201);
    const cookie = extractCookieHeader(sbRes);
    const sb = (await sbRes.json()) as {
      workspace: { id: string };
      project: { id: string; key: string };
      activeSprint: { id: string };
    };

    // 3. Sprint Analytics (Burndown, Velocity, Workload, Stalled Issues)
    const analyticsRes = await app.request(
      `/api/v1/projects/${sb.project.id}/analytics?sprintId=${sb.activeSprint.id}`,
      { headers: { Cookie: cookie } },
    );
    expect(analyticsRes.status).toBe(200);
    const { analytics } = (await analyticsRes.json()) as {
      analytics: {
        burndown: Array<{ date: string; idealPoints: number }>;
        velocity: Array<{ name: string; completedPoints: number }>;
        workload: unknown[];
        stalledIssues: Array<{ identifier: string }>;
        summary: { averageVelocity: number; stalledCount: number };
      };
    };
    expect(analytics.burndown.length).toBeGreaterThanOrEqual(10);
    expect(analytics.velocity).toHaveLength(3);
    expect(analytics.summary.averageVelocity).toBe(26);
    expect(analytics.stalledIssues.map((s) => s.identifier)).toEqual(
      expect.arrayContaining(["ENG-13", "ENG-14"]),
    );

    // 4. Workspace BYOK Settings (encrypts key, never returns plaintext, supports clear)
    const putByok = await app.request(
      `/api/v1/workspaces/${sb.workspace.id}/ai/settings`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          provider: "gemini",
          model: "gemini-2.5-flash",
          apiKey: "AIzaSyFakeDemoKey123456789",
        }),
      },
    );
    expect(putByok.status).toBe(200);
    const byokSaved = (await putByok.json()) as {
      settings: { hasByokKey: boolean; provider: string };
    };
    expect(byokSaved.settings.hasByokKey).toBe(true);
    expect(JSON.stringify(byokSaved)).not.toContain("AIzaSyFakeDemoKey");

    // Clear BYOK so subsequent AI tests cleanly exercise deterministic Smart Fallback
    const clearByok = await app.request(
      `/api/v1/workspaces/${sb.workspace.id}/ai/settings`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ provider: "gemini", clearKey: true }),
      },
    );
    expect(clearByok.status).toBe(200);
    const cleared = (await clearByok.json()) as {
      settings: { hasByokKey: boolean };
    };
    expect(cleared.settings.hasByokKey).toBe(false);

    // 5. AI Pillar 1: PRD-to-Backlog generate + atomic commit into PostgreSQL
    const prdRes = await app.request("/api/v1/ai/prd-breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        projectId: sb.project.id,
        sprintId: sb.activeSprint.id,
        prompt: [
          "Xây dựng hệ thống Thông báo Realtime đa kênh",
          "- Thiết kế bảng notifications & API đánh dấu đã đọc",
          "- Gửi thông báo realtime qua SSE khi có @mention",
          "- Xây dựng chuông thông báo trên TopBar",
          "- Viết integration test bảo mật multi-tenant",
        ].join("\n"),
        maxIssues: 6,
      }),
    });
    expect(prdRes.status).toBe(200);
    const { breakdown } = (await prdRes.json()) as {
      breakdown: {
        epic: { title: string; descriptionMd: string; priority: string };
        issues: Array<{
          tempId: string;
          title: string;
          descriptionMd: string;
          type: string;
          priority: string;
          storyPoints: number;
          blockedByTempIds: string[];
        }>;
      };
    };
    expect(breakdown.issues.length).toBeGreaterThanOrEqual(3);

    const commitRes = await app.request("/api/v1/ai/prd-breakdown/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        projectId: sb.project.id,
        sprintId: sb.activeSprint.id,
        epic: breakdown.epic,
        issues: breakdown.issues,
      }),
    });
    expect(commitRes.status).toBe(201);
    const committed = (await commitRes.json()) as {
      epic: { identifier: string };
      issues: Array<{ identifier: string }>;
      relationsCreated: number;
    };
    expect(committed.epic.identifier).toBe("ENG-19");
    expect(committed.issues[0]?.identifier).toBe("ENG-20");
    expect(committed.relationsCreated).toBeGreaterThanOrEqual(1);

    // 6. AI Pillar 2: AI Sprint Risk & Bottleneck Radar
    const riskRes = await app.request("/api/v1/ai/sprint-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        projectId: sb.project.id,
        sprintId: sb.activeSprint.id,
      }),
    });
    expect(riskRes.status).toBe(200);
    const { report } = (await riskRes.json()) as {
      report: {
        riskLevel: string;
        riskScore: number;
        stalledIssueIdentifiers: string[];
        recommendations: string[];
      };
    };
    expect(report.riskScore).toBeGreaterThan(20);
    expect(report.stalledIssueIdentifiers).toEqual(
      expect.arrayContaining(["ENG-13", "ENG-14"]),
    );
    expect(report.recommendations.length).toBeGreaterThanOrEqual(1);

    // 7. AI Pillar 3: Natural Language Filter (Vietnamese -> structured AST)
    const nlRes = await app.request("/api/v1/ai/nl-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        projectId: sb.project.id,
        query: "bug ưu tiên cao chưa có người làm quá hạn",
      }),
    });
    expect(nlRes.status).toBe(200);
    const { filter } = (await nlRes.json()) as {
      filter: {
        types?: string[];
        priorities?: string[];
        unassignedOnly?: boolean;
        overdueOnly?: boolean;
        explanation: string;
      };
    };
    expect(filter.types).toContain("bug");
    expect(filter.priorities).toContain("high");
    expect(filter.unassignedOnly).toBe(true);
    expect(filter.overdueOnly).toBe(true);

    // 8. GitHub Smart PR Webhook (HMAC-SHA256 verification + auto-transition ENG-16 -> In Review -> Done)
    const rawPrOpenBody = JSON.stringify({
      action: "opened",
      repository: { full_name: "acme-corp/core-platform" },
      pull_request: {
        number: 777,
        title: "feat(ai): implement ENG-16 natural language filter",
        body: "Working on ENG-16",
        html_url: "https://github.com/acme-corp/core-platform/pull/777",
        state: "open",
        draft: false,
        merged: false,
        head: { ref: "feat/eng-16-nl-filter" },
      },
    });

    // Invalid signature must be rejected with 401
    const badSigRes = await app.request("/api/v1/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=deadbeef",
      },
      body: rawPrOpenBody,
    });
    expect(badSigRes.status).toBe(401);

    // Valid HMAC-SHA256 signature links PR #777 and moves ENG-16 to In Review
    const ghSpy = vi.fn();
    const unsubGh = bus.subscribe(sb.workspace.id, ghSpy);

    const validOpenSig = await signGitHubWebhookPayload(
      rawPrOpenBody,
      "test-github-webhook-secret",
    );
    const openRes = await app.request("/api/v1/webhooks/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": validOpenSig,
      },
      body: rawPrOpenBody,
    });
    expect(openRes.status).toBe(200);
    expect(ghSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "github.pr_synced",
        payload: expect.objectContaining({
          identifier: "ENG-16",
          nextStateName: "In Review",
        }),
      }),
    );

    // Simulate Merge PR via interactive simulator -> transitions ENG-16 to Done!
    const simMergeRes = await app.request(
      `/api/v1/projects/${sb.project.id}/github/simulate-pr`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          issueIdentifier: "ENG-16",
          action: "merged",
          prNumber: 777,
        }),
      },
    );
    expect(simMergeRes.status).toBe(200);
    const simMerge = (await simMergeRes.json()) as {
      updatedIssues: Array<{
        identifier: string;
        nextStateName: string;
        transitioned: boolean;
      }>;
    };
    expect(simMerge.updatedIssues[0]).toMatchObject({
      identifier: "ENG-16",
      nextStateName: "Done",
      transitioned: true,
    });
    unsubGh();
  });
});
