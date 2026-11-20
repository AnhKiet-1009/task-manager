import { useContext } from "react";
import { TaskContext } from "../context/TaskContextValue";
import type { TaskContextValue } from "../context/TaskContextValue";

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) {
    throw new Error("useTasks phải được sử dụng bên trong TaskProvider");
  }
  return ctx;
}
