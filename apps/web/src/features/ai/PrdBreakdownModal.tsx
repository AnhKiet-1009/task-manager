import { useState } from "react";
import type { AIBreakdownResponse } from "@taskmanager/shared";
import {
  ArrowLeft,
  CheckSquare,
  Layers,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCommitPrdBreakdown,
  usePrdBreakdown,
} from "../../hooks/useAgileQueries";
import { ISSUE_PRIORITY_META, ISSUE_TYPE_META } from "../../lib/agileMeta";
import type { AiInvocationMetaDto, SprintDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

const SAMPLE_PRDS = [
  {
    label: "Thông báo Realtime đa kênh",
    text: [
      "Xây dựng hệ thống Thông báo Realtime cho đội ngũ Agile",
      "- Thiết kế bảng notifications & API đánh dấu đã đọc",
      "- Tự động tạo thông báo khi được @mention trong bình luận hoặc gán Issue",
      "- Đẩy thông báo tức thì qua SSE đến trình duyệt của người nhận",
      "- Xây dựng Popover chuông thông báo trên TopBar có đếm chưa đọc",
      "- Viết unit & integration test bảo mật multi-tenant",
    ].join("\n"),
  },
  {
    label: "Tích hợp Thanh toán SaaS",
    text: [
      "Nâng cấp gói Pro SaaS với thanh toán tự động",
      "- Thiết kế bảng subscriptions, billing_events và phân quyền tính năng theo gói",
      "- Tích hợp Checkout & Webhook xác thực chữ ký bảo mật",
      "- Mở rộng hạn mức AI Copilot không giới hạn cho Workspace gói Pro",
      "- Trang Quản lý gói cước & lịch sử hóa đơn cho Owner",
    ].join("\n"),
  },
];

interface PrdBreakdownModalProps {
  projectId: string | null;
  sprints: SprintDto[];
}

function PrdBreakdownModalBody({
  projectId,
  sprints,
  onClose,
}: PrdBreakdownModalProps & { onClose: () => void }) {
  const generate = usePrdBreakdown();
  const commit = useCommitPrdBreakdown(projectId);

  const activeSprint = sprints.find((s) => s.status === "active");

  const [prompt, setPrompt] = useState("");
  const [sprintId, setSprintId] = useState<string>(activeSprint?.id ?? "");
  const [maxIssues, setMaxIssues] = useState(6);

  const [draft, setDraft] = useState<AIBreakdownResponse | null>(null);
  const [meta, setMeta] = useState<AiInvocationMetaDto | null>(null);
  const [selectedTempIds, setSelectedTempIds] = useState<string[]>([]);

  const handleGenerate = () => {
    if (!projectId || prompt.trim().length < 10) return;
    generate.mutate(
      {
        projectId,
        sprintId: sprintId || null,
        prompt: prompt.trim(),
        maxIssues,
      },
      {
        onSuccess: (res) => {
          setDraft(res.breakdown);
          setMeta(res.meta);
          setSelectedTempIds(res.breakdown.issues.map((i) => i.tempId));
        },
      },
    );
  };

  const handleCommit = () => {
    if (!projectId || !draft) return;
    const chosenIssues = draft.issues.filter((i) =>
      selectedTempIds.includes(i.tempId),
    );
    if (chosenIssues.length === 0) return;

    commit.mutate(
      {
        projectId,
        sprintId: sprintId || null,
        epic: draft.epic,
        issues: chosenIssues,
      },
      { onSuccess: onClose },
    );
  };

  const toggleTempId = (tempId: string) => {
    setSelectedTempIds((prev) =>
      prev.includes(tempId)
        ? prev.filter((id) => id !== tempId)
        : [...prev, tempId],
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="AI PRD-to-Backlog Generator"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 dark:from-purple-950/30 dark:to-indigo-950/30">
          <h2 className="text-sm font-extrabold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            AI PRD-to-Backlog Generator
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại AI PRD"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!draft ? (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="prd-prompt"
                    className="text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    Dán tài liệu yêu cầu sản phẩm (PRD / Biên bản họp)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_PRDS.map((sample) => (
                      <button
                        key={sample.label}
                        type="button"
                        onClick={() => setPrompt(sample.text)}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100/80 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900 transition cursor-pointer"
                      >
                        Mẫu: {sample.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  id="prd-prompt"
                  rows={7}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Mô tả tính năng lớn bạn cần xây dựng... AI sẽ tự chia Epic, User Story/Task con, ước lượng Story Points Fibonacci và liên kết phụ thuộc."
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="prd-sprint"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Đưa Issues vào Sprint
                  </label>
                  <select
                    id="prd-sprint"
                    value={sprintId}
                    onChange={(e) => setSprintId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">Product Backlog</option>
                    {sprints
                      .filter((s) => s.status !== "completed")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="prd-max"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Số lượng Issue tối đa
                  </label>
                  <select
                    id="prd-max"
                    value={maxIssues}
                    onChange={(e) => setMaxIssues(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {[4, 6, 8, 12].map((n) => (
                      <option key={n} value={n}>
                        Tối đa {n} issues
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Rationale & Meta */}
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/60 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    Phân tích cấu trúc Backlog
                  </span>
                  {meta && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-slate-500">
                      {meta.mode === "llm"
                        ? `${meta.provider}/${meta.model}`
                        : "Smart Agile Breakdown"}
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  {draft.rationale}
                </p>
              </div>

              {/* Generated Epic Card */}
              <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-950 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <Layers className="w-4 h-4" />
                  EPIC CHA
                </div>
                <input
                  type="text"
                  aria-label="Tiêu đề Epic"
                  value={draft.epic.title}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      epic: { ...draft.epic, title: e.target.value },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              {/* Generated Issues Checklist */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Issues con được đề xuất ({selectedTempIds.length}/
                  {draft.issues.length} đã chọn)
                </p>
                <div className="space-y-2">
                  {draft.issues.map((item) => {
                    const checked = selectedTempIds.includes(item.tempId);
                    return (
                      <div
                        key={item.tempId}
                        className={`p-3 rounded-xl border transition ${
                          checked
                            ? "border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-950"
                            : "border-slate-200 dark:border-slate-800 opacity-50"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTempId(item.tempId)}
                            aria-label={`Chọn ${item.title}`}
                            className="mt-1 accent-blue-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${ISSUE_TYPE_META[item.type].badgeClass}`}
                              >
                                {ISSUE_TYPE_META[item.type].label}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ISSUE_PRIORITY_META[item.priority].badgeClass}`}
                              >
                                {ISSUE_PRIORITY_META[item.priority].label}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                {item.storyPoints} pts
                              </span>
                              {item.blockedByTempIds.length > 0 && (
                                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                                  Chờ: {item.blockedByTempIds.join(", ")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm font-semibold">
                              {item.title}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-between gap-2">
          {draft ? (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Sửa lại PRD
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              Output được kiểm định chặt chẽ bằng Zod Schema
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Hủy
            </button>

            {!draft ? (
              <button
                type="button"
                disabled={prompt.trim().length < 10 || generate.isPending}
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {generate.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Phân tích bằng AI
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedTempIds.length === 0 || commit.isPending}
                onClick={handleCommit}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {commit.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckSquare className="w-3.5 h-3.5" />
                )}
                Tạo hàng loạt (1 Epic + {selectedTempIds.length} Issues)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrdBreakdownModal(props: PrdBreakdownModalProps) {
  const open = useUiStore((s) => s.prdModalOpen);
  const setOpen = useUiStore((s) => s.setPrdModalOpen);

  if (!open) return null;

  return (
    <PrdBreakdownModalBody
      key={props.projectId ?? "no-project"}
      {...props}
      onClose={() => setOpen(false)}
    />
  );
}
