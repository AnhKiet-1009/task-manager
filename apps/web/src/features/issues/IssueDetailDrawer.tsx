import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  formatGitBranchName,
  hasMinimumRole,
  ISSUE_PRIORITIES,
  ISSUE_RELATION_TYPES,
  ISSUE_TYPES,
  type IssuePriority,
  type IssueRelationType,
  type IssueType,
  STORY_POINT_SCALE,
  type WorkspaceRole,
} from "@taskmanager/shared";
import {
  ArrowUpRight,
  Check,
  Copy,
  GitBranch,
  GitMerge,
  GitPullRequest,
  History,
  Link2,
  ListTree,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  useCreateIssue,
  useCreateIssueRelation,
  useDeleteIssue,
  useDeleteIssueRelation,
  useIssueDetail,
  useUpdateIssue,
} from "../../hooks/useAgileQueries";
import {
  ISSUE_PRIORITY_META,
  ISSUE_RELATION_INVERSE_LABEL,
  ISSUE_RELATION_LABEL,
  ISSUE_TYPE_META,
} from "../../lib/agileMeta";
import type {
  IssueDetailDto,
  IssueListItem,
  LabelDto,
  SprintDto,
  WorkflowStateDto,
  WorkspaceMemberDto,
} from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";
import { ActivityTimeline } from "./ActivityTimeline";
import { CommentsSection } from "./CommentsSection";
import { RichTextEditor } from "./RichTextEditor";

interface IssueDetailDrawerProps {
  projectId: string | null;
  role: WorkspaceRole;
  currentUserId: string;
  workflowStates: WorkflowStateDto[];
  sprints: SprintDto[];
  labels: LabelDto[];
  members: WorkspaceMemberDto[];
  allIssues: IssueListItem[];
}

interface DrawerBodyProps extends IssueDetailDrawerProps {
  detail: IssueDetailDto;
  onClose: () => void;
  onOpenIssue: (issueId: string) => void;
}

