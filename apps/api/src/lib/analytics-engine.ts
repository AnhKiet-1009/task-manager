import {
  activityLogs,
  and,
  type AppDatabase,
  asc,
  eq,
  inArray,
  issues,
  sprints,
  users,
  workflowStates,
} from "@taskmanager/db";

export interface BurndownPoint {
  date: string;
  label: string;
  idealPoints: number;
  remainingPoints: number | null;
  completedPoints: number | null;
}

export interface VelocityItem {
  sprintId: string;
  name: string;
  status: "planned" | "active" | "completed";
  plannedPoints: number;
  completedPoints: number;
  totalIssues: number;
  completedIssues: number;
}

export interface WorkloadItem {
  assigneeId: string | null;
  assigneeName: string;
  totalIssues: number;
  inProgressIssues: number;
  totalPoints: number;
  completedPoints: number;
  overdueCount: number;
}

export interface StalledIssueItem {
  id: string;
  identifier: string;
  title: string;
  stateName: string;
  assigneeName: string | null;
  storyPoints: number | null;
  hoursStalled: number;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface WipBreachItem {
  stateId: string;
  stateName: string;
  wipLimit: number;
  currentCount: number;
}

export interface ProjectAnalyticsData {
  projectId: string;
  selectedSprint: {
    id: string;
    name: string;
    goal: string | null;
    status: "planned" | "active" | "completed";
    startDate: string | null;
    endDate: string | null;
    daysTotal: number;
    daysElapsed: number;
    daysRemaining: number;
  } | null;
  summary: {
    totalIssues: number;
    completedIssues: number;
    totalPoints: number;
    completedPoints: number;
    remainingPoints: number;
    completionPercent: number;
    averageVelocity: number;
    stalledCount: number;
    overdueCount: number;
    unassignedHighPriorityCount: number;
    wipBreachCount: number;
  };
  burndown: BurndownPoint[];
  velocity: VelocityItem[];
  workload: WorkloadItem[];
  stalledIssues: StalledIssueItem[];
  wipBreaches: WipBreachItem[];
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayMonth(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return m && d ? `${d}/${m}` : isoDate;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

function diffDaysInclusive(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Computes full Agile telemetry (Burndown from activity_logs/completedAt,
 * Velocity history, Workload balance, Stalled issues > 72h, WIP breaches).
 */
export async function computeProjectAnalytics(
  db: AppDatabase,
  projectId: string,
  requestedSprintId?: string | null,
  now: Date = new Date(),
): Promise<ProjectAnalyticsData> {
  const [projectSprints, states, projectIssues, logs] = await Promise.all([
    db
      .select()
      .from(sprints)
      .where(eq(sprints.projectId, projectId))
      .orderBy(asc(sprints.createdAt)),
    db
      .select()
      .from(workflowStates)
      .where(eq(workflowStates.projectId, projectId))
      .orderBy(asc(workflowStates.position)),
    db
      .select()
      .from(issues)
      .where(eq(issues.projectId, projectId)),
    db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.projectId, projectId),
          eq(activityLogs.action, "state_changed"),
        ),
      )
      .orderBy(asc(activityLogs.createdAt)),
  ]);

  const stateById = new Map(states.map((s) => [s.id, s]));
  const nonEpicIssues = projectIssues.filter((i) => i.type !== "epic");

