import {
  DEFAULT_WORKFLOW_STATES,
  generateInitialRanks,
  type IssuePriority,
  type IssueType,
} from "@taskmanager/shared";
import { and, eq, lt } from "drizzle-orm";
import type { AppDatabase } from "./client.js";
import {
  activityLogs,
  comments,
  externalLinks,
  issueLabels,
  issueRelations,
  issues,
  labels,
  projects,
  sprints,
  users,
  workflowStates,
  workspaceMembers,
  workspaces,
} from "./schema/index.js";

function toIsoDate(offsetDays: number, base: Date = new Date()): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function hoursAgo(hours: number, base: Date = new Date()): Date {
  return new Date(base.getTime() - hours * 60 * 60 * 1000);
}

const DEMO_TEAMMATES = [
  {
    id: "sandbox-teammate-alice",
    name: "Minh Anh (Staff FE)",
    email: "minh.anh@demo-acme.local",
    image: null,
  },
  {
    id: "sandbox-teammate-bob",
    name: "Hoàng Nam (Backend Lead)",
    email: "hoang.nam@demo-acme.local",
    image: null,
  },
] as const;

export interface SeedSandboxInput {
  userId: string;
  workspaceName?: string;
  ttlHours?: number;
}

export interface SeedSandboxResult {
  workspace: { id: string; name: string; slug: string; isSandbox: boolean };
  project: { id: string; key: string; name: string };
  activeSprint: { id: string; name: string };
  issueCount: number;
}

/**
 * Seeds a rich, isolated Agile Engineering Sandbox Workspace (Project ENG,
 * 5 custom Workflow States, 3 Sprints, 3 Epics, 15 Issues with LexoRank,
 * GitHub PR links, Relations, Comments, and 6 days of Burndown activity logs).
 */
