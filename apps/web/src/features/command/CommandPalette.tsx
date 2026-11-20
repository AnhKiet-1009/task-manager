import { useEffect, useMemo, useRef, useState } from "react";
import { hasMinimumRole, type WorkspaceRole } from "@taskmanager/shared";
import {
  Kanban,
  Layers,
  Moon,
  Plus,
  Search,
  Sun,
  Target,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import type { IssueListItem } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

interface CommandItem {
  id: string;
  group: "Hành động nhanh" | "Chuyển màn hình" | "Issues trong Project";
  label: string;
  hint?: string;
  icon: typeof Kanban;
  onSelect: () => void;
}

interface CommandPaletteProps {
  issues: IssueListItem[];
  role: WorkspaceRole;
}

function CommandPaletteDialog({
  issues,
  role,
  onClose,
}: CommandPaletteProps & { onClose: () => void }) {
  const setActiveView = useUiStore((s) => s.setActiveView);
  const openCreateIssueModal = useUiStore((s) => s.openCreateIssueModal);
  const openEditIssueModal = useUiStore((s) => s.openEditIssueModal);
  const openSprintModal = useUiStore((s) => s.openSprintModal);
  const openWorkspaceProjectModal = useUiStore(
    (s) => s.openWorkspaceProjectModal,
  );
  const { theme, toggleTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canWrite = hasMinimumRole(role, "member");
  const canAdmin = hasMinimumRole(role, "admin");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      {
        id: "nav-board",
        group: "Chuyển màn hình",
        label: "Mở Active Sprint Board (Kanban)",
        icon: Kanban,
        onSelect: () => setActiveView("board"),
      },
      {
        id: "nav-backlog",
        group: "Chuyển màn hình",
        label: "Mở Backlog & Sprint Planning",
        icon: Layers,
        onSelect: () => setActiveView("backlog"),
      },
      {
        id: "nav-epics",
        group: "Chuyển màn hình",
        label: "Mở Epics Roadmap",
        icon: Target,
        onSelect: () => setActiveView("epics"),
      },
      {
        id: "act-theme",
        group: "Hành động nhanh",
        label:
          theme === "dark"
            ? "Chuyển sang Giao diện Sáng"
            : "Chuyển sang Giao diện Tối",
        icon: theme === "dark" ? Sun : Moon,
        onSelect: toggleTheme,
      },
    ];

    if (canWrite) {
      base.unshift(
        {
          id: "act-create-issue",
          group: "Hành động nhanh",
          label: "Tạo Issue mới",
          hint: "N",
          icon: Plus,
          onSelect: () => openCreateIssueModal(),
        },
        {
          id: "act-create-sprint",
          group: "Hành động nhanh",
          label: "Tạo Sprint mới",
          icon: Plus,
          onSelect: () => openSprintModal(),
        },
      );
    }

    if (canAdmin) {
      base.push({
        id: "act-create-project",
        group: "Hành động nhanh",
        label: "Tạo Project mới trong Workspace",
        icon: Plus,
        onSelect: () => openWorkspaceProjectModal("project"),
      });
    }

    const issueItems: CommandItem[] = issues.slice(0, 30).map((issue) => ({
      id: `issue-${issue.id}`,
      group: "Issues trong Project",
      label: `${issue.identifier} — ${issue.title}`,
      hint: issue.state?.name,
      icon: Search,
      onSelect: () => openEditIssueModal(issue.id),
    }));

    const combined = [...base, ...issueItems];
    const q = query.trim().toLowerCase();
    if (!q) return combined.slice(0, 12);

    return combined
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          (item.hint?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 15);
  }, [
    issues,
    query,
    canWrite,
    canAdmin,
    theme,
    toggleTheme,
    setActiveView,
    openCreateIssueModal,
    openEditIssueModal,
    openSprintModal,
    openWorkspaceProjectModal,
  ]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));

  const executeItem = (item: CommandItem) => {
    onClose();
    item.onSelect();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 bg-slate-950/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && items[safeIndex]) {
                e.preventDefault();
                executeItem(items[safeIndex]!);
              }
            }}
            placeholder="Gõ lệnh hoặc tìm Issue (VD: ENG-12, Tạo Sprint, Backlog)..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Không tìm thấy lệnh hoặc Issue phù hợp.
            </p>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === safeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => executeItem(item)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-75" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {item.hint ?? item.group}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function CommandPalette({ issues, role }: CommandPaletteProps) {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggle = useUiStore((s) => s.toggleCommandPalette);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen, toggle]);

  if (!open) return null;

  return (
    <CommandPaletteDialog
      issues={issues}
      role={role}
      onClose={() => setOpen(false)}
    />
  );
}