  // Resolve assignee names
  const assigneeIds = Array.from(
    new Set(
      nonEpicIssues
        .map((i) => i.assigneeId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const userRows =
    assigneeIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, assigneeIds))
      : [];
  const userNameById = new Map(userRows.map((u) => [u.id, u.name]));

  // Select target sprint (requested -> active -> latest)
  const targetSprint =
    (requestedSprintId
      ? projectSprints.find((s) => s.id === requestedSprintId)
      : undefined) ??
    projectSprints.find((s) => s.status === "active") ??
    projectSprints[projectSprints.length - 1] ??
    null;

  // 1. Velocity history across all sprints
  const velocity: VelocityItem[] = projectSprints.map((sprint) => {
    const items = nonEpicIssues.filter((i) => i.sprintId === sprint.id);
    let plannedPoints = 0;
    let completedPoints = 0;
    let completedIssues = 0;

    for (const item of items) {
      const pts = item.storyPoints ?? 0;
      plannedPoints += pts;
      if (stateById.get(item.stateId)?.category === "completed") {
        completedPoints += pts;
        completedIssues += 1;
      }
    }

    if (sprint.status === "completed" && sprint.velocitySnapshot !== null) {
      completedPoints = sprint.velocitySnapshot;
      if (plannedPoints < completedPoints) {
        plannedPoints = completedPoints;
      }
    }

    return {
      sprintId: sprint.id,
      name: sprint.name,
      status: sprint.status,
      plannedPoints,
      completedPoints,
      totalIssues: items.length,
      completedIssues,
    };
  });

  const completedVelocities = velocity
    .filter((v) => v.status === "completed" && v.completedPoints > 0)
    .map((v) => v.completedPoints);
  const averageVelocity =
    completedVelocities.length > 0
      ? Math.round(
          completedVelocities.reduce((a, b) => a + b, 0) /
            completedVelocities.length,
        )
      : velocity.find((v) => v.status === "active")?.completedPoints ?? 0;

  // Scope issues for selected sprint (or all issues if project has no sprints yet)
  const scopedIssues = targetSprint
    ? nonEpicIssues.filter((i) => i.sprintId === targetSprint.id)
    : nonEpicIssues;

  const todayIso = toIsoDate(now);
  let totalPoints = 0;
  let completedPoints = 0;
  let completedIssues = 0;
  let overdueCount = 0;
  let unassignedHighPriorityCount = 0;

  const stalledIssues: StalledIssueItem[] = [];
  const workloadMap = new Map<string, WorkloadItem>();
  const countByState = new Map<string, number>();

  for (const issue of scopedIssues) {
    const state = stateById.get(issue.stateId);
    const pts = issue.storyPoints ?? 0;
    const isCompleted = state?.category === "completed";
    const isStarted = state?.category === "started";
    const isOverdue = Boolean(
      issue.dueDate && issue.dueDate < todayIso && !isCompleted,
    );

    totalPoints += pts;
    countByState.set(issue.stateId, (countByState.get(issue.stateId) ?? 0) + 1);

    if (isCompleted) {
      completedPoints += pts;
      completedIssues += 1;
    }
    if (isOverdue) {
      overdueCount += 1;
    }
    if (
      !isCompleted &&
      !issue.assigneeId &&
      (issue.priority === "urgent" || issue.priority === "high")
    ) {
      unassignedHighPriorityCount += 1;
    }

    // Detect issues stalled > 72h in `started` category
    if (isStarted) {
      const hoursStalled = Math.round(
        (now.getTime() - new Date(issue.updatedAt).getTime()) / (1000 * 60 * 60),
      );
      if (hoursStalled >= 72) {
        stalledIssues.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          stateName: state?.name ?? "In Progress",
          assigneeName: issue.assigneeId
            ? (userNameById.get(issue.assigneeId) ?? null)
            : null,
          storyPoints: issue.storyPoints,
          hoursStalled,
          dueDate: issue.dueDate,
          isOverdue,
        });
      }
    }

    // Workload aggregation
    const wKey = issue.assigneeId ?? "__unassigned__";
    const existing = workloadMap.get(wKey) ?? {
      assigneeId: issue.assigneeId,
      assigneeName: issue.assigneeId
        ? (userNameById.get(issue.assigneeId) ?? "Thành viên")
        : "Chưa gán",
      totalIssues: 0,
      inProgressIssues: 0,
      totalPoints: 0,
      completedPoints: 0,
      overdueCount: 0,
    };
    existing.totalIssues += 1;
    if (isStarted) existing.inProgressIssues += 1;
    existing.totalPoints += pts;
    if (isCompleted) existing.completedPoints += pts;
    if (isOverdue) existing.overdueCount += 1;
    workloadMap.set(wKey, existing);
  }

  stalledIssues.sort((a, b) => b.hoursStalled - a.hoursStalled);

