import { useState } from "react";
import type { TaskFormData, FormErrors, TaskPriority } from "../types/task";

interface TaskFormProps {
  onAddTask: (data: TaskFormData) => void;
}

export const TaskForm = ({ onAddTask }: TaskFormProps) => {
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    priority: "medium",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    const trimmedTitle = formData.title.trim();
    const trimmedDescription = formData.description?.trim() ?? "";

    if (!trimmedTitle) {
      newErrors.title = "Không được bỏ trống tiêu đề.";
    } else if (trimmedTitle.length < 3) {
      newErrors.title = "Tên task phải có ít nhất 3 ký tự.";
    }

    if ((trimmedDescription.length ?? 0) > 200) {
      newErrors.description = "Mô tả tối đa 200 ký tự.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onAddTask({
      ...formData,
      title: formData.title.trim(),
      description: formData.description?.trim(),
    });

    setFormData({ title: "", description: "", priority: "medium" });
    setErrors({});
  };

  return (
    <form
      action={handleSubmit}
      className="p-4 bg-white rounded-lg shadow-md space-y-4"
    >
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Tiêu đề task *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Nhập tiêu đề task..."
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
            errors.title
              ? "border-red-500 focus:ring-red-200"
              : "border-gray-300 focus:ring-blue-200"
          }`}
        />
        {errors.title && (
          <p className="text-red-500 text-xs mt-1">{errors.title}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Mô tả
        </label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Mô tả chi tiết (tùy chọn)..."
          rows={3}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
            errors.description
              ? "border-red-500 focus:ring-red-200"
              : "border-gray-300 focus:ring-blue-200"
          }`}
        />
        {errors.description && (
          <p className="text-red-500 text-xs mt-1">{errors.description}</p>
        )}
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Độ ưu tiên
          </label>
          <select
            value={formData.priority}
            onChange={(e) =>
              setFormData({
                ...formData,
                priority: e.target.value as TaskPriority,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="low">Thấp (Low)</option>
            <option value="medium">Trung bình (Medium)</option>
            <option value="high">Cao (High)</option>
          </select>
        </div>

        <button
          type="submit"
          className="self-end px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition duration-200"
        >
          Thêm Task
        </button>
      </div>
    </form>
  );
};
