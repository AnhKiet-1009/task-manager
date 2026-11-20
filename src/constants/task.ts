import type {
  TaskCategory,
  TaskFilterState,
  TaskPriority,
  TaskSortOption,
  TaskStatus,
} from "../types/task";

export const STORAGE_KEYS = {
  TASKS: "TASKS_APP_DATA",
  THEME: "TASKS_APP_THEME",
  VIEW_MODE: "TASKS_APP_VIEW_MODE",
} as const;

export const VALIDATION_LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 200,
} as const;

export const DEFAULT_FILTER: TaskFilterState = {
  status: "all",
  priority: "all",
  category: "all",
  searchQuery: "",
  sortBy: "newest",
};

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; weight: number; badgeClass: string }
> = {
  low: {
    label: "Thấp",
    weight: 1,
    badgeClass:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  },
  medium: {
    label: "Trung bình",
    weight: 2,
    badgeClass:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  },
  high: {
    label: "Cao",
    weight: 3,
    badgeClass:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  },
};

export const STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string;
    shortLabel: string;
    accentClass: string;
    columnBgClass: string;
    dotClass: string;
  }
> = {
  todo: {
    label: "Cần làm",
    shortLabel: "Cần làm",
    accentClass: "border-t-slate-400 dark:border-t-slate-500",
    columnBgClass: "bg-slate-50/90 dark:bg-slate-900/60",
    dotClass: "bg-slate-400",
  },
  in_progress: {
    label: "Đang làm",
    shortLabel: "Đang làm",
    accentClass: "border-t-blue-500 dark:border-t-blue-400",
    columnBgClass: "bg-blue-50/50 dark:bg-blue-950/20",
    dotClass: "bg-blue-500",
  },
  done: {
    label: "Hoàn thành",
    shortLabel: "Hoàn thành",
    accentClass: "border-t-emerald-500 dark:border-t-emerald-400",
    columnBgClass: "bg-emerald-50/50 dark:bg-emerald-950/20",
    dotClass: "bg-emerald-500",
  },
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

export const CATEGORY_CONFIG: Record<
  TaskCategory,
  { label: string; badgeClass: string }
> = {
  work: {
    label: "Công việc",
    badgeClass:
      "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  },
  personal: {
    label: "Cá nhân",
    badgeClass:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
  },
  study: {
    label: "Học tập",
    badgeClass:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  },
  other: {
    label: "Khác",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
};

export const SORT_OPTIONS: { value: TaskSortOption; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "priority", label: "Ưu tiên cao nhất" },
  { value: "dueDate", label: "Hạn chót gần nhất" },
];
