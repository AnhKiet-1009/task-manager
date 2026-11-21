import { useState } from "react";
import type { FormEvent } from "react";
import {
  hasMinimumRole,
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  type IssuePriority,
  type IssueType,
  STORY_POINT_SCALE,
  type WorkspaceRole,
} from "@taskmanager/shared";
import { Loader2, X } from "lucide-react";
import { useCreateIssue } from "../../hooks/useAgileQueries";
import { ISSUE_PRIORITY_META, ISSUE_TYPE_META } from "../../lib/agileMeta";
import type {
  IssueListItem,
  LabelDto,
  SprintDto,
  WorkflowStateDto,
  WorkspaceMemberDto,
} from "../../lib/api";
import { type IssueModalState, useUiStore } from "../../stores/uiStore";

interface IssueModalProps {
  projectId: string | null;
  role: WorkspaceRole;
  workflowStates: WorkflowStateDto[];
  sprints: SprintDto[];
  labels: LabelDto[];
  members: WorkspaceMemberDto[];
  allIssues: IssueListItem[];
}

function CreateIssueFormInner({
  projectId,
  role,
  workflowStates,
  sprints,
  labels,
  members,
  allIssues,
  modal,
  onClose,
}: IssueModalProps & { modal: IssueModalState; onClose: () => void }) {
  const canWrite = hasMinimumRole(role, "member");
  const createIssue = useCreateIssue(projectId);

  const defaultState =
    workflowStates.find((s) => s.isDefault) ?? workflowStates[0];
  const epics = allIssues.filter((i) => i.type === "epic");

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [type, setType] = useState<IssueType>(modal.defaultType ?? "task");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [stateId, setStateId] = useState(
    modal.defaultStateId ?? defaultState?.id ?? "",
  );
  const [sprintId, setSprintId] = useState<string>(modal.defaultSprintId ?? "");
  const [parentId, setParentId] = useState<string>(modal.defaultParentId ?? "");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [storyPoints, setStoryPoints] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const handleToggleLabel = (id: string) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || title.trim().length < 2) return;

    createIssue.mutate(
      {
        title: title.trim(),
        descriptionMd: descriptionMd.trim() || undefined,
        type,
        priority,
        stateId: stateId || undefined,
        sprintId: sprintId || null,
        parentId: parentId || null,
        assigneeId: assigneeId || null,
        storyPoints,
        dueDate: dueDate || null,
        labelIds: selectedLabels,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <div className="px-5 py-3.5 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
        <h2 id="issue-modal-heading" className="text-sm font-bold truncate">
          Tạo Issue mới
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp thoại Issue"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <form id="issue-modal-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="issue-title"
              className="block text-xs font-semibold mb-1"
            >
              Tiêu đề Issue *
            </label>
            <input
              id="issue-title"
              type="text"
              required
              minLength={2}
              autoFocus
              disabled={!canWrite}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Triển khai xác thực HMAC cho GitHub Webhook"
              className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label
              htmlFor="issue-desc"
              className="block text-xs font-semibold mb-1"
            >
              Mô tả chi tiết (Markdown)
            </label>
            <textarea
              id="issue-desc"
              rows={3}
              disabled={!canWrite}
              value={descriptionMd}
              onChange={(e) => setDescriptionMd(e.target.value)}
              placeholder="Bối cảnh kỹ thuật, tiêu chí nghiệm thu (Acceptance Criteria)..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="issue-type"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Loại
              </label>
              <select
                id="issue-type"
                disabled={!canWrite}
                value={type}
                onChange={(e) => setType(e.target.value as IssueType)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ISSUE_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="issue-priority"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Độ ưu tiên
              </label>
              <select
                id="issue-priority"
                disabled={!canWrite}
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {ISSUE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {ISSUE_PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="issue-state"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Cột trạng thái
              </label>
              <select
                id="issue-state"
                disabled={!canWrite}
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {workflowStates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="issue-sprint"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Sprint
              </label>
              <select
                id="issue-sprint"
                disabled={!canWrite}
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="">Product Backlog</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="issue-assignee"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Người phụ trách
              </label>
              <select
                id="issue-assignee"
                disabled={!canWrite}
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="">Chưa gán</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="issue-due"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Hạn chót
              </label>
              <input
                id="issue-due"
                type="date"
                disabled={!canWrite}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          {type !== "epic" && epics.length > 0 && (
            <div>
              <label
                htmlFor="issue-epic"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Thuộc Epic
              </label>
              <select
                id="issue-epic"
                disabled={!canWrite}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="">Không gắn Epic</option>
                {epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.identifier} — {ep.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
              Story Points (Fibonacci)
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => setStoryPoints(null)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer ${
                  storyPoints === null
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 dark:border-slate-700 text-slate-500"
                }`}
              >
                —
              </button>
              {STORY_POINT_SCALE.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setStoryPoints(pt)}
                  className={`min-w-[34px] px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                    storyPoints === pt
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {labels.length > 0 && (
            <div>
              <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Nhãn (Labels)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const active = selectedLabels.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => handleToggleLabel(label.id)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition cursor-pointer ${
                        active
                          ? "ring-2 ring-blue-500/40"
                          : "opacity-60 hover:opacity-100"
                      }`}
                      style={{
                        borderColor: `${label.color}60`,
                        backgroundColor: active
                          ? `${label.color}28`
                          : "transparent",
                        color: label.color,
                      }}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          Đóng
        </button>
        {canWrite && (
          <button
            type="submit"
            form="issue-modal-form"
            disabled={createIssue.isPending || title.trim().length < 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
          >
            {createIssue.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            Tạo Issue
          </button>
        )}
      </div>
    </>
  );
}

export function IssueModal(props: IssueModalProps) {
  const modal = useUiStore((s) => s.issueModal);
  const close = useUiStore((s) => s.closeIssueModal);

  if (!modal.open) return null;

  const formKey = `create-${modal.defaultStateId ?? ""}-${modal.defaultSprintId ?? ""}-${modal.defaultType ?? ""}-${modal.defaultParentId ?? ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-modal-heading"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CreateIssueFormInner
          key={formKey}
          {...props}
          modal={modal}
          onClose={close}
        />
      </div>
    </div>
  );
}
