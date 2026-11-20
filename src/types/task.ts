export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskCategory = "work" | "personal" | "study" | "other";
export type TaskSortOption = "newest" | "oldest" | "priority" | "dueDate";
export type ViewMode = "list" | "board";
export type ThemeMode = "light" | "dark";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate?: string; // ISO YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

export interface TaskFormData {
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate?: string;
}

export interface TaskUpdatePayload {
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate?: string;
}

export interface FormErrors {
  title?: string;
  description?: string;
  dueDate?: string;
}

export interface TaskFilterState {
  status: "all" | TaskStatus;
  priority: "all" | TaskPriority;
  category: "all" | TaskCategory;
  searchQuery: string;
  sortBy: TaskSortOption;
}

export interface TaskStatsData {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  completionPercent: number;
}

export type DueDateState = "overdue" | "today" | "soon" | "normal" | null;

export interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  canUndo?: boolean;
}
