import { DEFAULT_FILTER } from "../constants/task";
import type {
  Task,
  TaskFilterState,
  TaskFormData,
  TaskStatus,
  TaskUpdatePayload,
  ToastMessage,
  ViewMode,
} from "../types/task";
import { reorderTasks } from "../utils/taskHelpers";

export interface TaskState {
  tasks: Task[];
  filter: TaskFilterState;
  viewMode: ViewMode;
  undoSnapshot: Task[] | null;
  toast: ToastMessage | null;
}

export type TaskAction =
  | { type: "ADD_TASK"; payload: TaskFormData }
  | { type: "UPDATE_TASK"; payload: { id: string; updates: TaskUpdatePayload } }
  | { type: "DELETE_TASK"; payload: { id: string } }
  | { type: "TOGGLE_COMPLETE"; payload: { id: string } }
  | {
      type: "MOVE_TASK_STATUS";
      payload: { id: string; status: TaskStatus };
    }
  | {
      type: "REORDER_TASKS";
      payload: { draggedId: string; targetId: string };
    }
  | { type: "CLEAR_COMPLETED" }
  | { type: "UNDO_LAST_ACTION" }
  | { type: "IMPORT_TASKS"; payload: { tasks: Task[]; mode: "replace" | "merge" } }
  | { type: "SET_FILTER"; payload: Partial<TaskFilterState> }
  | { type: "RESET_FILTER" }
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "SHOW_TOAST"; payload: Omit<ToastMessage, "id"> }
  | { type: "DISMISS_TOAST" };

export function createInitialTaskState(
  initialTasks: Task[],
  initialViewMode: ViewMode = "list",
): TaskState {
  return {
    tasks: initialTasks,
    filter: DEFAULT_FILTER,
    viewMode: initialViewMode,
    undoSnapshot: null,
    toast: null,
  };
}

function makeToast(
  message: string,
  type: ToastMessage["type"] = "info",
  canUndo = false,
): ToastMessage {
  return {
    id: crypto.randomUUID(),
    message,
    type,
    canUndo,
  };
}

export function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case "ADD_TASK": {
      const now = Date.now();
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: action.payload.title.trim(),
        description: action.payload.description?.trim() || undefined,
        priority: action.payload.priority,
        status: action.payload.status,
        category: action.payload.category,
        dueDate: action.payload.dueDate || undefined,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...state,
        tasks: [newTask, ...state.tasks],
        undoSnapshot: null,
        toast: makeToast(`Đã thêm "${newTask.title}"`, "success"),
      };
    }

    case "UPDATE_TASK": {
      const { id, updates } = action.payload;
      const now = Date.now();
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                title: updates.title.trim(),
                description: updates.description?.trim() || undefined,
                priority: updates.priority,
                status: updates.status,
                category: updates.category,
                dueDate: updates.dueDate || undefined,
                updatedAt: now,
              }
            : task,
        ),
        toast: makeToast("Đã cập nhật công việc.", "success"),
      };
    }

    case "DELETE_TASK": {
      const target = state.tasks.find((t) => t.id === action.payload.id);
      if (!target) return state;

      return {
        ...state,
        undoSnapshot: state.tasks,
        tasks: state.tasks.filter((t) => t.id !== action.payload.id),
        toast: makeToast(`Đã xóa "${target.title}"`, "warning", true),
      };
    }

    case "TOGGLE_COMPLETE": {
      const now = Date.now();
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id
            ? {
                ...task,
                status: task.status === "done" ? "todo" : "done",
                updatedAt: now,
              }
            : task,
        ),
      };
    }

    case "MOVE_TASK_STATUS": {
      const { id, status } = action.payload;
      const target = state.tasks.find((t) => t.id === id);
      if (!target || target.status === status) return state;

      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id
            ? { ...task, status, updatedAt: Date.now() }
            : task,
        ),
      };
    }

    case "REORDER_TASKS": {
      const { draggedId, targetId } = action.payload;
      const nextTasks = reorderTasks(state.tasks, draggedId, targetId);
      if (nextTasks === state.tasks) return state;
      return {
        ...state,
        tasks: nextTasks,
      };
    }

    case "CLEAR_COMPLETED": {
      const completedCount = state.tasks.filter(
        (t) => t.status === "done",
      ).length;
      if (completedCount === 0) return state;

      return {
        ...state,
        undoSnapshot: state.tasks,
        tasks: state.tasks.filter((t) => t.status !== "done"),
        toast: makeToast(
          `Đã xóa ${completedCount} công việc đã hoàn thành.`,
          "warning",
          true,
        ),
      };
    }

    case "UNDO_LAST_ACTION": {
      if (!state.undoSnapshot) return state;
      return {
        ...state,
        tasks: state.undoSnapshot,
        undoSnapshot: null,
        toast: makeToast("Đã hoàn tác thao tác trước đó.", "info"),
      };
    }

    case "IMPORT_TASKS": {
      const { tasks: imported, mode } = action.payload;
      if (imported.length === 0) {
        return {
          ...state,
          toast: makeToast("Không tìm thấy công việc hợp lệ để nhập.", "error"),
        };
      }

      if (mode === "replace") {
        return {
          ...state,
          undoSnapshot: state.tasks,
          tasks: imported,
          toast: makeToast(
            `Đã nhập ${imported.length} công việc (thay thế danh sách).`,
            "success",
            true,
          ),
        };
      }

      const existingIds = new Set(state.tasks.map((t) => t.id));
      const newUnique = imported.filter((t) => !existingIds.has(t.id));
      return {
        ...state,
        undoSnapshot: state.tasks,
        tasks: [...newUnique, ...state.tasks],
        toast: makeToast(
          `Đã nhập thêm ${newUnique.length} công việc mới.`,
          "success",
          true,
        ),
      };
    }

    case "SET_FILTER":
      return {
        ...state,
        filter: { ...state.filter, ...action.payload },
      };

    case "RESET_FILTER":
      return {
        ...state,
        filter: DEFAULT_FILTER,
      };

    case "SET_VIEW_MODE":
      return {
        ...state,
        viewMode: action.payload,
        filter:
          action.payload === "board"
            ? { ...state.filter, status: "all" }
            : state.filter,
      };

    case "SHOW_TOAST":
      return {
        ...state,
        toast: makeToast(
          action.payload.message,
          action.payload.type,
          action.payload.canUndo,
        ),
      };

    case "DISMISS_TOAST":
      return {
        ...state,
        toast: null,
      };

    default:
      return state;
  }
}
