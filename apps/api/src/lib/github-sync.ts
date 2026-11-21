import {
  activityLogs,
  and,
  type AppDatabase,
  asc,
  eq,
  externalLinks,
  inArray,
  issues,
  workflowStates,
} from "@taskmanager/db";
import {
  extractIssueKeys,
  type ExternalLinkStatus,
} from "@taskmanager/shared";
import type { RealtimeEventBus } from "../realtime/event-bus.js";

export interface PullRequestSyncInput {
  projectId: string;
  workspaceId: string;
  repoFullName: string;
  prNumber: string;
  prTitle: string;
  prBody: string;
  branchName: string;
  prUrl: string;
  status: ExternalLinkStatus;
  merged: boolean;
  actorId: string | null;
}

export interface PullRequestSyncResult {
  matchedIdentifiers: string[];
  updatedIssues: Array<{
    id: string;
    identifier: string;
    previousStateName: string | null;
    nextStateName: string | null;
    transitioned: boolean;
  }>;
}

/**
 * Idempotently links a GitHub Pull Request to matching Project Issues (`ENG-42`,
 * `Closes ENG-42`), auto-transitions workflow states (`In Review` / `Done`),
 * records immutable `activity_logs`, and broadcasts `github.pr_synced` via SSE.
 */
export async function processPullRequestEvent(
  db: AppDatabase,
  eventBus: RealtimeEventBus,
  input: PullRequestSyncInput,
): Promise<PullRequestSyncResult> {
  const combinedText = `${input.branchName} ${input.prTitle} ${input.prBody}`;
  const refs = extractIssueKeys(combinedText);

  if (refs.length === 0) {
    return { matchedIdentifiers: [], updatedIssues: [] };
  }

  const keys = refs.map((r) => r.key);
  const autoCloseSet = new Set(
    refs.filter((r) => r.autoClose).map((r) => r.key),
  );

  const [matchedIssues, states] = await Promise.all([
    db
      .select()
      .from(issues)
      .where(
        and(eq(issues.projectId, input.projectId), inArray(issues.identifier, keys)),
      ),
    db
      .select()
      .from(workflowStates)
      .where(eq(workflowStates.projectId, input.projectId))
      .orderBy(asc(workflowStates.position)),
  ]);

  if (matchedIssues.length === 0) {
    return { matchedIdentifiers: [], updatedIssues: [] };
  }

  const stateById = new Map(states.map((s) => [s.id, s]));
  const reviewState =
    states.find(
      (s) =>
        s.category === "started" && /review|qa|test/i.test(s.name),
    ) ?? states.find((s) => s.category === "started");
  const completedState = states.find((s) => s.category === "completed");

  const updatedIssues: PullRequestSyncResult["updatedIssues"] = [];

  for (const issue of matchedIssues) {
    const currentState = stateById.get(issue.stateId) ?? null;
    let targetState = currentState;

    if (input.merged && completedState) {
      if (autoCloseSet.has(issue.identifier) || input.status === "merged") {
        targetState = completedState;
      }
    } else if (
      (input.status === "open" || input.status === "draft") &&
      reviewState &&
      currentState?.category !== "completed"
    ) {
      targetState =
        input.status === "open"
          ? reviewState
          : (states.find((s) => s.category === "started") ?? reviewState);
    }

    const transitioned = Boolean(
      targetState && targetState.id !== issue.stateId,
    );
    const now = new Date();

    await db.transaction(async (tx) => {
      // Idempotent upsert avoids race conditions when webhooks arrive simultaneously
      await tx
        .insert(externalLinks)
        .values({
          issueId: issue.id,
          provider: "github",
          externalType: "pr",
          externalId: input.prNumber,
          title: input.prTitle.slice(0, 240),
          status: input.status,
          url: input.prUrl,
          metadata: {
            repo: input.repoFullName,
            branch: input.branchName,
            merged: input.merged,
          },
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            externalLinks.issueId,
            externalLinks.provider,
            externalLinks.externalType,
            externalLinks.externalId,
          ],
          set: {
            title: input.prTitle.slice(0, 240),
            status: input.status,
            url: input.prUrl,
            metadata: {
              repo: input.repoFullName,
              branch: input.branchName,
              merged: input.merged,
            },
            updatedAt: now,
          },
        });

      await tx.insert(activityLogs).values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        issueId: issue.id,
        actorId: input.actorId,
        action: input.merged ? "pr_merged" : "pr_linked",
        payload: {
          prNumber: input.prNumber,
          prTitle: input.prTitle,
          status: input.status,
          url: input.prUrl,
        },
      });

      if (transitioned && targetState) {
        await tx
          .update(issues)
          .set({
            stateId: targetState.id,
            completedAt:
              targetState.category === "completed"
                ? (issue.completedAt ?? now)
                : null,
            updatedAt: now,
          })
          .where(eq(issues.id, issue.id));

        await tx.insert(activityLogs).values({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          issueId: issue.id,
          actorId: input.actorId,
          action: "state_changed",
          payload: {
            fromStateId: issue.stateId,
            fromCategory: currentState?.category ?? null,
            toStateId: targetState.id,
            toCategory: targetState.category,
            toStateName: targetState.name,
            storyPoints: issue.storyPoints,
            source: "github_webhook",
          },
        });
      }
    });

    updatedIssues.push({
      id: issue.id,
      identifier: issue.identifier,
      previousStateName: currentState?.name ?? null,
      nextStateName: targetState?.name ?? null,
      transitioned,
    });

    eventBus.publish({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      type: "github.pr_synced",
      actorId: input.actorId,
      timestamp: Date.now(),
      payload: {
        issueId: issue.id,
        identifier: issue.identifier,
        prNumber: input.prNumber,
        status: input.status,
        transitioned,
        nextStateName: targetState?.name ?? null,
      },
    });
  }

  return {
    matchedIdentifiers: updatedIssues.map((u) => u.identifier),
    updatedIssues,
  };
}