function IssueDetailDrawerBody({
  projectId,
  role,
  currentUserId,
  workflowStates,
  sprints,
  labels,
  members,
  allIssues,
  detail,
  onClose,
  onOpenIssue,
}: DrawerBodyProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const canWrite = hasMinimumRole(role, "member");

  const updateIssue = useUpdateIssue(projectId);
  const deleteIssue = useDeleteIssue(projectId);
  const createSubIssue = useCreateIssue(projectId);
  const createRelation = useCreateIssueRelation(projectId);
  const deleteRelation = useDeleteIssueRelation(projectId);

  const [title, setTitle] = useState(detail.title);
  const [descriptionMd, setDescriptionMd] = useState(
    detail.descriptionMd ?? "",
  );
  const [copiedBranch, setCopiedBranch] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "activity">(
    "comments",
  );

  // Inline Sub-issue creation state
  const [addingSubIssue, setAddingSubIssue] = useState(false);
  const [subIssueTitle, setSubIssueTitle] = useState("");

  // Inline Relation creation state
  const [addingRelation, setAddingRelation] = useState(false);
  const [relationType, setRelationType] = useState<IssueRelationType>("blocks");
  const [relationTargetId, setRelationTargetId] = useState("");

  const isContentDirty =
    title.trim() !== detail.title ||
    descriptionMd !== (detail.descriptionMd ?? "");

  const stateById = new Map(workflowStates.map((s) => [s.id, s]));
  const epics = allIssues.filter(
    (i) => i.type === "epic" && i.id !== detail.id,
  );
  const relatableIssues = allIssues.filter((i) => i.id !== detail.id);

  const childDoneCount = detail.children.filter(
    (c) => stateById.get(c.stateId)?.category === "completed",
  ).length;
  const childPercent =
    detail.children.length > 0
      ? Math.round((childDoneCount / detail.children.length) * 100)
      : 0;

  const combinedRelations = [
    ...detail.relations.outgoing.map((r) => ({
      id: r.id,
      label: ISSUE_RELATION_LABEL[r.type],
      linkedIssue: r.targetIssue,
    })),
    ...detail.relations.incoming.map((r) => ({
      id: r.id,
      label: ISSUE_RELATION_INVERSE_LABEL[r.type],
      linkedIssue: r.sourceIssue,
    })),
  ];

  const handleSaveContent = () => {
    if (!canWrite || title.trim().length < 2) return;
    updateIssue.mutate({
      issueId: detail.id,
      input: {
        title: title.trim(),
        descriptionMd: descriptionMd.trim() || undefined,
      },
    });
  };

  const handleCopyBranch = async () => {
    const branch = formatGitBranchName(
      detail.identifier,
      title || detail.title,
      detail.type,
    );
    try {
      await navigator.clipboard.writeText(branch);
      setCopiedBranch(true);
      pushToast(`Đã sao chép nhánh: ${branch}`, "info");
      window.setTimeout(() => setCopiedBranch(false), 2000);
    } catch {
      pushToast(`Nhánh Git: ${branch}`, "info");
    }
  };

  const handleCreateSubIssue = (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || subIssueTitle.trim().length < 2) return;
    createSubIssue.mutate(
      {
        title: subIssueTitle.trim(),
        type: "subtask",
        priority: detail.priority,
        parentId: detail.id,
        sprintId: detail.sprintId,
      },
      {
        onSuccess: () => {
          setSubIssueTitle("");
          setAddingSubIssue(false);
        },
      },
    );
  };

  const handleCreateRelation = (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !relationTargetId) return;
    createRelation.mutate(
      {
        issueId: detail.id,
        targetIssueId: relationTargetId,
        type: relationType,
      },
      {
        onSuccess: () => {
          setRelationTargetId("");
          setAddingRelation(false);
        },
      },
    );
  };

  const toggleLabel = (labelId: string) => {
    if (!canWrite) return;
    const current = detail.labels.map((l) => l.id);
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    updateIssue.mutate({ issueId: detail.id, input: { labelIds: next } });
  };

  return (
    <div
      className="flex flex-col h-full"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          handleSaveContent();
        }
      }}
    >
      {/* Top Drawer Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {detail.parent && (
            <>
              <button
                type="button"
                onClick={() => onOpenIssue(detail.parent!.id)}
                className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                {detail.parent.identifier}
              </button>
              <span className="text-slate-400 text-xs">/</span>
            </>
          )}
          <span
            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${ISSUE_TYPE_META[detail.type].badgeClass}`}
          >
            {ISSUE_TYPE_META[detail.type].label}
          </span>
          <h2
            id="issue-drawer-heading"
            className="font-mono text-sm font-extrabold text-slate-900 dark:text-white"
          >
            {detail.identifier}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopyBranch()}
            title="Sao chép tên Git branch chuẩn Linear"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {copiedBranch ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <GitBranch className="w-3.5 h-3.5 text-blue-500" />
            )}
            <span>Copy Git Branch</span>
            <Copy className="w-3 h-3 opacity-60" />
          </button>

          {canWrite && (
            <button
              type="button"
              disabled={deleteIssue.isPending}
              onClick={() => deleteIssue.mutate(detail.id, { onSuccess: onClose })}
              title="Xóa Issue"
              aria-label="Xóa Issue"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng ngăn chi tiết Issue"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
        {/* Left Main Workspace */}
        <div className="lg:col-span-8 p-5 space-y-6 lg:border-r border-slate-200 dark:border-slate-800">
          {/* Editable Title + Tiptap Rich Description */}
          <div className="space-y-3">
            <input
              type="text"
              aria-label="Tiêu đề Issue"
              disabled={!canWrite}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-extrabold bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-800 focus:border-blue-500 rounded-lg px-2 py-1 -mx-2 focus:outline-none transition"
            />

            <RichTextEditor
              initialMarkdown={detail.descriptionMd ?? ""}
              editable={canWrite}
              onChange={setDescriptionMd}
            />

            {canWrite && isContentDirty && (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={updateIssue.isPending || title.trim().length < 2}
                  onClick={handleSaveContent}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {updateIssue.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Lưu mô tả & tiêu đề
                </button>
              </div>
            )}
          </div>

          {/* Sub-issues Section */}
          <section className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListTree className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Sub-issues ({detail.children.length})
                </h3>
                {detail.children.length > 0 && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    {childDoneCount}/{detail.children.length} xong ({childPercent}%)
                  </span>
                )}
              </div>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => setAddingSubIssue((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm Sub-issue
                </button>
              )}
            </div>

            {detail.children.length > 0 && (
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${childPercent}%` }}
                />
              </div>
            )}

            {detail.children.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
                {detail.children.map((child) => {
                  const childState = stateById.get(child.stateId);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onOpenIssue(child.id)}
                      className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-slate-500">
                          {child.identifier}
                        </span>
                        <span className="text-xs font-medium truncate">
                          {child.title}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {childState && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: childState.color }}
                            />
                            {childState.name}
                          </span>
                        )}
                        {child.storyPoints !== null && (
                          <span className="text-[11px] font-bold text-slate-400">
                            {child.storyPoints}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {addingSubIssue && canWrite && (
              <form onSubmit={handleCreateSubIssue} className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={subIssueTitle}
                  onChange={(e) => setSubIssueTitle(e.target.value)}
                  placeholder="Tiêu đề Sub-issue mới..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  disabled={
                    subIssueTitle.trim().length < 2 || createSubIssue.isPending
                  }
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Thêm
                </button>
                <button
                  type="button"
                  onClick={() => setAddingSubIssue(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
                  Hủy
                </button>
              </form>
            )}
          </section>

          {/* Issue Relations Section */}
          <section className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Liên kết Issue ({combinedRelations.length})
                </h3>
              </div>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => setAddingRelation((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm liên kết
                </button>
              )}
            </div>

            {combinedRelations.length > 0 && (
              <div className="space-y-1.5">
                {combinedRelations.map((rel) => {
                  const linkedState = stateById.get(rel.linkedIssue.stateId);
                  return (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenIssue(rel.linkedIssue.id)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                      >
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                          {rel.label}
                        </span>
                        <span className="font-mono font-bold text-slate-500 shrink-0">
                          {rel.linkedIssue.identifier}
                        </span>
                        <span className="truncate font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {rel.linkedIssue.title}
                        </span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0" />
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {linkedState && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            {linkedState.name}
                          </span>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            disabled={deleteRelation.isPending}
                            onClick={() =>
                              deleteRelation.mutate({
                                relationId: rel.id,
                                issueId: detail.id,
                                targetIssueId: rel.linkedIssue.id,
                              })
                            }
                            aria-label={`Gỡ liên kết ${rel.linkedIssue.identifier}`}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {addingRelation && canWrite && (
              <form
                onSubmit={handleCreateRelation}
                className="flex flex-wrap gap-2"
              >
                <select
                  aria-label="Loại liên kết"
                  value={relationType}
                  onChange={(e) =>
                    setRelationType(e.target.value as IssueRelationType)
                  }
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {ISSUE_RELATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ISSUE_RELATION_LABEL[t]}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Chọn Issue liên kết"
                  value={relationTargetId}
                  onChange={(e) => setRelationTargetId(e.target.value)}
                  className="flex-1 min-w-[180px] px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="">Chọn Issue...</option>
                  {relatableIssues.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.identifier} — {candidate.title}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={!relationTargetId || createRelation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Liên kết
                </button>
              </form>
            )}
          </section>

          {/* GitHub External Links */}
          {detail.externalLinks.length > 0 && (
            <section className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <GitPullRequest className="w-4 h-4 text-emerald-500" />
                GitHub Pull Requests ({detail.externalLinks.length})
              </h3>
              <div className="space-y-1.5">
                {detail.externalLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-blue-400 text-xs transition"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {link.status === "merged" ? (
                        <GitMerge className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      ) : (
                        <GitPullRequest className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-mono font-bold">
                        #{link.externalId}
                      </span>
                      <span className="truncate">{link.title}</span>
                    </span>
                    <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                      {link.status}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Tabbed Comments & Activity Timeline */}
          <section className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div
              role="tablist"
              aria-label="Hoạt động Issue"
              className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "comments"}
                onClick={() => setActiveTab("comments")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === "comments"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Bình luận ({detail.comments.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "activity"}
                onClick={() => setActiveTab("activity")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === "activity"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Lịch sử hoạt động ({detail.activityLogs.length})
              </button>
            </div>

            {activeTab === "comments" ? (
              <CommentsSection
                issueId={detail.id}
                projectId={projectId}
                role={role}
                currentUserId={currentUserId}
                comments={detail.comments}
                members={members}
              />
            ) : (
              <ActivityTimeline logs={detail.activityLogs} members={members} />
            )}
          </section>
        </div>

        {/* Right Instant-Updating Metadata Sidebar */}
        <aside className="lg:col-span-4 p-5 space-y-4 bg-slate-50/40 dark:bg-slate-950/30">
          <div>
            <label
              htmlFor="drawer-state"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Trạng thái
            </label>
            <select
              id="drawer-state"
              disabled={!canWrite}
              value={detail.stateId}
              onChange={(e) =>
                updateIssue.mutate({
                  issueId: detail.id,
                  input: { stateId: e.target.value },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
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
              htmlFor="drawer-priority"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Độ ưu tiên
            </label>
            <select
              id="drawer-priority"
              disabled={!canWrite}
              value={detail.priority}
              onChange={(e) =>
                updateIssue.mutate({
                  issueId: detail.id,
                  input: { priority: e.target.value as IssuePriority },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
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
              htmlFor="drawer-type"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Loại Issue
            </label>
            <select
              id="drawer-type"
              disabled={!canWrite}
              value={detail.type}
              onChange={(e) =>
                updateIssue.mutate({
                  issueId: detail.id,
                  input: { type: e.target.value as IssueType },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
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
              htmlFor="drawer-sprint"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Sprint
            </label>
            <select
              id="drawer-sprint"
              disabled={!canWrite}
              value={detail.sprintId ?? ""}
              onChange={(e) =>
                updateIssue.mutate({
                  issueId: detail.id,
                  input: { sprintId: e.target.value || null },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
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
              htmlFor="drawer-assignee"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Người phụ trách
            </label>
            <select
              id="drawer-assignee"
              disabled={!canWrite}
              value={detail.assigneeId ?? ""}
              onChange={(e) =>
                updateIssue.mutate({
                  issueId: detail.id,
                  input: { assigneeId: e.target.value || null },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="">Chưa gán</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>

          {detail.type !== "epic" && epics.length > 0 && (
            <div>
              <label
                htmlFor="drawer-epic"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
              >
                Epic cha
              </label>
              <select
                id="drawer-epic"
                disabled={!canWrite}
                value={detail.parentId ?? ""}
                onChange={(e) =>
                  updateIssue.mutate({
                    issueId: detail.id,
                    input: { parentId: e.target.value || null },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
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
            <label
              htmlFor="drawer-due"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Hạn chót
            </label>
            <input
              id="drawer-due"
              type="date"
              disabled={!canWrite}
              value={detail.dueDate?.slice(0, 10) ?? ""}
              onChange={(e) =>
                updateIssue.mutate({
                  issueId: detail.id,
                  input: { dueDate: e.target.value || null },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Story Points
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!canWrite}
                onClick={() =>
                  updateIssue.mutate({
                    issueId: detail.id,
                    input: { storyPoints: null },
                  })
                }
                className={`px-2 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                  detail.storyPoints === null
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 bg-white dark:bg-slate-900"
                }`}
              >
                —
              </button>
              {STORY_POINT_SCALE.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  disabled={!canWrite}
                  onClick={() =>
                    updateIssue.mutate({
                      issueId: detail.id,
                      input: { storyPoints: pt },
                    })
                  }
                  className={`min-w-[30px] px-2 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                    detail.storyPoints === pt
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {labels.length > 0 && (
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Nhãn (Labels)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const active = detail.labels.some((l) => l.id === label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => toggleLabel(label.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition cursor-pointer ${
                        active
                          ? "ring-2 ring-blue-500/40"
                          : "opacity-55 hover:opacity-100"
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
        </aside>
      </div>
    </div>
  );
}

export function IssueDetailDrawer(props: IssueDetailDrawerProps) {
  const issueDrawerId = useUiStore((s) => s.issueDrawerId);
  const closeIssueDrawer = useUiStore((s) => s.closeIssueDrawer);
  const openIssueDrawer = useUiStore((s) => s.openIssueDrawer);

  const detailQuery = useIssueDetail(issueDrawerId ?? undefined);

  useEffect(() => {
    if (!issueDrawerId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIssueDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [issueDrawerId, closeIssueDrawer]);

  if (!issueDrawerId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-drawer-heading"
      onClick={closeIssueDrawer}
    >
      <div
        className="w-full max-w-4xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {detailQuery.isLoading || !detailQuery.data ? (
          <div className="flex-1 flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 id="issue-drawer-heading" className="text-sm font-bold">
                Chi tiết Issue
              </h2>
              <button
                type="button"
                onClick={closeIssueDrawer}
                aria-label="Đóng ngăn chi tiết Issue"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang tải thông tin Issue...
            </div>
          </div>
        ) : (
          <IssueDetailDrawerBody
            key={`${detailQuery.data.id}-${detailQuery.data.updatedAt}`}
            {...props}
            detail={detailQuery.data}
            onClose={closeIssueDrawer}
            onOpenIssue={openIssueDrawer}
          />
        )}
      </div>
    </div>
  );
}
