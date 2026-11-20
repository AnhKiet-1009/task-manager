import { useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  GripVertical,
  Pencil,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
  VALIDATION_LIMITS,
} from "../constants/task";
import { useTasks } from "../hooks/useTasks";
import type {
  FormErrors,
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "../types/task";
import { formatDueDateVN, getDueDateState } from "../utils/taskHelpers";
import { hasFormErrors, validateTaskInput } from "../utils/validation";

interface TaskItemProps {
  task: Task;
  compact?: boolean;
  isDropTarget?: boolean;
  onDragStartItem?: (taskId: string) => void;
  onDragOverItem?: (e: DragEvent<HTMLElement>, taskId: string) => void;
  onDropOnItem?: (e: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEndItem?: () => void;
}

export function TaskItem({
  task,
  compact = false,
  isDropTarget = false,
  onDragStartItem,
  onDragOverItem,
  onDropOnItem,
  onDragEndItem,
}: TaskItemProps) {
  const { toggleComplete, deleteTask, updateTask, moveTaskStatus } = useTasks();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(
    task.description ?? "",
  );
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editCategory, setEditCategory] = useState<TaskCategory>(task.category);
  const [editStatus, setEditStatus] = useState<TaskStatus>(task.status);
  const [editDueDate, setEditDueDate] = useState(task.dueDate ?? "");
  const [errors, setErrors] = useState<FormErrors>({});

  const isDone = task.status === "done";
  const dueDateState = getDueDateState(task.dueDate, task.status);
  const currentStatusIndex = STATUS_ORDER.indexOf(task.status);
  const prevStatus =
    currentStatusIndex > 0 ? STATUS_ORDER[currentStatusIndex - 1] : null;
  const nextStatus =
    currentStatusIndex < STATUS_ORDER.length - 1
      ? STATUS_ORDER[currentStatusIndex + 1]
      : null;

  const handleStartEdit = () => {
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditPriority(task.priority);
    setEditCategory(task.category);
    setEditStatus(task.status);
    setEditDueDate(task.dueDate ?? "");
    setErrors({});
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setErrors({});
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    const validationErrors = validateTaskInput({
      title: editTitle,
      description: editDescription,
      dueDate: editDueDate,
    });

    if (hasFormErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    updateTask(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      priority: editPriority,
      category: editCategory,
      status: editStatus,
      dueDate: editDueDate || undefined,
    });
    setErrors({});
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === "Enter" && e.currentTarget.tagName !== "TEXTAREA") {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const handleDragStart = (e: DragEvent<HTMLElement>) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStartItem?.(task.id);
  };

  const dueDateBadgeStyle =
    dueDateState === "overdue"
      ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800"
      : dueDateState === "today"
        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
        : dueDateState === "soon"
          ? "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800"
          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  const dueDateLabel =
    dueDateState === "overdue"
      ? `Quá hạn · ${formatDueDateVN(task.dueDate!)}`
      : dueDateState === "today"
        ? `Hôm nay · ${formatDueDateVN(task.dueDate!)}`
        : task.dueDate
          ? formatDueDateVN(task.dueDate)
          : "";

  const editForm = (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <div>
        <label htmlFor={`edit-title-${task.id}`} className="sr-only">
          Chỉnh sửa tiêu đề
        </label>
        <input
          id={`edit-title-${task.id}`}
          type="text"
          autoFocus
          value={editTitle}
          onChange={(e) => {
            setEditTitle(e.target.value);
            if (errors.title)
              setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="Tiêu đề công việc..."
          className={`w-full px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
            errors.title
              ? "border-rose-500 focus:ring-rose-200"
              : "border-slate-300 dark:border-slate-700 focus:ring-blue-200 dark:focus:ring-blue-900"
          }`}
        />
        {errors.title && (
          <p role="alert" className="text-rose-500 text-xs mt-1">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor={`edit-desc-${task.id}`}
            className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
          >
            Mô tả
          </label>
          <span
            className={`text-[11px] ${
              editDescription.length > VALIDATION_LIMITS.DESCRIPTION_MAX
                ? "text-rose-500 font-semibold"
                : "text-slate-400"
            }`}
          >
            {editDescription.length}/{VALIDATION_LIMITS.DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id={`edit-desc-${task.id}`}
          rows={2}
          value={editDescription}
          onChange={(e) => {
            setEditDescription(e.target.value);
            if (errors.description)
              setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          placeholder="Mô tả chi tiết..."
          className={`w-full px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 resize-none ${
            errors.description
              ? "border-rose-500 focus:ring-rose-200"
              : "border-slate-300 dark:border-slate-700 focus:ring-blue-200 dark:focus:ring-blue-900"
          }`}
        />
        {errors.description && (
          <p role="alert" className="text-rose-500 text-xs mt-1">
            {errors.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Chỉnh sửa độ ưu tiên"
          value={editPriority}
          onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
        >
          {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              Ưu tiên: {PRIORITY_CONFIG[p].label}
            </option>
          ))}
        </select>

        <select
          aria-label="Chỉnh sửa danh mục"
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value as TaskCategory)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
        >
          {(Object.keys(CATEGORY_CONFIG) as TaskCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_CONFIG[cat].label}
            </option>
          ))}
        </select>

        <select
          aria-label="Chỉnh sửa trạng thái"
          value={editStatus}
          onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
        >
          {STATUS_ORDER.map((st) => (
            <option key={st} value={st}>
              {STATUS_CONFIG[st].label}
            </option>
          ))}
        </select>

        <input
          type="date"
          aria-label="Chỉnh sửa hạn chót"
          value={editDueDate}
          onChange={(e) => setEditDueDate(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-slate-400">
          Enter lưu · Esc hủy
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancelEdit}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Lưu
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <article
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={(e) => onDragOverItem?.(e, task.id)}
      onDrop={(e) => onDropOnItem?.(e, task.id)}
      onDragEnd={onDragEndItem}
      className={`group rounded-xl border transition-all ${
        compact
          ? "p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md"
          : "p-4"
      } ${
        isDropTarget
          ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/40 dark:bg-blue-950/30"
          : isDone
            ? "bg-slate-50/90 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800/80 opacity-85"
            : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      {isEditing ? (
        editForm
      ) : compact ? (
        /* Kanban Card Layout: clean, uncluttered, Trello/Linear style */
        <div className="space-y-2.5">
          {/* Top metadata + hover actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                  PRIORITY_CONFIG[task.priority].badgeClass
                }`}
              >
                {PRIORITY_CONFIG[task.priority].label}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                  CATEGORY_CONFIG[task.category].badgeClass
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                {CATEGORY_CONFIG[task.category].label}
              </span>
            </div>

            <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={handleStartEdit}
                aria-label={`Sửa công việc "${task.title}"`}
                title="Chỉnh sửa"
                className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 transition cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                aria-label={`Xóa công việc "${task.title}"`}
                title="Xóa"
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Title & Description */}
          <div>
            <h3
              className={`font-semibold text-sm leading-snug break-words ${
                isDone
                  ? "line-through text-slate-400 dark:text-slate-500"
                  : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 whitespace-pre-line break-words">
                {task.description}
              </p>
            )}
          </div>

          {/* Card footer: due date + quick move arrows */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div>
              {task.dueDate ? (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${dueDateBadgeStyle}`}
                >
                  <Calendar className="w-3 h-3" />
                  {dueDateLabel}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {new Date(task.createdAt).toLocaleDateString("vi-VN")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {prevStatus && (
                <button
                  type="button"
                  onClick={() => moveTaskStatus(task.id, prevStatus)}
                  title={`Chuyển về ${STATUS_CONFIG[prevStatus].label}`}
                  aria-label={`Chuyển "${task.title}" về ${STATUS_CONFIG[prevStatus].label}`}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {nextStatus && (
                <button
                  type="button"
                  onClick={() => moveTaskStatus(task.id, nextStatus)}
                  title={`Chuyển sang ${STATUS_CONFIG[nextStatus].label}`}
                  aria-label={`Chuyển "${task.title}" sang ${STATUS_CONFIG[nextStatus].label}`}
                  className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List View Row Layout */
        <div className="flex items-start gap-2.5">
          <div
            className="mt-1 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
            title="Kéo để sắp xếp thứ tự"
            aria-hidden="true"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <input
            type="checkbox"
            checked={isDone}
            onChange={() => toggleComplete(task.id)}
            aria-label={`Đánh dấu hoàn thành "${task.title}"`}
            className="mt-1 h-4 w-4 accent-blue-600 rounded border-slate-300 cursor-pointer shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`font-semibold text-sm sm:text-base break-words transition ${
                  isDone
                    ? "line-through text-slate-400 dark:text-slate-500"
                    : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {task.title}
              </h3>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  aria-label={`Sửa công việc "${task.title}"`}
                  title="Chỉnh sửa"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  aria-label={`Xóa công việc "${task.title}"`}
                  title="Xóa"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {task.description && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-line break-words">
                {task.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                  PRIORITY_CONFIG[task.priority].badgeClass
                }`}
              >
                {PRIORITY_CONFIG[task.priority].label}
              </span>

              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                  CATEGORY_CONFIG[task.category].badgeClass
                }`}
              >
                <Tag className="w-3 h-3" />
                {CATEGORY_CONFIG[task.category].label}
              </span>

              {task.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${dueDateBadgeStyle}`}
                >
                  <Calendar className="w-3 h-3" />
                  {dueDateLabel}
                </span>
              )}

              <select
                aria-label={`Trạng thái của "${task.title}"`}
                value={task.status}
                onChange={(e) =>
                  moveTaskStatus(task.id, e.target.value as TaskStatus)
                }
                className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 cursor-pointer"
              >
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
