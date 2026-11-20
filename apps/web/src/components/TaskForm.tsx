import { useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
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
  TaskCategory,
  TaskFormData,
  TaskPriority,
  TaskStatus,
} from "../types/task";
import { hasFormErrors, validateTaskInput } from "../utils/validation";

interface TaskFormProps {
  defaultStatus?: TaskStatus;
  variant?: "card" | "modal";
  onSuccess?: () => void;
  onCancel?: () => void;
}

function createInitialForm(status: TaskStatus = "todo"): TaskFormData {
  return {
    title: "",
    description: "",
    priority: "medium",
    status,
    category: "work",
    dueDate: "",
  };
}

export function TaskForm({
  defaultStatus = "todo",
  variant = "card",
  onSuccess,
  onCancel,
}: TaskFormProps) {
  const { addTask } = useTasks();
  const [formData, setFormData] = useState<TaskFormData>(() =>
    createInitialForm(defaultStatus),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [isExpanded, setIsExpanded] = useState(true);

  const descLength = (formData.description ?? "").length;
  const idPrefix = variant === "modal" ? "modal-task" : "task";

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, title: value }));
    if (errors.title) {
      setErrors((prev) => ({ ...prev, title: undefined }));
    }
  };

  const handleDescriptionChange = (value: string) => {
    setFormData((prev) => ({ ...prev, description: value }));
    if (errors.description) {
      setErrors((prev) => ({ ...prev, description: undefined }));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationErrors = validateTaskInput({
      title: formData.title,
      description: formData.description,
      dueDate: formData.dueDate,
    });

    if (hasFormErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    addTask({
      ...formData,
      title: formData.title.trim(),
      description: formData.description?.trim() || undefined,
      dueDate: formData.dueDate || undefined,
    });

    setFormData(createInitialForm(defaultStatus));
    setErrors({});
    onSuccess?.();
  };

  const formContent = (
    <form onSubmit={handleSubmit} noValidate className="p-4 space-y-4">
      {/* Title */}
      <div>
        <label
          htmlFor={`${idPrefix}-title`}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
        >
          Tiêu đề công việc <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${idPrefix}-title`}
          type="text"
          autoFocus={variant === "modal"}
          value={formData.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Ví dụ: Hoàn thành báo cáo tuần..."
          maxLength={VALIDATION_LIMITS.TITLE_MAX + 20}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${idPrefix}-title-error` : undefined}
          className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
            errors.title
              ? "border-rose-500 focus:ring-rose-200 dark:focus:ring-rose-900"
              : "border-slate-300 dark:border-slate-700 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-500"
          }`}
        />
        {errors.title && (
          <p
            id={`${idPrefix}-title-error`}
            role="alert"
            className="text-rose-500 text-xs mt-1"
          >
            {errors.title}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor={`${idPrefix}-description`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Mô tả chi tiết
          </label>
          <span
            className={`text-[11px] font-medium ${
              descLength > VALIDATION_LIMITS.DESCRIPTION_MAX
                ? "text-rose-500"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {descLength}/{VALIDATION_LIMITS.DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id={`${idPrefix}-description`}
          value={formData.description ?? ""}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Ghi chú, yêu cầu hoặc checklist nhỏ (tùy chọn)..."
          rows={3}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={
            errors.description ? `${idPrefix}-description-error` : undefined
          }
          className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition resize-none ${
            errors.description
              ? "border-rose-500 focus:ring-rose-200 dark:focus:ring-rose-900"
              : "border-slate-300 dark:border-slate-700 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-500"
          }`}
        />
        {errors.description && (
          <p
            id={`${idPrefix}-description-error`}
            role="alert"
            className="text-rose-500 text-xs mt-1"
          >
            {errors.description}
          </p>
        )}
      </div>

      {/* Metadata selects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`${idPrefix}-priority`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Độ ưu tiên
          </label>
          <select
            id={`${idPrefix}-priority`}
            value={formData.priority}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                priority: e.target.value as TaskPriority,
              }))
            }
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
          >
            {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-category`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Danh mục
          </label>
          <select
            id={`${idPrefix}-category`}
            value={formData.category}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                category: e.target.value as TaskCategory,
              }))
            }
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
          >
            {(Object.keys(CATEGORY_CONFIG) as TaskCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_CONFIG[cat].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-status`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Trạng thái ban đầu
          </label>
          <select
            id={`${idPrefix}-status`}
            value={formData.status}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                status: e.target.value as TaskStatus,
              }))
            }
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
          >
            {STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {STATUS_CONFIG[st].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-due-date`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Hạn chót
          </label>
          <input
            id={`${idPrefix}-due-date`}
            type="date"
            value={formData.dueDate ?? ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                dueDate: e.target.value,
              }))
            }
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
          />
        </div>
      </div>

      <div className={variant === "modal" ? "flex justify-end gap-2 pt-2" : ""}>
        {variant === "modal" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Hủy
          </button>
        )}
        <button
          type="submit"
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition cursor-pointer ${
            variant === "card" ? "w-full" : ""
          }`}
        >
          <Plus className="w-4 h-4" />
          Thêm công việc
        </button>
      </div>
    </form>
  );

  if (variant === "modal") {
    return formContent;
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 cursor-pointer"
        aria-expanded={isExpanded}
      >
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Tạo công việc mới
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {isExpanded && formContent}
    </section>
  );
}
