import { useState } from "react";
import { hasMinimumRole, type WorkspaceRole } from "@taskmanager/shared";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  GitMerge,
  GitPullRequest,
  KeyRound,
  Loader2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useAnalyzeSprintRisk,
  useProjectAnalytics,
  useSimulateGitHubPr,
} from "../../hooks/useAgileQueries";
import { getInitials } from "../../lib/agileMeta";
import type { IssueListItem, SprintDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

interface AnalyticsDashboardProps {
  projectId: string;
  role: WorkspaceRole;
  sprints: SprintDto[];
  issues: IssueListItem[];
}

const RISK_STYLE = {
  low: {
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
    label: "Thấp (An toàn)",
  },
  medium: {
    badge:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
    label: "Trung bình",
  },
  high: {
    badge:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800",
    label: "Cao (Cần chú ý)",
  },
  critical: {
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800",
    label: "Nghiêm trọng",
  },
} as const;

export function AnalyticsDashboard({
  projectId,
  role,
  sprints,
  issues,
}: AnalyticsDashboardProps) {
  const openIssueDrawer = useUiStore((s) => s.openIssueDrawer);
  const setPrdModalOpen = useUiStore((s) => s.setPrdModalOpen);
  const setAiSettingsModalOpen = useUiStore((s) => s.setAiSettingsModalOpen);

  const canWrite = hasMinimumRole(role, "member");
  const defaultSprint =
    sprints.find((s) => s.status === "active") ?? sprints[sprints.length - 1];

  const [selectedSprintId, setSelectedSprintId] = useState<string>(
    defaultSprint?.id ?? "",
  );
  const effectiveSprintId = selectedSprintId || defaultSprint?.id || null;

  const analyticsQuery = useProjectAnalytics(projectId, effectiveSprintId);
  const riskMutation = useAnalyzeSprintRisk();
  const simulatePr = useSimulateGitHubPr(projectId);

  const nonEpicIssues = issues.filter((i) => i.type !== "epic");
  const [simIssueKey, setSimIssueKey] = useState<string>(
    nonEpicIssues.find((i) => i.state?.category !== "completed")?.identifier ??
      nonEpicIssues[0]?.identifier ??
      "",
  );
  const [simAction, setSimAction] = useState<"opened" | "merged">("opened");

  const analytics = analyticsQuery.data;
  const riskData = riskMutation.data;

  const issueIdByIdentifier = new Map(
    issues.map((i) => [i.identifier, i.id]),
  );

  if (analyticsQuery.isLoading || !analytics) {
    return (
      <div className="py-24 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Đang tính toán Burndown, Velocity và tín hiệu rủi ro Sprint...
      </div>
    );
  }

  const resolvedSimKey = simIssueKey || nonEpicIssues[0]?.identifier || "";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Sprint Analytics & AI Risk Radar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Biểu đồ Burndown tính từ lịch sử <code>activity_logs</code>, Velocity
            nhóm, tải nhân sự và Radar cảnh báo rủi ro AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sprints.length > 0 && (
            <select
              aria-label="Chọn Sprint phân tích"
              value={effectiveSprintId ?? ""}
              onChange={(e) => {
                setSelectedSprintId(e.target.value);
                riskMutation.reset();
              }}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
            >
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.status === "active" ? "● " : ""}
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {canWrite && (
            <button
              type="button"
              onClick={() => setPrdModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Tạo Backlog từ PRD
            </button>
          )}

          <button
            type="button"
            onClick={() => setAiSettingsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            AI BYOK
          </button>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tiến độ Sprint</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold">
            {analytics.summary.completionPercent}%
          </p>
          <p className="text-[11px] text-slate-500">
            {analytics.summary.completedPoints}/{analytics.summary.totalPoints}{" "}
            pts • còn {analytics.selectedSprint?.daysRemaining ?? 0} ngày
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Velocity trung bình</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold">
            {analytics.summary.averageVelocity}{" "}
            <span className="text-xs font-semibold text-slate-400">pts</span>
          </p>
          <p className="text-[11px] text-slate-500">
            {analytics.velocity.length} Sprint trong dự án
          </p>
        </div>

        <div
          className={`p-4 rounded-2xl border shadow-xs space-y-1 ${
            analytics.summary.stalledCount > 0
              ? "border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Issue bị kẹt &gt; 72h</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {analytics.summary.stalledCount}
          </p>
          <p className="text-[11px] text-slate-500">
            Cần gỡ tắc sớm trong Daily Standup
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Quá hạn / Vượt WIP</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold">
            {analytics.summary.overdueCount}{" "}
            <span className="text-sm font-semibold text-slate-400">
              / {analytics.summary.wipBreachCount}
            </span>
          </p>
          <p className="text-[11px] text-slate-500">
            {analytics.summary.unassignedHighPriorityCount} ưu tiên cao chưa gán
          </p>
        </div>
      </section>

      {/* Row 2: AI Sprint Risk & Bottleneck Radar */}
      <section
        data-testid="ai-sprint-risk-card"
        className="rounded-2xl border border-purple-200/80 dark:border-purple-900/70 bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/40 dark:from-slate-900 dark:via-purple-950/20 dark:to-indigo-950/20 p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">
                AI Sprint Risk & Bottleneck Radar
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quét tự động tiến độ Burndown, task bị kẹt lâu, WIP Limit và đề
                xuất hành động khắc phục.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!effectiveSprintId || riskMutation.isPending}
            onClick={() => {
              if (!effectiveSprintId) return;
              riskMutation.mutate({
                projectId,
                sprintId: effectiveSprintId,
              });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            {riskMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {riskData ? "Phân tích lại rủi ro AI" : "Quét rủi ro Sprint bằng AI"}
          </button>
        </div>

        {riskData ? (
          <div className="space-y-4 pt-2 border-t border-purple-200/60 dark:border-purple-900/50">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${RISK_STYLE[riskData.report.riskLevel].badge}`}
              >
                Mức rủi ro: {RISK_STYLE[riskData.report.riskLevel].label} (
                {riskData.report.riskScore}/100)
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                {riskData.meta.mode === "llm"
                  ? `${riskData.meta.provider}/${riskData.meta.model}`
                  : "Smart Agile Analyzer"}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {riskData.report.summary}
            </p>

            {riskData.report.stalledIssueIdentifiers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Issue đang bị kẹt cần xử lý
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {riskData.report.stalledIssueIdentifiers.map((key) => {
                    const id = issueIdByIdentifier.get(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (id) openIssueDrawer(id);
                        }}
                        className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:ring-2 hover:ring-rose-400/50 transition cursor-pointer"
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Khuyến nghị hành động
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                {riskData.report.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          analytics.stalledIssues.length > 0 && (
            <div className="pt-2 border-t border-purple-200/50 dark:border-purple-900/40 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                Tín hiệu sớm:
              </span>
              {analytics.stalledIssues.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => openIssueDrawer(st.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100/80 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-mono font-bold hover:underline cursor-pointer"
                >
                  {st.identifier} ({Math.round(st.hoursStalled / 24)}d kẹt)
                </button>
              ))}
            </div>
          )
        )}
      </section>

      {/* Row 3: Burndown & Velocity Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Burndown Chart */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-bold">
              Sprint Burndown Chart{" "}
              {analytics.selectedSprint
                ? `— ${analytics.selectedSprint.name}`
                : ""}
            </h3>
            <p className="text-[11px] text-slate-500">
              So sánh Story Points còn lại thực tế với đường mục tiêu lý tưởng.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 520, height: 240 }}
            >
              <ComposedChart data={analytics.burndown}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="idealPoints"
                  name="Mục tiêu lý tưởng"
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="remainingPoints"
                  name="Còn lại thực tế"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Velocity Chart */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-bold">Biểu đồ Team Velocity</h3>
            <p className="text-[11px] text-slate-500">
              Story Points cam kết so với hoàn thành qua các Sprint.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 520, height: 240 }}
            >
              <BarChart data={analytics.velocity}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  dataKey="plannedPoints"
                  name="Cam kết (pts)"
                  fill="#94a3b8"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="completedPoints"
                  name="Hoàn thành (pts)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Row 4: Workload & GitHub PR Webhook Simulator */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Workload Balance */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            Phân bổ tải công việc (Workload)
          </h3>

          <div className="space-y-2.5">
            {analytics.workload.map((item) => {
              const pct =
                item.totalPoints > 0
                  ? Math.round((item.completedPoints / item.totalPoints) * 100)
                  : 0;
              return (
                <div
                  key={item.assigneeId ?? "unassigned"}
                  className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                        {getInitials(item.assigneeName)}
                      </span>
                      <span className="font-semibold">{item.assigneeName}</span>
                      {item.overdueCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          {item.overdueCount} quá hạn
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-slate-500">
                      {item.completedPoints}/{item.totalPoints} pts (
                      {item.totalIssues} issues)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive GitHub Smart PR Automation Simulator */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-emerald-500" />
              GitHub Smart PR Webhook Simulator
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Chạy thử luồng Webhook thật: bắt mã <code>ENG-xx</code>, gắn thẻ
              PR và tự động chuyển cột sang <strong>In Review</strong> hoặc{" "}
              <strong>Done</strong>.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="sim-issue"
                className="block text-[11px] font-semibold text-slate-500 mb-1"
              >
                Chọn Issue mục tiêu
              </label>
              <select
                id="sim-issue"
                disabled={!canWrite || nonEpicIssues.length === 0}
                value={resolvedSimKey}
                onChange={(e) => setSimIssueKey(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {nonEpicIssues.map((i) => (
                  <option key={i.id} value={i.identifier}>
                    {i.identifier} ({i.state?.name ?? "..."}) — {i.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimAction("opened")}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  simAction === "opened"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                Mở PR → Review
              </button>
              <button
                type="button"
                onClick={() => setSimAction("merged")}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  simAction === "merged"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                Merge → Done
              </button>
            </div>

            <button
              type="button"
              disabled={!canWrite || !resolvedSimKey || simulatePr.isPending}
              onClick={() =>
                simulatePr.mutate({
                  issueIdentifier: resolvedSimKey,
                  action: simAction,
                })
              }
              className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
            >
              {simulatePr.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitPullRequest className="w-3.5 h-3.5" />
              )}
              Chạy đồng bộ GitHub PR
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
