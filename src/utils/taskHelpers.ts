import { PRIORITY_CONFIG } from "../constants/task";
import type {
  DueDateState,
  Task,
  TaskCategory,
  TaskFilterState,
  TaskPriority,
  TaskStatsData,
  TaskStatus,
} from "../types/task";

const VALID_PRIORITIES = new Set<TaskPriority>(["low", "medium", "high"]);
const VALID_STATUSES = new Set<TaskStatus>(["todo", "in_progress", "done"]);
const VALID_CATEGORIES = new Set<TaskCategory>([
  "work",
  "personal",
  "study",
  "other",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safely parses and normalizes raw tasks from localStorage or imported JSON.
 * Also migrates legacy Week 1 tasks that used `isCompleted: boolean`.
 */
export function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];

  const normalized: Task[] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (typeof item.title !== "string" || !item.title.trim()) continue;

    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id
        : crypto.randomUUID();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const priority: TaskPriority =
      typeof item.priority === "string" &&
      VALID_PRIORITIES.has(item.priority as TaskPriority)
        ? (item.priority as TaskPriority)
        : "medium";

    let status: TaskStatus = "todo";
    if (
      typeof item.status === "string" &&
      VALID_STATUSES.has(item.status as TaskStatus)
    ) {
      status = item.status as TaskStatus;
    } else if (typeof item.isCompleted === "boolean") {
      status = item.isCompleted ? "done" : "todo";
    }

    const category: TaskCategory =
      typeof item.category === "string" &&
      VALID_CATEGORIES.has(item.category as TaskCategory)
        ? (item.category as TaskCategory)
        : "work";

    const description =
      typeof item.description === "string" && item.description.trim()
        ? item.description.trim()
        : undefined;

    const dueDate =
      typeof item.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
        ? item.dueDate
        : undefined;

    const createdAt =
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now();

    const updatedAt =
      typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
        ? item.updatedAt
        : createdAt;

    normalized.push({
      id,
      title: item.title.trim(),
      description,
      priority,
      status,
      category,
      dueDate,
      createdAt,
      updatedAt,
    });
  }

  return normalized;
}

export function getLocalTodayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDueDateState(
  dueDate?: string,
  status?: TaskStatus,
  now: Date = new Date(),
): DueDateState {
  if (!dueDate) return null;
  if (status === "done") return "normal";

  const todayISO = getLocalTodayISO(now);
  if (dueDate < todayISO) return "overdue";
  if (dueDate === todayISO) return "today";

  const todayDate = new Date(`${todayISO}T00:00:00`);
  const targetDate = new Date(`${dueDate}T00:00:00`);
  const diffDays = Math.round(
    (targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 2) return "soon";
  return "normal";
}

export function formatDueDateVN(dueDate: string): string {
  const [year, month, day] = dueDate.split("-");
  if (!year || !month || !day) return dueDate;
  return `${day}/${month}/${year}`;
}

export function filterAndSortTasks(
  tasks: Task[],
  filter: TaskFilterState,
): Task[] {
  const query = filter.searchQuery.trim().toLowerCase();

  const filtered = tasks.filter((task) => {
    const matchStatus =
      filter.status === "all" || task.status === filter.status;
    const matchPriority =
      filter.priority === "all" || task.priority === filter.priority;
    const matchCategory =
      filter.category === "all" || task.category === filter.category;

    const matchSearch =
      query === "" ||
      task.title.toLowerCase().includes(query) ||
      (task.description?.toLowerCase().includes(query) ?? false);

    return matchStatus && matchPriority && matchCategory && matchSearch;
  });

  if (filter.sortBy === "newest") {
    return filtered;
  }

  return [...filtered].sort((a, b) => {
    switch (filter.sortBy) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "priority": {
        const diff =
          PRIORITY_CONFIG[b.priority].weight -
          PRIORITY_CONFIG[a.priority].weight;
        return diff !== 0 ? diff : b.createdAt - a.createdAt;
      }
      case "dueDate": {
        if (a.dueDate && b.dueDate) {
          const cmp = a.dueDate.localeCompare(b.dueDate);
          return cmp !== 0 ? cmp : b.createdAt - a.createdAt;
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt - a.createdAt;
      }
      default:
        return 0;
    }
  });
}

export function getTaskStats(
  tasks: Task[],
  now: Date = new Date(),
): TaskStatsData {
  let todo = 0;
  let inProgress = 0;
  let done = 0;
  let overdue = 0;

  for (const task of tasks) {
    if (task.status === "todo") todo += 1;
    else if (task.status === "in_progress") inProgress += 1;
    else if (task.status === "done") done += 1;

    if (getDueDateState(task.dueDate, task.status, now) === "overdue") {
      overdue += 1;
    }
  }

  const total = tasks.length;
  const completionPercent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    total,
    todo,
    inProgress,
    done,
    overdue,
    completionPercent,
  };
}

export function reorderTasks(
  tasks: Task[],
  draggedId: string,
  targetId: string,
): Task[] {
  if (draggedId === targetId) return tasks;

  const fromIndex = tasks.findIndex((t) => t.id === draggedId);
  const toIndex = tasks.findIndex((t) => t.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return tasks;

  const updated = [...tasks];
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  return updated;
}

export function isFilterActive(filter: TaskFilterState): boolean {
  return (
    filter.status !== "all" ||
    filter.priority !== "all" ||
    filter.category !== "all" ||
    filter.searchQuery.trim() !== "" ||
    filter.sortBy !== "newest"
  );
}
