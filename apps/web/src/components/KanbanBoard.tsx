import { useState } from "react";
import type { DragEvent } from "react";
import { Plus } from "lucide-react";
import { STATUS_CONFIG, STATUS_ORDER } from "../constants/task";
import { useTasks } from "../hooks/useTasks";
import type { TaskStatus } from "../types/task";
import { TaskItem } from "./TaskItem";

interface KanbanBoardProps {
  onAddTaskInColumn?: (status: TaskStatus) => void;
}

export function KanbanBoard({ onAddTaskInColumn }: KanbanBoardProps) {
  const { filteredTasks, moveTaskStatus } = useTasks();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus | null>(null);

  const handleDragOverColumn = (
    e: DragEvent<HTMLDivElement>,
    status: TaskStatus,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (activeColumn !== status) {
      setActiveColumn(status);
    }
  };

  const handleDropOnColumn = (
    e: DragEvent<HTMLDivElement>,
    targetStatus: TaskStatus,
  ) => {
    e.preventDefault();
    const taskId = draggedTaskId ?? e.dataTransfer.getData("text/plain");
    if (taskId) {
      moveTaskStatus(taskId, targetStatus);
    }
    setDraggedTaskId(null);
    setActiveColumn(null);
  };

  const handleDragLeaveColumn = (
    e: DragEvent<HTMLDivElement>,
    status: TaskStatus,
  ) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      if (activeColumn === status) {
        setActiveColumn(null);
      }
    }
  };

  const headerPillColors: Record<TaskStatus, string> = {
    todo: "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    in_progress:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300",
  };

  return (
    <section
      aria-label="Bảng Kanban công việc"
      className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch"
    >
      {STATUS_ORDER.map((status) => {
        const config = STATUS_CONFIG[status];
        const columnTasks = filteredTasks.filter((t) => t.status === status);
        const isOver = activeColumn === status;

        return (
          <div
            key={status}
            data-testid={`kanban-col-${status}`}
            onDragOver={(e) => handleDragOverColumn(e, status)}
            onDrop={(e) => handleDropOnColumn(e, status)}
            onDragLeave={(e) => handleDragLeaveColumn(e, status)}
            className={`flex flex-col rounded-2xl border p-3.5 min-h-[420px] transition-all ${
              isOver
                ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 ring-2 ring-blue-500/25"
                : "bg-slate-200/55 dark:bg-slate-900/75 border-slate-200/90 dark:border-slate-800"
            }`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${config.dotClass}`} />
                <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {config.label}
                </h2>
                <span
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${headerPillColors[status]}`}
                >
                  {columnTasks.length}
                </span>
              </div>

              {onAddTaskInColumn && (
                <button
                  type="button"
                  onClick={() => onAddTaskInColumn(status)}
                  title={`Thêm công việc vào cột ${config.label}`}
                  aria-label={`Thêm công việc vào cột ${config.label}`}
                  className="p-1 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-white/80 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Cards container */}
            <div className="flex-1 space-y-2.5">
              {columnTasks.length === 0 ? (
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center px-4 text-center text-xs text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-300/70 dark:border-slate-800 rounded-xl">
                  <p>Kéo thả thẻ vào đây</p>
                  <p className="text-[11px] mt-0.5 opacity-80">
                    hoặc bấm nút thêm bên dưới
                  </p>
                </div>
              ) : (
                columnTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    compact
                    onDragStartItem={(id) => setDraggedTaskId(id)}
                    onDragEndItem={() => {
                      setDraggedTaskId(null);
                      setActiveColumn(null);
                    }}
                  />
                ))
              )}
            </div>

            {/* Quick add footer button */}
            {onAddTaskInColumn && (
              <button
                type="button"
                onClick={() => onAddTaskInColumn(status)}
                className="mt-3 w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm thẻ
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
