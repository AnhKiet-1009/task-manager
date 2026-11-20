import type {
  IssuePriority,
  IssueType,
  SprintStatus,
  WorkflowStateCategory,
  WorkspaceRole,
} from "@taskmanager/shared";
import type { IssueListItem } from "./api";

export const ISSUE_TYPE_META: Record<
  IssueType,
  { label: string; colorClass: string; badgeClass: string }
> = {
  epic: {
    label: "Epic",
    colorClass: "text-purple-600 dark:text-purple-400",
    badgeClass:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300",
  },
  story: {
    label: "Story",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
  task: {
    label: "Task",
    colorClass: "text-blue-600 dark:text-blue-400",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  },
  bug: {
    label: "Bug",
    colorClass: "text-rose-600 dark:text-rose-400",
    badgeClass:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  },
  subtask: {
    label: "Subtask",
    colorClass: "text-slate-600 dark:text-slate-400",
    badgeClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

export const ISSUE_PRIORITY_META: Record<
  IssuePriority,
  { label: string; badgeClass: string; dotClass: string }
> = {
  urgent: {
    label: "Khẩn cấp",
    badgeClass:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
    dotClass: "bg-rose-500",
  },
  high: {
    label: "Cao",
    badgeClass:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800",
    dotClass: "bg-orange-500",
  },
  medium: {
    label: "Trung bình",
    badgeClass:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
    dotClass: "bg-amber-500",
  },
  low: {
    label: "Thấp",
    badgeClass:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
  },
  none: {
    label: "Không",
    badgeClass:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
};

export const STATE_CATEGORY_LABEL: Record<WorkflowStateCategory, string> = {
  backlog: "Backlog",
  unstarted: "Chưa bắt đầu",
  started: "Đang thực hiện",
  completed: "Hoàn thành",
  canceled: "Đã hủy",
};

export const SPRINT_STATUS_META: Record<
  SprintStatus,
  { label: string; badgeClass: string }
> = {
  active: {
    label: "Đang chạy",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
  },
  planned: {
    label: "Kế hoạch",
    badgeClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  completed: {
    label: "Đã hoàn thành",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
};

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
}

export function formatShortDateVN(isoDate?: string | null): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}`;
}

export function isIssueOverdue(issue: IssueListItem): boolean {
  if (!issue.dueDate || issue.state?.category === "completed") return false;
  const today = new Date().toISOString().slice(0, 10);
  return issue.dueDate < today;
}

export interface IssueFilterValues {
  search: string;
  priority: "all" | IssuePriority;
  type: "all" | IssueType;
  assigneeId: "all" | "unassigned" | string;
}

export function filterIssues(
  issues: IssueListItem[],
  filters: IssueFilterValues,
): IssueListItem[] {
  const q = filters.search.trim().toLowerCase();

  return issues.filter((issue) => {
    if (filters.priority !== "all" && issue.priority !== filters.priority) {
      return false;
    }
    if (filters.type !== "all" && issue.type !== filters.type) {
      return false;
    }
    if (filters.assigneeId === "unassigned" && issue.assigneeId !== null) {
      return false;
    }
    if (
      filters.assigneeId !== "all" &&
      filters.assigneeId !== "unassigned" &&
      issue.assigneeId !== filters.assigneeId
    ) {
      return false;
    }
    if (q) {
      const matchId = issue.identifier.toLowerCase().includes(q);
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchDesc = issue.descriptionMd?.toLowerCase().includes(q) ?? false;
      if (!matchId && !matchTitle && !matchDesc) return false;
    }
    return true;
  });
}

export function sortByLexoRank<T extends { position: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
  );
}
