import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  Bookmark,
  Bug,
  Calendar,
  CheckSquare,
  GitMerge,
  GitPullRequest,
  Layers,
  ListTree,
} from "lucide-react";
import {
  formatShortDateVN,
  getInitials,
  isIssueOverdue,
  ISSUE_PRIORITY_META,
  ISSUE_TYPE_META,
} from "../../lib/agileMeta";
import type { IssueListItem } from "../../lib/api";

const TYPE_ICON = {
  epic: Layers,
  story: Bookmark,
  task: CheckSquare,
  bug: Bug,
  subtask: ListTree,
} as const;

interface IssueCardProps {
  issue: IssueListItem;
  canDrag: boolean;
  onSelect: (issueId: string) => void;
  isOverlay?: boolean;
}

export function IssueCard({
  issue,
  canDrag,
  onSelect,
  isOverlay = false,
}: IssueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: { type: "issue", issue },
    disabled: !canDrag || isOverlay,
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const TypeIcon = TYPE_ICON[issue.type];
  const typeMeta = ISSUE_TYPE_META[issue.type];
  const priorityMeta = ISSUE_PRIORITY_META[issue.priority];
  const overdue = isIssueOverdue(issue);
  const primaryPr = issue.externalLinks[0];

  return (
    <article
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={() => {
        if (!isDragging) onSelect(issue.id);
      }}
      data-testid={`issue-card-${issue.identifier}`}
      className={`group rounded-xl border bg-white dark:bg-slate-900 p-3 shadow-xs transition select-none ${
        isOverlay
          ? "border-blue-500 shadow-2xl ring-2 ring-blue-500/30 rotate-1 cursor-grabbing"
          : isDragging
            ? "opacity-35 border-dashed border-blue-400"
            : "border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm cursor-pointer"
      }`}
    >
      {/* Top Row: Type + Identifier + Points */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <TypeIcon className={`w-3.5 h-3.5 shrink-0 ${typeMeta.colorClass}`} />
          <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {issue.identifier}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityMeta.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dotClass}`} />
            {priorityMeta.label}
          </span>
        </div>

        {issue.storyPoints !== null && (
          <span
            title={`${issue.storyPoints} Story Points`}
            className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300"
          >
            {issue.storyPoints}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {issue.title}
      </h3>

      {/* Labels + GitHub PR Pill */}
      {(issue.labels.length > 0 || primaryPr) && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {issue.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border"
              style={{
                borderColor: `${label.color}40`,
                backgroundColor: `${label.color}18`,
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}

          {primaryPr && (
            <a
              href={primaryPr.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md border ${
                primaryPr.status === "merged"
                  ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                  : primaryPr.status === "draft"
                    ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              }`}
            >
              {primaryPr.status === "merged" ? (
                <GitMerge className="w-3 h-3" />
              ) : (
                <GitPullRequest className="w-3 h-3" />
              )}
              #{primaryPr.externalId}
            </a>
          )}
        </div>
      )}

      {/* Footer Metadata: Due Date, Sub-issues, Assignee */}
      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          {issue.dueDate && (
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                overdue ? "text-rose-600 dark:text-rose-400 font-semibold" : ""
              }`}
            >
              {overdue ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              {formatShortDateVN(issue.dueDate)}
            </span>
          )}
          {issue.subIssueCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListTree className="w-3 h-3" />
              {issue.subIssueCount}
            </span>
          )}
        </div>

        {issue.assignee ? (
          <span
            title={issue.assignee.name}
            className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0"
          >
            {getInitials(issue.assignee.name)}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 italic">Chưa gán</span>
        )}
      </div>
    </article>
  );
}