  const wipBreaches: WipBreachItem[] = states
    .filter((s) => s.wipLimit !== null && (countByState.get(s.id) ?? 0) > s.wipLimit)
    .map((s) => ({
      stateId: s.id,
      stateName: s.name,
      wipLimit: s.wipLimit!,
      currentCount: countByState.get(s.id) ?? 0,
    }));

  // 2. Daily Burndown Series for targetSprint
  const burndown: BurndownPoint[] = [];
  let selectedSprintSummary: ProjectAnalyticsData["selectedSprint"] = null;

  if (targetSprint) {
    const startIso = targetSprint.startDate ?? addDays(todayIso, -6);
    const endIso = targetSprint.endDate ?? addDays(startIso, 13);
    const rawDays = diffDaysInclusive(startIso, endIso);
    const daysTotal = Math.min(rawDays, 30);

    // Map each completed issue to the date it entered `completed`
    const completionDateByIssueId = new Map<string, string>();
    for (const log of logs) {
      if (!log.issueId) continue;
      const toCategory = log.payload.toCategory;
      if (toCategory === "completed") {
        completionDateByIssueId.set(log.issueId, toIsoDate(new Date(log.createdAt)));
      } else if (toCategory && toCategory !== "completed") {
        completionDateByIssueId.delete(log.issueId);
      }
    }

    for (const issue of scopedIssues) {
      if (stateById.get(issue.stateId)?.category === "completed") {
        if (!completionDateByIssueId.has(issue.id)) {
          const fallbackDate = issue.completedAt
            ? toIsoDate(new Date(issue.completedAt))
            : todayIso;
          completionDateByIssueId.set(issue.id, fallbackDate);
        }
      }
    }

    for (let dayIdx = 0; dayIdx < daysTotal; dayIdx++) {
      const dateIso = addDays(startIso, dayIdx);
      const idealRatio =
        daysTotal <= 1 ? 0 : 1 - dayIdx / (daysTotal - 1);
      const idealPoints = Math.round(totalPoints * idealRatio * 10) / 10;

      const isFuture =
        targetSprint.status === "active" && dateIso > todayIso;

      if (isFuture) {
        burndown.push({
          date: dateIso,
          label: formatDayMonth(dateIso),
          idealPoints,
          remainingPoints: null,
          completedPoints: null,
        });
      } else {
        let doneByDay = 0;
        for (const issue of scopedIssues) {
          const doneDate = completionDateByIssueId.get(issue.id);
          if (doneDate && doneDate <= dateIso) {
            doneByDay += issue.storyPoints ?? 0;
          }
        }
        burndown.push({
          date: dateIso,
          label: formatDayMonth(dateIso),
          idealPoints,
          remainingPoints: Math.max(0, totalPoints - doneByDay),
          completedPoints: doneByDay,
        });
      }
    }

    const daysElapsed =
      todayIso < startIso
        ? 0
        : todayIso >= endIso
          ? daysTotal
          : diffDaysInclusive(startIso, todayIso);
    const daysRemaining = Math.max(0, daysTotal - daysElapsed);

    selectedSprintSummary = {
      id: targetSprint.id,
      name: targetSprint.name,
      goal: targetSprint.goal,
      status: targetSprint.status,
      startDate: startIso,
      endDate: endIso,
      daysTotal,
      daysElapsed,
      daysRemaining,
    };
  }

  const remainingPoints = Math.max(0, totalPoints - completedPoints);
  const completionPercent =
    totalPoints > 0
      ? Math.round((completedPoints / totalPoints) * 100)
      : scopedIssues.length > 0
        ? Math.round((completedIssues / scopedIssues.length) * 100)
        : 0;

  return {
    projectId,
    selectedSprint: selectedSprintSummary,
    summary: {
      totalIssues: scopedIssues.length,
      completedIssues,
      totalPoints,
      completedPoints,
      remainingPoints,
      completionPercent,
      averageVelocity,
      stalledCount: stalledIssues.length,
      overdueCount,
      unassignedHighPriorityCount,
      wipBreachCount: wipBreaches.length,
    },
    burndown,
    velocity,
    workload: Array.from(workloadMap.values()).sort(
      (a, b) => b.totalPoints - a.totalPoints,
    ),
    stalledIssues,
    wipBreaches,
  };
}
