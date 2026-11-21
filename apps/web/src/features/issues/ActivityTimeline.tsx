import type { IssuePriority } from "@taskmanager/shared";
import {
  ArrowRightLeft,
  Flame,
  GitMerge,
  GitPullRequest,
  History,
  Layers,
  MessageSquare,
  PlusCircle,
  Sparkles,
  UserCheck,
} from "lucide-react";
import {
  formatRelativeTimeVN,
  getInitials,
  ISSUE_PRIORITY_META,
} from "../../lib/agileMeta";
import type { IssueDetailDto, WorkspaceMemberDto } from "../../lib/api";

interface ActivityTimelineProps {
  logs: IssueDetailDto["activityLogs"];
  members: WorkspaceMemberDto[];
}

function getActionIcon(action: string) {
  switch (action) {
    case "issue_created":
      return PlusCircle;
    case "state_changed":
      return ArrowRightLeft;
    case "sprint_moved":
      return Layers;
    case "assignee_changed":
      return UserCheck;
    case "priority_changed":
      return Flame;
    case "points_changed":
      return Sparkles;
    case "pr_linked":
      return GitPullRequest;
    case "pr_merged":
      return GitMerge;
    case "comment_added":
      return MessageSquare;
    default:
      return History;
  }
}

function describeActivity(
  action: string,
  payload: Record<string, unknown>,
  memberNameById: Map<string, string>,
): string {
  switch (action) {
    case "issue_created":
      return `đã tạo Issue ${typeof payload.identifier === "string" ? payload.identifier : ""}`.trim();
    case "state_changed": {
      const toName =
        typeof payload.toStateName === "string"
          ? payload.toStateName
          : typeof payload.toCategory === "string"
            ? payload.toCategory
            : "trạng thái mới";
      return `đã chuyển trạng thái sang "${toName}"`;
    }
    case "sprint_moved":
      return payload.toSprintId
        ? "đã đưa Issue vào Sprint"
        : "đã chuyển Issue về Product Backlog";
    case "assignee_changed": {
      const toId =
        typeof payload.toAssigneeId === "string" ? payload.toAssigneeId : null;
      if (!toId) return "đã bỏ gán người phụ trách";
      const name = memberNameById.get(toId);
      return name
        ? `đã gán cho ${name}`
        : "đã thay đổi người phụ trách";
    }
    case "priority_changed": {
      const fromKey = payload.fromPriority as IssuePriority | undefined;
      const toKey = payload.toPriority as IssuePriority | undefined;
      const fromLabel = fromKey
        ? (ISSUE_PRIORITY_META[fromKey]?.label ?? fromKey)
        : "—";
      const toLabel = toKey
        ? (ISSUE_PRIORITY_META[toKey]?.label ?? toKey)
        : "—";
      return `đã đổi độ ưu tiên từ ${fromLabel} → ${toLabel}`;
    }
    case "points_changed": {
      const fromPts = payload.fromPoints ?? "—";
      const toPts = payload.toPoints ?? "—";
      return `đã cập nhật Story Points từ ${String(fromPts)} → ${String(toPts)}`;
    }
    case "pr_linked":
      return `đã liên kết Pull Request #${String(payload.prNumber ?? "")}`;
    case "pr_merged":
      return `đã merge Pull Request #${String(payload.prNumber ?? "")}`;
    case "comment_added":
      return "đã thêm một bình luận";
    default:
      return `đã thực hiện thao tác (${action})`;
  }
}

export function ActivityTimeline({ logs, members }: ActivityTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-400">
        Chưa có hoạt động nào được ghi nhận.
      </div>
    );
  }

  const memberNameById = new Map(members.map((m) => [m.user.id, m.user.name]));

  return (
    <ol
      aria-label="Dòng thời gian hoạt động"
      className="relative border-l border-slate-200 dark:border-slate-800 ml-3 space-y-4 py-1"
    >
      {logs.map((log) => {
        const Icon = getActionIcon(log.action);
        const actorName = log.actor?.name ?? "Hệ thống";
        const summary = describeActivity(log.action, log.payload, memberNameById);

        return (
          <li key={log.id} className="pl-5 relative text-xs">
            <span className="absolute -left-[11px] top-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Icon className="w-3 h-3" />
            </span>

            <div className="flex items-start justify-between gap-2">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100 mr-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-[9px] font-bold">
                    {getInitials(actorName)}
                  </span>
                  {actorName}
                </span>
                {summary}
              </p>
              <time
                dateTime={log.createdAt}
                title={new Date(log.createdAt).toLocaleString("vi-VN")}
                className="text-[11px] text-slate-400 shrink-0"
              >
                {formatRelativeTimeVN(log.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
