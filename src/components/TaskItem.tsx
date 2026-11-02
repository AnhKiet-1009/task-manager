import { useState } from "react";
import type { Task, TaskPriority } from "../types/task";

interface TaskItemProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (
    id: string,
    updatedTitle: string,
    updatedPriority: TaskPriority,
  ) => void;
}

export function TaskItem({
  task,
  onToggleStatus,
  onDeleteTask,
  onUpdateTask,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editError, setEditError] = useState<string>("");

  const handleStartEdit = () => {
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditError("");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmedTitle = editTitle.trim();

    if (!trimmedTitle) {
      setEditError("Không được để trống title.");
      return;
    }
    if (trimmedTitle.length < 3) {
      setEditError("Title tối thiếu 3 ký tự.");
      return;
    }

    onUpdateTask(task.id, editTitle.trim(), editPriority);
    setEditError("");
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditError("");
    setIsEditing(false);
  };

  const priorityStyles: Record<TaskPriority, string> = {
    low: "bg-emerald-100 text-emerald-700 border-emerald-300",
    medium: "bg-amber-100 text-amber-700 border-amber-300",
    high: "bg-rose-100 text-rose-700 border-rose-300",
  };

  return (
    <div
      className={`p-4 rounded-lg border transition ${
        task.isCompleted
          ? "bg-gray-50 border-gray-200 opacity-70"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Tiêu đề task..."
            />
            {editError && (
              <p className="text-red-500 text-xs mt-1">{editError}</p>
            )}
          </div>

          <div className="flex gap-2 justify-end items-center">
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none"
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-3 py-1 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={task.isCompleted}
              onChange={() => onToggleStatus(task.id)}
              className="mt-1 h-5 w-5 text-blue-600 rounded border-gray-300 cursor-pointer"
            />
            <div>
              <h3
                className={`font-semibold text-base transition ${
                  task.isCompleted
                    ? "line-through text-gray-400"
                    : "text-gray-800"
                }`}
              >
                {task.title}
              </h3>
              {task.description && (
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    priorityStyles[task.priority]
                  }`}
                >
                  {task.priority}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(task.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 text-sm">
            <button
              type="button"
              onClick={handleStartEdit}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Sửa
            </button>
            <button
              type="button"
              onClick={() => onDeleteTask(task.id)}
              className="text-red-500 hover:text-red-700 font-medium"
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
