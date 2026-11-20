import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { useCreateSprint, useUpdateSprint } from "../../hooks/useAgileQueries";
import type { SprintDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

interface SprintModalBodyProps {
  projectId: string | null;
  editing?: SprintDto;
  onClose: () => void;
}

function SprintModalBody({
  projectId,
  editing,
  onClose,
}: SprintModalBodyProps) {
  const createSprint = useCreateSprint(projectId);
  const updateSprint = useUpdateSprint(projectId);

  const [name, setName] = useState(editing?.name ?? "");
  const [goal, setGoal] = useState(editing?.goal ?? "");
  const [startDate, setStartDate] = useState(
    editing?.startDate?.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = useState(editing?.endDate?.slice(0, 10) ?? "");

  const isPending = createSprint.isPending || updateSprint.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;

    const payload = {
      name: name.trim(),
      goal: goal.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (editing) {
      updateSprint.mutate(
        { sprintId: editing.id, input: payload },
        { onSuccess: onClose },
      );
    } else {
      createSprint.mutate(
        { ...payload, status: "planned" },
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
            {editing ? `Sửa ${editing.name}` : "Tạo Sprint mới"}
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
            <label
              htmlFor="sprint-name"
              className="block text-xs font-semibold mb-1"
            >
              Tên Sprint
            </label>
            <input
              id="sprint-name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Sprint 16 — AI Analytics"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div>
            <label
              htmlFor="sprint-goal"
              className="block text-xs font-semibold mb-1"
            >
              Mục tiêu Sprint (Sprint Goal)
            </label>
            <textarea
              id="sprint-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Kết quả quan trọng nhất team cần bàn giao trong chu kỳ này..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sprint-start"
                className="block text-xs font-semibold mb-1"
              >
                Ngày bắt đầu
              </label>
              <input
                id="sprint-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label
                htmlFor="sprint-end"
                className="block text-xs font-semibold mb-1"
              >
                Ngày kết thúc
              </label>
              <input
                id="sprint-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              {editing ? "Lưu" : "Tạo Sprint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SprintModal({ projectId }: { projectId: string | null }) {
  const modal = useUiStore((s) => s.sprintModal);
  const close = useUiStore((s) => s.closeSprintModal);

  if (!modal.open) return null;

  return (
    <SprintModalBody
      key={modal.sprint?.id ?? "new-sprint"}
      projectId={projectId}
      editing={modal.sprint}
      onClose={close}
    />
  );
}
