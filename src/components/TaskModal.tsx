import { useEffect } from "react";
import { Plus, X } from "lucide-react";
import type { TaskStatus } from "../types/task";
import { TaskForm } from "./TaskForm";

interface TaskModalProps {
  isOpen: boolean;
  defaultStatus: TaskStatus;
  onClose: () => void;
}

export function TaskModal({ isOpen, defaultStatus, onClose }: TaskModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <h2
            id="task-modal-title"
            className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"
          >
            <span className="p-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Plus className="w-4 h-4" />
            </span>
            Tạo công việc mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại tạo công việc"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <TaskForm
          key={defaultStatus}
          defaultStatus={defaultStatus}
          variant="modal"
          onSuccess={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
