export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "all" | "pending" | "completed";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  isCompleted: boolean;
  createdAt: number;
}

export type TaskFormData = Omit<Task, "id" | "createdAt" | "isCompleted">;
export interface FormErrors {
  title?: string;
  description?: string;
}

export interface TaskFilterState {
    status: TaskStatus;
    priority: "all" | TaskPriority;
    searchQuery: string;
}