export async function seedSandboxWorkspace(
  db: AppDatabase,
  input: SeedSandboxInput,
): Promise<SeedSandboxResult> {
  const now = new Date();
  const ttlHours = input.ttlHours ?? 24;
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const shortSuffix = crypto.randomUUID().slice(0, 8);
  const slug = `acme-demo-${shortSuffix}`;

  return db.transaction(async (tx) => {
    // 1. Ensure simulated teammates exist for realistic assignees & comments
    for (const mate of DEMO_TEAMMATES) {
      await tx
        .insert(users)
        .values({
          id: mate.id,
          name: mate.name,
          email: mate.email,
          emailVerified: true,
          image: mate.image,
        })
        .onConflictDoNothing();
    }

    // 2. Create isolated Sandbox Workspace
    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: input.workspaceName ?? "Acme Engineering (Demo)",
        slug,
        isSandbox: true,
        sandboxExpiresAt: expiresAt,
      })
      .returning();

    if (!workspace) {
      throw new Error("Failed to create sandbox workspace");
    }

    // 3. Assign owner + teammates
    await tx.insert(workspaceMembers).values([
      { workspaceId: workspace.id, userId: input.userId, role: "owner" },
      { workspaceId: workspace.id, userId: DEMO_TEAMMATES[0].id, role: "admin" },
      { workspaceId: workspace.id, userId: DEMO_TEAMMATES[1].id, role: "member" },
    ]);

    // 4. Create ENG Project
    const [project] = await tx
      .insert(projects)
      .values({
        workspaceId: workspace.id,
        key: "ENG",
        name: "Core Platform",
        description:
          "Nền tảng AI-First Agile PM: Sprint Engine, Smart GitHub Automation và AI Copilot.",
        issueSequence: 18,
        githubRepoFullName: "acme-corp/core-platform",
      })
      .returning();

    if (!project) {
      throw new Error("Failed to create sandbox project");
    }

    // 5. Create 5 semantic workflow states with LexoRank positions
    const stateRanks = generateInitialRanks(DEFAULT_WORKFLOW_STATES.length);
    const createdStates = await tx
      .insert(workflowStates)
      .values(
        DEFAULT_WORKFLOW_STATES.map((s, idx) => ({
          projectId: project.id,
          name: s.name,
          category: s.category,
          color: s.color,
          wipLimit: s.wipLimit,
          position: stateRanks[idx]!,
          isDefault: s.isDefault,
        })),
      )
      .returning();

    const stateByName = new Map(createdStates.map((s) => [s.name, s]));
    const backlogState = stateByName.get("Backlog")!;
    const todoState = stateByName.get("Todo")!;
    const inProgressState = stateByName.get("In Progress")!;
    const inReviewState = stateByName.get("In Review")!;
    const doneState = stateByName.get("Done")!;

    // 6. Create project labels
    const labelDefs = [
      { name: "backend", color: "#0ea5e9" },
      { name: "frontend", color: "#8b5cf6" },
      { name: "ai-copilot", color: "#ec4899" },
      { name: "security", color: "#ef4444" },
      { name: "performance", color: "#f59e0b" },
      { name: "bug", color: "#dc2626" },
    ];
    const createdLabels = await tx
      .insert(labels)
      .values(labelDefs.map((l) => ({ ...l, projectId: project.id })))
      .returning();
    const labelByName = new Map(createdLabels.map((l) => [l.name, l.id]));

    // 7. Create 3 Sprints (Completed, Active day 6/14, Planned)
    const [sprint13, sprint14, sprint15] = await tx
      .insert(sprints)
      .values([
        {
          projectId: project.id,
          name: "Sprint 13 — Monorepo & Auth",
          goal: "Hoàn thiện nền tảng Monorepo, Drizzle Schema và Better Auth RBAC.",
          status: "completed",
          startDate: toIsoDate(-20, now),
          endDate: toIsoDate(-7, now),
          velocitySnapshot: 26,
        },
        {
          projectId: project.id,
          name: "Sprint 14 — AI Copilot & GitHub Sync",
          goal: "Ra mắt PRD-to-Backlog AI, Radar rủi ro Sprint và đồng bộ PR GitHub tự động.",
          status: "active",
          startDate: toIsoDate(-6, now),
          endDate: toIsoDate(8, now),
        },
        {
          projectId: project.id,
          name: "Sprint 15 — Scale & Enterprise",
          goal: "Chuẩn hóa Cloudflare Edge deploy, Audit Log nâng cao và Custom Fields.",
          status: "planned",
          startDate: toIsoDate(9, now),
          endDate: toIsoDate(23, now),
        },
      ])
      .returning();

    if (!sprint13 || !sprint14 || !sprint15) {
      throw new Error("Failed to create sandbox sprints");
    }

    // 8. Seed 3 Epics (ENG-1 .. ENG-3)
    const epicRanks = generateInitialRanks(3);
    const [epicAi, epicGithub, epicBoard] = await tx
      .insert(issues)
      .values([
        {
          projectId: project.id,
          identifier: "ENG-1",
          type: "epic",
          stateId: inProgressState.id,
          assigneeId: input.userId,
          reporterId: input.userId,
          title: "AI Copilot Engine (PRD Breakdown & Risk Radar)",
          descriptionMd:
            "Xây dựng lớp AI Provider-Agnostic (Gemini/Groq + BYOK) giúp tự động chia Epic/Story và phát hiện rủi ro Sprint.",
          priority: "urgent",
          position: epicRanks[0]!,
          dueDate: toIsoDate(8, now),
        },
        {
          projectId: project.id,
          identifier: "ENG-2",
          type: "epic",
          stateId: inProgressState.id,
          assigneeId: DEMO_TEAMMATES[1].id,
          reporterId: input.userId,
          title: "GitHub Smart PR & Branch Automation",
          descriptionMd:
            "Tự động liên kết PR với Issue qua mã `ENG-xx`, cập nhật cột trạng thái theo vòng đời PR.",
          priority: "high",
          position: epicRanks[1]!,
          dueDate: toIsoDate(8, now),
        },
        {
          projectId: project.id,
          identifier: "ENG-3",
          type: "epic",
          stateId: inProgressState.id,
          assigneeId: DEMO_TEAMMATES[0].id,
          reporterId: input.userId,
          title: "Linear-Speed Kanban & Optimistic UI",
          descriptionMd:
            "Kéo-thả O(1) với LexoRank, Command Palette Ctrl+K và đồng bộ Realtime SSE dưới 16ms.",
          priority: "high",
          position: epicRanks[2]!,
          dueDate: toIsoDate(14, now),
        },
      ])
      .returning();

    if (!epicAi || !epicGithub || !epicBoard) {
      throw new Error("Failed to create sandbox epics");
    }

    // 9. Seed 15 realistic Issues (ENG-4 .. ENG-18)
    interface IssueSeedSpec {
      identifier: string;
      type: IssueType;
      parentId: string | null;
      sprintId: string | null;
      stateId: string;
      assigneeId: string | null;
      title: string;
      descriptionMd: string;
      priority: IssuePriority;
      storyPoints: number | null;
      dueDate: string | null;
      labels: string[];
      updatedHoursAgo?: number;
      completedHoursAgo?: number;
      pr?: {
        number: string;
        title: string;
        status: "open" | "draft" | "merged" | "closed";
      };
    }

    const issueSpecs: IssueSeedSpec[] = [
      // DONE in Active Sprint 14 (5 issues, 16 pts — creates realistic Burndown slope)
      {
        identifier: "ENG-4",
        type: "story",
        parentId: epicBoard.id,
        sprintId: sprint14.id,
        stateId: doneState.id,
        assigneeId: DEMO_TEAMMATES[0].id,
        title: "Cài đặt thuật toán LexoRank Base-62 cho kéo thả O(1)",
        descriptionMd:
          "Đảm bảo thứ tự chuỗi khớp hoàn toàn giữa JavaScript và PostgreSQL `COLLATE \"C\"`.",
        priority: "high",
        storyPoints: 3,
        dueDate: toIsoDate(-3, now),
        labels: ["frontend", "performance"],
        updatedHoursAgo: 120,
        completedHoursAgo: 120,
        pr: {
          number: "141",
          title: "feat(shared): deterministic base-62 lexorank utility",
          status: "merged",
        },
      },
      {
        identifier: "ENG-5",
        type: "task",
        parentId: epicGithub.id,
        sprintId: sprint14.id,
        stateId: doneState.id,
        assigneeId: DEMO_TEAMMATES[1].id,
        title: "Xác thực chữ ký HMAC-SHA256 cho GitHub Webhook",
        descriptionMd:
          "Từ chối mọi payload thiếu hoặc sai header `X-Hub-Signature-256` với HTTP 401.",
        priority: "urgent",
        storyPoints: 3,
        dueDate: toIsoDate(-2, now),
        labels: ["backend", "security"],
        updatedHoursAgo: 96,
        completedHoursAgo: 96,
        pr: {
          number: "144",
          title: "feat(api): verify github webhook hmac-sha256 signature",
          status: "merged",
        },
      },
      {
        identifier: "ENG-6",
        type: "story",
        parentId: epicAi.id,
        sprintId: sprint14.id,
        stateId: doneState.id,
        assigneeId: input.userId,
        title: "Thiết kế Zod Structured Output cho PRD-to-Backlog",
        descriptionMd:
          "Định nghĩa schema Epic + danh sách Issues + Story Points + Dependencies để ép LLM trả JSON chuẩn 100%.",
        priority: "high",
        storyPoints: 5,
        dueDate: toIsoDate(-1, now),
        labels: ["ai-copilot", "backend"],
        updatedHoursAgo: 72,
        completedHoursAgo: 72,
        pr: {
          number: "147",
          title: "feat(ai): zod structured output schema for prd breakdown",
          status: "merged",
        },
      },
      {
        identifier: "ENG-7",
        type: "bug",
        parentId: epicBoard.id,
        sprintId: sprint14.id,
        stateId: doneState.id,
        assigneeId: DEMO_TEAMMATES[0].id,
        title: "Sửa lỗi mất focus bàn phím khi mở Command Palette Ctrl+K",
        descriptionMd:
          "Khi đang gõ trong ô search filter và nhấn `Ctrl+K`, input của dialog cần tự động focus.",
        priority: "medium",
        storyPoints: 2,
        dueDate: toIsoDate(-1, now),
        labels: ["frontend", "bug"],
        updatedHoursAgo: 48,
        completedHoursAgo: 48,
        pr: {
          number: "149",
          title: "fix(web): restore input focus on cmd+k dialog open",
          status: "merged",
        },
      },
      {
        identifier: "ENG-8",
        type: "task",
        parentId: epicAi.id,
        sprintId: sprint14.id,
        stateId: doneState.id,
        assigneeId: DEMO_TEAMMATES[1].id,
        title: "Mã hóa AES-256-GCM cho Workspace BYOK API Key",
        descriptionMd:
          "Không lưu plaintext API key; chỉ giải mã trong bộ nhớ tại thời điểm gọi LLM.",
        priority: "urgent",
        storyPoints: 3,
        dueDate: toIsoDate(0, now),
        labels: ["security", "ai-copilot"],
        updatedHoursAgo: 24,
        completedHoursAgo: 24,
        pr: {
          number: "152",
          title: "feat(security): aes-256-gcm vault for workspace byok keys",
          status: "merged",
        },
      },

      // IN REVIEW in Active Sprint 14 (3 issues, 11 pts)
      {
        identifier: "ENG-9",
        type: "story",
        parentId: epicGithub.id,
        sprintId: sprint14.id,
        stateId: inReviewState.id,
        assigneeId: DEMO_TEAMMATES[1].id,
        title: "Tự động chuyển trạng thái Issue khi PR mở và merge",
        descriptionMd:
          "Bắt cú pháp `Closes ENG-xx` trong PR body để tự động đưa thẻ sang `In Review` và `Done`.",
        priority: "high",
        storyPoints: 5,
        dueDate: toIsoDate(2, now),
        labels: ["backend"],
        updatedHoursAgo: 6,
        pr: {
          number: "156",
          title: "feat(github): auto-transition workflow state on PR lifecycle",
          status: "open",
        },
      },
      {
        identifier: "ENG-10",
        type: "story",
        parentId: epicBoard.id,
        sprintId: sprint14.id,
        stateId: inReviewState.id,
        assigneeId: DEMO_TEAMMATES[0].id,
        title: "Nâng cấp Kanban Board dùng @dnd-kit kèm cảnh báo WIP Limit",
        descriptionMd:
          "Hỗ trợ kéo thả mượt bằng chuột và bàn phím, hiển thị viền cảnh báo khi cột vượt giới hạn WIP.",
        priority: "high",
        storyPoints: 5,
        dueDate: toIsoDate(3, now),
        labels: ["frontend", "performance"],
        updatedHoursAgo: 10,
        pr: {
          number: "158",
          title: "feat(board): dnd-kit sortable kanban with wip limit indicator",
          status: "open",
        },
      },
      {
        identifier: "ENG-11",
        type: "bug",
        parentId: epicBoard.id,
        sprintId: sprint14.id,
        stateId: inReviewState.id,
        assigneeId: input.userId,
        title: "Rollback Optimistic UI khi server trả lỗi 403 Viewer",
        descriptionMd:
          "Đảm bảo thẻ quay lại đúng vị trí LexoRank cũ và hiện Toast thông báo quyền hạn.",
        priority: "medium",
        storyPoints: 1,
        dueDate: toIsoDate(2, now),
        labels: ["frontend", "bug"],
        updatedHoursAgo: 4,
      },

      // IN PROGRESS in Active Sprint 14 (4 issues, 18 pts — 2 intentionally stalled for AI Risk Radar!)
      {
        identifier: "ENG-12",
        type: "story",
        parentId: epicAi.id,
        sprintId: sprint14.id,
        stateId: inProgressState.id,
        assigneeId: input.userId,
        title: "Xây dựng AI Sprint Risk & Bottleneck Radar",
        descriptionMd:
          "Phân tích velocity thực tế, số ngày còn lại và các thẻ bị kẹt > 3 ngày ở `In Progress`.",
        priority: "urgent",
        storyPoints: 8,
        dueDate: toIsoDate(4, now),
        labels: ["ai-copilot", "backend"],
        updatedHoursAgo: 12,
        pr: {
          number: "160",
          title: "wip(ai): sprint risk scoring & stalled issue detector",
          status: "draft",
        },
      },
      {
        identifier: "ENG-13",
        type: "bug",
        parentId: epicGithub.id,
        sprintId: sprint14.id,
        stateId: inProgressState.id,
        assigneeId: DEMO_TEAMMATES[1].id,
        title: "Khắc phục race condition khi 2 webhook PR đến cùng mili-giây",
        descriptionMd:
          "Cần dùng upsert trên `uq_external_links_issue_ref` và hàng đợi idempotent.",
        priority: "urgent",
        storyPoints: 5,
        dueDate: toIsoDate(-1, now), // Overdue + stalled 5 days -> AI Radar flags this!
        labels: ["backend", "bug"],
        updatedHoursAgo: 118,
      },
      {
        identifier: "ENG-14",
        type: "task",
        parentId: epicBoard.id,
        sprintId: sprint14.id,
        stateId: inProgressState.id,
        assigneeId: DEMO_TEAMMATES[0].id,
        title: "Tích hợp SSE Event Stream đồng bộ 2 tab trình duyệt tức thì",
        descriptionMd:
          "Tự động reconnect với exponential backoff và cập nhật TanStack Query cache theo sự kiện.",
        priority: "high",
        storyPoints: 3,
        dueDate: toIsoDate(1, now),
        labels: ["frontend", "performance"],
        updatedHoursAgo: 98, // Stalled 4+ days -> AI Radar flags this too!
      },
      {
        identifier: "ENG-15",
        type: "subtask",
        parentId: epicAi.id,
        sprintId: sprint14.id,
        stateId: inProgressState.id,
        assigneeId: input.userId,
        title: "Thêm Rate Limit Upstash Redis bảo vệ quota Gemini Free Tier",
        descriptionMd:
          "Giới hạn 15 lượt gọi AI/ngày cho workspace chưa cấu hình BYOK.",
        priority: "medium",
        storyPoints: 2,
        dueDate: toIsoDate(5, now),
        labels: ["ai-copilot", "security"],
        updatedHoursAgo: 8,
      },

      // TODO in Active Sprint 14 (2 issues, 5 pts)
      {
        identifier: "ENG-16",
        type: "story",
        parentId: epicAi.id,
        sprintId: sprint14.id,
        stateId: todoState.id,
        assigneeId: null, // Unassigned — great for Natural Language Filter demo!
        title: "Bộ lọc ngôn ngữ tự nhiên (Natural Language Filter thay JQL)",
        descriptionMd:
          "Cho phép nhập tiếng Việt/Anh như 'bug ưu tiên cao chưa có người làm' để lọc Board tức thì.",
        priority: "high",
        storyPoints: 3,
        dueDate: toIsoDate(6, now),
        labels: ["ai-copilot", "frontend"],
      },
      {
        identifier: "ENG-17",
        type: "task",
        parentId: epicGithub.id,
        sprintId: sprint14.id,
        stateId: todoState.id,
        assigneeId: null,
        title: "Thêm nút Copy Git Branch 1-click trên Issue Detail Drawer",
        descriptionMd:
          "Sinh tên nhánh chuẩn kiểu `feat/eng-17-copy-git-branch` có xử lý dấu tiếng Việt.",
        priority: "low",
        storyPoints: 2,
        dueDate: toIsoDate(7, now),
        labels: ["frontend"],
      },

      // BACKLOG / Planned Sprint 15 (1 issue, 8 pts)
      {
        identifier: "ENG-18",
        type: "story",
        parentId: epicBoard.id,
        sprintId: sprint15.id,
        stateId: backlogState.id,
        assigneeId: null,
        title: "Tích hợp Semantic Search với pgvector trên Neon PostgreSQL",
        descriptionMd:
          "Tạo embedding cho toàn bộ Issues và Comments để tìm kiếm ngữ nghĩa xuyên suốt dự án.",
        priority: "medium",
        storyPoints: 8,
        dueDate: toIsoDate(18, now),
        labels: ["ai-copilot", "backend"],
      },
    ];

    // Generate per-column LexoRank positions
    const columnCounters = new Map<string, number>();
    const perStateTotals = new Map<string, number>();
    for (const spec of issueSpecs) {
      perStateTotals.set(spec.stateId, (perStateTotals.get(spec.stateId) ?? 0) + 1);
    }
    const perStateRanks = new Map<string, string[]>();
    for (const [stateId, count] of perStateTotals.entries()) {
      perStateRanks.set(stateId, generateInitialRanks(count));
    }

    const issueIdByIdentifier = new Map<string, string>();

    for (const spec of issueSpecs) {
      const idx = columnCounters.get(spec.stateId) ?? 0;
      columnCounters.set(spec.stateId, idx + 1);
      const position = perStateRanks.get(spec.stateId)![idx]!;

      const createdAt = hoursAgo(144, now); // Start of Sprint 14 (6 days ago)
      const updatedAt = spec.updatedHoursAgo
        ? hoursAgo(spec.updatedHoursAgo, now)
        : hoursAgo(18, now);
      const completedAt = spec.completedHoursAgo
        ? hoursAgo(spec.completedHoursAgo, now)
        : null;

      const [inserted] = await tx
        .insert(issues)
        .values({
          projectId: project.id,
          identifier: spec.identifier,
          type: spec.type,
          parentId: spec.parentId,
          sprintId: spec.sprintId,
          stateId: spec.stateId,
          assigneeId: spec.assigneeId,
          reporterId: input.userId,
          title: spec.title,
          descriptionMd: spec.descriptionMd,
          priority: spec.priority,
          storyPoints: spec.storyPoints,
          position,
          dueDate: spec.dueDate,
          completedAt,
          createdAt,
          updatedAt,
        })
        .returning();

      if (!inserted) continue;
      issueIdByIdentifier.set(spec.identifier, inserted.id);

      // Attach labels
      const labelRows = spec.labels
        .map((name) => labelByName.get(name))
        .filter((id): id is string => Boolean(id))
        .map((labelId) => ({ issueId: inserted.id, labelId }));
      if (labelRows.length > 0) {
        await tx.insert(issueLabels).values(labelRows);
      }

      // Attach simulated GitHub PR link
      if (spec.pr) {
        await tx.insert(externalLinks).values({
          issueId: inserted.id,
          provider: "github",
          externalType: "pr",
          externalId: spec.pr.number,
          title: spec.pr.title,
          status: spec.pr.status,
          url: `https://github.com/acme-corp/core-platform/pull/${spec.pr.number}`,
          metadata: { repo: "acme-corp/core-platform", checks: "passing" },
        });
      }

      // Historical activity logs for Burndown & Audit Trail
      await tx.insert(activityLogs).values({
        workspaceId: workspace.id,
        projectId: project.id,
        issueId: inserted.id,
        actorId: spec.assigneeId ?? input.userId,
        action: "issue_created",
        payload: {
          identifier: spec.identifier,
          storyPoints: spec.storyPoints,
          sprintId: spec.sprintId,
        },
        createdAt,
      });

      if (completedAt) {
        await tx.insert(activityLogs).values({
          workspaceId: workspace.id,
          projectId: project.id,
          issueId: inserted.id,
          actorId: spec.assigneeId ?? input.userId,
          action: "state_changed",
          payload: {
            fromCategory: "started",
            toCategory: "completed",
            toStateName: "Done",
            storyPoints: spec.storyPoints,
          },
          createdAt: completedAt,
        });
      }
    }

    // 10. Issue Relations (dependencies)
    const eng12 = issueIdByIdentifier.get("ENG-12");
    const eng13 = issueIdByIdentifier.get("ENG-13");
    const eng9 = issueIdByIdentifier.get("ENG-9");
    const eng10 = issueIdByIdentifier.get("ENG-10");
    const eng14 = issueIdByIdentifier.get("ENG-14");

    const relationValues = [
      eng13 && eng9
        ? { sourceIssueId: eng13, targetIssueId: eng9, type: "blocks" as const }
        : null,
      eng10 && eng14
        ? { sourceIssueId: eng10, targetIssueId: eng14, type: "relates_to" as const }
        : null,
      eng12 && eng13
        ? { sourceIssueId: eng12, targetIssueId: eng13, type: "relates_to" as const }
        : null,
    ].filter((r): r is NonNullable<typeof r> => r !== null);

    if (relationValues.length > 0) {
      await tx.insert(issueRelations).values(relationValues);
    }

    // 11. Seed realistic engineering comments
    if (eng12 && eng13) {
      await tx.insert(comments).values([
        {
          issueId: eng12,
          authorId: DEMO_TEAMMATES[0].id,
          bodyMd:
            "Mình đã chuẩn bị xong biểu đồ Burndown phía frontend. Khi API Risk Radar trả thêm danh sách `stalledIssueIdentifiers`, UI sẽ highlight đỏ trực tiếp trên Kanban!",
          createdAt: hoursAgo(14, now),
        },
        {
          issueId: eng13,
          authorId: DEMO_TEAMMATES[1].id,
          bodyMd:
            "Đang tái hiện lỗi race condition khi GitHub gửi đồng thời sự kiện `synchronize` và `opened`. Cần thêm `onConflictDoUpdate` theo `uq_external_links_issue_ref`.",
          createdAt: hoursAgo(118, now),
        },
      ]);
    }

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        isSandbox: workspace.isSandbox,
      },
      project: {
        id: project.id,
        key: project.key,
        name: project.name,
      },
      activeSprint: {
        id: sprint14.id,
        name: sprint14.name,
      },
      issueCount: issueSpecs.length + 3, // 15 issues + 3 epics
    };
  });
}

/**
 * Deletes expired sandbox workspaces (and cascades all child projects/issues/logs).
 */
export async function cleanupExpiredSandboxes(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<number> {
  const deleted = await db
    .delete(workspaces)
    .where(
      and(
        eq(workspaces.isSandbox, true),
        lt(workspaces.sandboxExpiresAt, now),
      ),
    )
    .returning({ id: workspaces.id });

  return deleted.length;
}
