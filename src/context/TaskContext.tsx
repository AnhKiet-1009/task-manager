import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { STORAGE_KEYS } from "../constants/task";
import type {
  Task,
  TaskFilterState,
  TaskFormData,
  TaskStatus,
  TaskUpdatePayload,
  ViewMode,
} from "../types/task";
import {
  filterAndSortTasks,
  getTaskStats,
  normalizeTasks,
} from "../utils/taskHelpers";
import { TaskContext } from "./TaskContextValue";
import { createInitialTaskState, taskReducer } from "./taskReducer";

function loadInitialTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return normalizeTasks(parsed);
  } catch (error) {
    console.error("Lỗi khi đọc dữ liệu từ localStorage:", error);
    return [];
  }
}

function loadInitialViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
    return saved === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}

interface TaskProviderProps {
  children: ReactNode;
  initialTasks?: Task[];
}

export function TaskProvider({ children, initialTasks }: TaskProviderProps) {
  const [state, dispatch] = useReducer(
    taskReducer,
    initialTasks,
    (providedTasks) =>
      createInitialTaskState(
        providedTasks ?? loadInitialTasks(),
        loadInitialViewMode(),
      ),
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
    } catch (error) {
      console.error("Lỗi khi lưu dữ liệu vào localStorage:", error);
    }
  }, [state.tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, state.viewMode);
    } catch {
      // Ignore storage quota errors
    }
  }, [state.viewMode]);

  useEffect(() => {
    if (!state.toast) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "DISMISS_TOAST" });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [state.toast]);

  const filteredTasks = useMemo(
    () => filterAndSortTasks(state.tasks, state.filter),
    [state.tasks, state.filter],
  );

  const stats = useMemo(() => getTaskStats(state.tasks), [state.tasks]);

  const addTask = useCallback((data: TaskFormData) => {
    dispatch({ type: "ADD_TASK", payload: data });
  }, []);

  const updateTask = useCallback((id: string, updates: TaskUpdatePayload) => {
    dispatch({ type: "UPDATE_TASK", payload: { id, updates } });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: "DELETE_TASK", payload: { id } });
  }, []);

  const toggleComplete = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_COMPLETE", payload: { id } });
  }, []);

  const moveTaskStatus = useCallback((id: string, status: TaskStatus) => {
    dispatch({ type: "MOVE_TASK_STATUS", payload: { id, status } });
  }, []);

  const reorderTask = useCallback((draggedId: string, targetId: string) => {
    dispatch({ type: "REORDER_TASKS", payload: { draggedId, targetId } });
  }, []);

  const clearCompleted = useCallback(() => {
    dispatch({ type: "CLEAR_COMPLETED" });
  }, []);

  const undoLastAction = useCallback(() => {
    dispatch({ type: "UNDO_LAST_ACTION" });
  }, []);

  const importTasksFromJson = useCallback((rawJson: string): boolean => {
    try {
      const parsed: unknown = JSON.parse(rawJson);
      const validTasks = normalizeTasks(parsed);
      if (validTasks.length === 0) {
        dispatch({
          type: "SHOW_TOAST",
          payload: {
            message: "File JSON không chứa công việc hợp lệ.",
            type: "error",
          },
        });
        return false;
      }
      dispatch({
        type: "IMPORT_TASKS",
        payload: { tasks: validTasks, mode: "merge" },
      });
      return true;
    } catch {
      dispatch({
        type: "SHOW_TOAST",
        payload: {
          message: "Không thể đọc file JSON. Vui lòng kiểm tra định dạng.",
          type: "error",
        },
      });
      return false;
    }
  }, []);

  const exportTasksToJson = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(state.tasks, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasks-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      dispatch({
        type: "SHOW_TOAST",
        payload: {
          message: `Đã xuất ${state.tasks.length} công việc ra file JSON.`,
          type: "success",
        },
      });
    } catch {
      dispatch({
        type: "SHOW_TOAST",
        payload: {
          message: "Không thể xuất file JSON.",
          type: "error",
        },
      });
    }
  }, [state.tasks]);

  const setFilter = useCallback((partial: Partial<TaskFilterState>) => {
    dispatch({ type: "SET_FILTER", payload: partial });
  }, []);

  const resetFilter = useCallback(() => {
    dispatch({ type: "RESET_FILTER" });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: "SET_VIEW_MODE", payload: mode });
  }, []);

  const dismissToast = useCallback(() => {
    dispatch({ type: "DISMISS_TOAST" });
  }, []);

  const value = useMemo(
    () => ({
      tasks: state.tasks,
      filteredTasks,
      stats,
      filter: state.filter,
      viewMode: state.viewMode,
      toast: state.toast,
      addTask,
      updateTask,
      deleteTask,
      toggleComplete,
      moveTaskStatus,
      reorderTask,
      clearCompleted,
      undoLastAction,
      importTasksFromJson,
      exportTasksToJson,
      setFilter,
      resetFilter,
      setViewMode,
      dismissToast,
    }),
    [
      state.tasks,
      filteredTasks,
      stats,
      state.filter,
      state.viewMode,
      state.toast,
      addTask,
      updateTask,
      deleteTask,
      toggleComplete,
      moveTaskStatus,
      reorderTask,
      clearCompleted,
      undoLastAction,
      importTasksFromJson,
      exportTasksToJson,
      setFilter,
      resetFilter,
      setViewMode,
      dismissToast,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
