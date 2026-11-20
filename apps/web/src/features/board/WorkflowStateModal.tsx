import { useState } from "react";
import type { FormEvent } from "react";
import {
  WORKFLOW_STATE_CATEGORIES,
  type WorkflowStateCategory,
} from "@taskmanager/shared";
import { Loader2, Trash2, X } from "lucide-react";
import {
  useCreateWorkflowState,
  useDeleteWorkflowState,
  useUpdateWorkflowState,
} from "../../hooks/useAgileQueries";
import { STATE_CATEGORY_LABEL } from "../../lib/agileMeta";
import type { WorkflowStateDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

const COLOR_SWATCHES = [
  "#94a3b8",
  "#64748b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

function WorkflowStateModalBody({
  projectId,
  editing,
  onClose,
}: {
  projectId: string | null;
  editing?: WorkflowStateDto;
  onClose: () => void;
}) {
  const createState = useCreateWorkflowState(projectId);
  const updateState = useUpdateWorkflowState(projectId);
  const deleteState = useDeleteWorkflowState(projectId);

  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState<WorkflowStateCategory>(
    editing?.category ?? "started",
  );
  const [color, setColor] = useState(editing?.color ?? "#3b82f6");
  const [wipLimit, setWipLimit] = useState<string>(
    editing?.wipLimit !== null && editing?.wipLimit !== undefined
      ? String(editing.wipLimit)
      : "",
  );

  const isPending =
    createState.isPending || updateState.isPending || deleteState.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedWip = wipLimit.trim() === "" ? null : Number(wipLimit);
    const safeWip =
      parsedWip !== null && Number.isInteger(parsedWip) && parsedWip >= 1
        ? parsedWip
        : null;

    if (editing) {
      updateState.mutate(
        {
          stateId: editing.id,
          input: {
            name: name.trim(),
            category,
            color,
            wipLimit: safeWip,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      createState.mutate(
        {
          name: name.trim(),
          category,
          color,
          wipLimit: safeWip,
        },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold">
            {editing ? `Cấu hình cột "${editing.name}"` : "Thêm cột trạng thái mới"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="st-name" className="block text-xs font-semibold mb-1">
              Tên cột Kanban
            </label>
            <input
              id="st-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: QA Testing, Ready for Release"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="st-category"
                className="block text-xs font-semibold mb-1"
              >
                Nhóm ngữ nghĩa
              </label>
              <select
                id="st-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as WorkflowStateCategory)
                }
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {WORKFLOW_STATE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {STATE_CATEGORY_LABEL[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="st-wip"
                className="block text-xs font-semibold mb-1"
              >
                Giới hạn WIP
              </label>
              <input
                id="st-wip"
                type="number"
                min={1}
                max={100}
                value={wipLimit}
                onChange={(e) => setWipLimit(e.target.value)}
                placeholder="VD: 4"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold mb-1.5">Màu nhận diện</span>
            <div className="flex items-center gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Chọn màu ${swatch}`}
                  className={`w-6 h-6 rounded-full transition cursor-pointer ${
                    color === swatch
                      ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-900 scale-110"
                      : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {editing ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  deleteState.mutate(editing.id, { onSuccess: onClose })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa cột
              </button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? "Lưu thay đổi" : "Thêm cột"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WorkflowStateModal({
  projectId,
}: {
  projectId: string | null;
}) {
  const modal = useUiStore((s) => s.workflowStateModal);
  const close = useUiStore((s) => s.closeWorkflowStateModal);

  if (!modal.open) return null;

  return (
    <WorkflowStateModalBody
      key={modal.state?.id ?? "new-state"}
      projectId={projectId}
      editing={modal.state}
      onClose={close}
    />
  );
}
