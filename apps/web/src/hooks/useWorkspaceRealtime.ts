import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeEvent } from "@taskmanager/shared";
import { getEventsUrl } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import { useUiStore } from "../stores/uiStore";

const LIVE_EVENT_TYPES = [
  "issue.created",
  "issue.updated",
  "issue.moved",
  "issue.deleted",
  "sprint.updated",
  "comment.created",
  "github.pr_synced",
] as const;

interface UseWorkspaceRealtimeOptions {
  workspaceId: string | null;
  projectId: string | null;
  currentUserId: string | null;
}

function formatRealtimeToast(event: RealtimeEvent): string {
  const identifier =
    typeof event.payload.identifier === "string"
      ? event.payload.identifier
      : "Issue";

  switch (event.type) {
    case "issue.created":
      return `Đồng bộ realtime: ${identifier} vừa được tạo`;
    case "issue.moved":
      return `Đồng bộ realtime: ${identifier} vừa đổi trạng thái`;
    case "issue.deleted":
      return `Đồng bộ realtime: ${identifier} vừa bị xóa`;
    case "comment.created":
      return `Đồng bộ realtime: Có bình luận mới trên ${identifier}`;
    case "sprint.updated":
      return "Đồng bộ realtime: Sprint vừa được cập nhật";
    case "github.pr_synced":
      return `Đồng bộ realtime: GitHub PR đã đồng bộ cho ${identifier}`;
    default:
      return `Đồng bộ realtime: ${identifier} vừa được cập nhật`;
  }
}

/**
 * Subscribes to workspace-scoped Server-Sent Events (SSE), keeps TanStack Query
 * caches fresh across open tabs, and automatically reconnects with exponential backoff.
 */
export function useWorkspaceRealtime({
  workspaceId,
  projectId,
  currentUserId,
}: UseWorkspaceRealtimeOptions) {
  const qc = useQueryClient();
  const setRealtimeStatus = useUiStore((s) => s.setRealtimeStatus);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    if (!workspaceId || typeof EventSource === "undefined") {
      setRealtimeStatus("idle");
      return;
    }

    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: number | null = null;
    let retryAttempt = 0;

    const handleRealtimeEvent = (raw: MessageEvent<string>) => {
      if (disposed) return;
      try {
        const event = JSON.parse(raw.data) as RealtimeEvent;

        if (
          projectId &&
          (!event.projectId || event.projectId === projectId)
        ) {
          void qc.invalidateQueries({ queryKey: queryKeys.issues(projectId) });
          void qc.invalidateQueries({ queryKey: queryKeys.sprints(projectId) });
          void qc.invalidateQueries({ queryKey: ["analytics", projectId] });
        }

        const issueId =
          typeof event.payload.issueId === "string"
            ? event.payload.issueId
            : null;
        const targetIssueId =
          typeof event.payload.targetIssueId === "string"
            ? event.payload.targetIssueId
            : null;

        if (issueId) {
          void qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) });
        }
        if (targetIssueId) {
          void qc.invalidateQueries({
            queryKey: queryKeys.issue(targetIssueId),
          });
        }

        if (
          event.actorId &&
          currentUserId &&
          event.actorId !== currentUserId
        ) {
          pushToast(formatRealtimeToast(event), "info");
        }
      } catch {
        // Ignore malformed SSE frames
      }
    };

    const connect = () => {
      if (disposed) return;
      setRealtimeStatus(retryAttempt === 0 ? "connecting" : "reconnecting");

      const es = new EventSource(getEventsUrl(workspaceId), {
        withCredentials: true,
      });
      source = es;

      es.addEventListener("connected", () => {
        if (disposed) return;
        retryAttempt = 0;
        setRealtimeStatus("connected");
      });

      for (const eventName of LIVE_EVENT_TYPES) {
        es.addEventListener(eventName, handleRealtimeEvent as EventListener);
      }

      es.onerror = () => {
        if (disposed) return;
        es.close();
        if (source === es) source = null;
        setRealtimeStatus("reconnecting");

        const delayMs = Math.min(1000 * 2 ** retryAttempt, 15_000);
        retryAttempt += 1;
        retryTimer = window.setTimeout(connect, delayMs);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      if (source) {
        source.close();
        source = null;
      }
      setRealtimeStatus("idle");
    };
  }, [workspaceId, projectId, currentUserId, qc, setRealtimeStatus, pushToast]);
}
