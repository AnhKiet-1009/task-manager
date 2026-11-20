import { createContext } from "react";
import type {
  Task,
  TaskFilterState,
  TaskFormData,
  TaskStatsData,
  TaskStatus,
  TaskUpdatePayload,
  ToastMessage,
  ViewMode,
} from "../types/task";

export interface TaskContextValue {
  tasks: Task[];
  filteredTasks: Task[];
  stats: TaskStatsData;
  filter: TaskFilterState;
  viewMode: ViewMode;
  toast: ToastMessage | null;
  addTask: (data: TaskFormData) => void;
  updateTask: (id: string, updates: TaskUpdatePayload) => void;
  deleteTask: (id: string) => void;
  toggleComplete: (id: string) => void;
  moveTaskStatus: (id: string, status: TaskStatus) => void;
  reorderTask: (draggedId: string, targetId: string) => void;
  clearCompleted: () => void;
  undoLastAction: () => void;
  importTasksFromJson: (rawJson: string) => boolean;
  exportTasksToJson: () => void;
  setFilter: (partial: Partial<TaskFilterState>) => void;
  resetFilter: () => void;
  setViewMode: (mode: ViewMode) => void;
  dismissToast: () => void;
}

export const TaskContext = createContext<TaskContextValue | null>(null);
