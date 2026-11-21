import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { hasMinimumRole, type WorkspaceRole } from "@taskmanager/shared";
import { AtSign, Send, Trash2 } from "lucide-react";
import {
  useCreateComment,
  useDeleteComment,
} from "../../hooks/useAgileQueries";
import { formatRelativeTimeVN, getInitials } from "../../lib/agileMeta";
import type { IssueDetailDto, WorkspaceMemberDto } from "../../lib/api";

interface CommentsSectionProps {
  issueId: string;
  projectId: string | null;
  role: WorkspaceRole;
  currentUserId: string;
  comments: IssueDetailDto["comments"];
  members: WorkspaceMemberDto[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMentionText(
  text: string,
  memberNames: string[],
): ReactNode[] {
  const sortedNames = [...memberNames].sort((a, b) => b.length - a.length);
  const nameAlternation = sortedNames.map(escapeRegex).join("|");
  const mentionPattern = nameAlternation
    ? new RegExp(`(@(?:${nameAlternation}|[\\w.-]+))`, "gi")
    : /(@[\w.-]+)/gi;

  const parts = text.split(mentionPattern);
  return parts.map((part, idx) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span
          key={idx}
          className="inline-block px-1 py-0.2 rounded bg-blue-100/80 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function CommentsSection({
  issueId,
  projectId,
  role,
  currentUserId,
  comments,
  members,
}: CommentsSectionProps) {
  const createComment = useCreateComment(projectId);
  const deleteComment = useDeleteComment(projectId);

  const canWrite = hasMinimumRole(role, "member");
  const canModerate = hasMinimumRole(role, "admin");

  const [text, setText] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const memberNames = useMemo(
    () => members.map((m) => m.user.name),
    [members],
  );

  // Detect active `@query` immediately before cursor
  const mentionMatch = useMemo(() => {
    const beforeCursor = text.slice(0, cursorPos);
    const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return null;
    const query = match[1] ?? "";
    const startIndex = beforeCursor.length - query.length - 1;
    return { query, startIndex };
  }, [text, cursorPos]);

  const mentionCandidates = useMemo(() => {
    if (!mentionMatch) return [];
    const q = mentionMatch.query.toLowerCase();
    return members
      .filter(
        (m) =>
          m.user.name.toLowerCase().includes(q) ||
          m.user.email.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [mentionMatch, members]);

  const isMentionOpen = Boolean(mentionMatch && mentionCandidates.length > 0);
  const safeMentionIdx = Math.min(
    mentionIndex,
    Math.max(0, mentionCandidates.length - 1),
  );

  const insertMention = (memberName: string) => {
    if (!mentionMatch) return;
    const prefix = text.slice(0, mentionMatch.startIndex);
    const suffix = text.slice(cursorPos);
    const inserted = `@${memberName} `;
    const nextText = `${prefix}${inserted}${suffix}`;
    const nextCursor = prefix.length + inserted.length;

    setText(nextText);
    setCursorPos(nextCursor);
    setMentionIndex(0);

    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || !canWrite) return;
    createComment.mutate(
      { issueId, bodyMd: trimmed },
      {
        onSuccess: () => {
          setText("");
          setCursorPos(0);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="py-5 text-center text-xs text-slate-400">
          Chưa có bình luận nào. Hãy gõ <code>@</code> để nhắc thành viên.
        </p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((c) => {
            const authorName = c.author?.name ?? "Thành viên";
            const canDelete = c.author?.id === currentUserId || canModerate;

            return (
              <article
                key={c.id}
                className="group p-3 rounded-xl bg-slate-50/90 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                      {getInitials(authorName)}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {authorName}
                    </span>
                    <time
                      dateTime={c.createdAt}
                      className="text-[11px] text-slate-400"
                    >
                      {formatRelativeTimeVN(c.createdAt)}
                    </time>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      disabled={deleteComment.isPending}
                      onClick={() =>
                        deleteComment.mutate({ commentId: c.id, issueId })
                      }
                      aria-label="Xóa bình luận"
                      title="Xóa bình luận"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-7">
                  {renderMentionText(c.bodyMd, memberNames)}
                </p>
              </article>
            );
          })}
        </div>
      )}

      {canWrite && (
        <div className="relative pt-1">
          {/* @mention Autocomplete Popover */}
          {isMentionOpen && (
            <div
              role="listbox"
              aria-label="Nhắc thành viên"
              className="absolute bottom-full left-0 mb-1.5 w-72 max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 z-20"
            >
              {mentionCandidates.map((member, idx) => {
                const selected = idx === safeMentionIdx;
                return (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setMentionIndex(idx)}
                    onClick={() => insertMention(member.user.name)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${
                      selected
                        ? "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {getInitials(member.user.name)}
                    </span>
                    <span className="truncate flex-1">{member.user.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <AtSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                aria-label="Nội dung bình luận"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setCursorPos(e.target.selectionStart ?? e.target.value.length);
                  setMentionIndex(0);
                }}
                onClick={(e) => {
                  const target = e.currentTarget;
                  setCursorPos(target.selectionStart ?? text.length);
                }}
                onKeyDown={(e) => {
                  if (isMentionOpen) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionIndex((i) =>
                        Math.min(i + 1, mentionCandidates.length - 1),
                      );
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionIndex((i) => Math.max(i - 1, 0));
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      const chosen = mentionCandidates[safeMentionIdx];
                      if (chosen) {
                        e.preventDefault();
                        insertMention(chosen.user.name);
                        return;
                      }
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setCursorPos(0);
                      return;
                    }
                  }

                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Viết bình luận... (gõ @ để nhắc thành viên)"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <button
              type="button"
              disabled={!text.trim() || createComment.isPending}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Gửi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
