import { useState } from "react";
import type { FormEvent } from "react";
import { FolderPlus, Loader2, X } from "lucide-react";
import {
  useCreateProject,
  useCreateWorkspace,
} from "../../hooks/useAgileQueries";
import { useUiStore } from "../../stores/uiStore";

function toSlug(val: string): string {
  return val
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function WorkspaceProjectModal({
  workspaceId,
}: {
  workspaceId: string | null;
}) {
  const modal = useUiStore((s) => s.workspaceProjectModal);
  const close = useUiStore((s) => s.closeWorkspaceProjectModal);

  const createWorkspace = useCreateWorkspace();
  const createProject = useCreateProject(workspaceId);

  const [name, setName] = useState("");
  const [slugOrKey, setSlugOrKey] = useState("");
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!modal.open) return null;

  const isWorkspace = modal.mode === "workspace";
  const isPending = createWorkspace.isPending || createProject.isPending;

  const handleNameChange = (value: string) => {
    setName(value);
    if (isWorkspace) {
      setSlugOrKey(toSlug(value));
    } else if (!slugOrKey || slugOrKey.length <= 4) {
      const letters = value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 4);
      setSlugOrKey(letters);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Tên phải có tối thiểu 2 ký tự.");
      return;
    }

    if (isWorkspace) {
      const slug = slugOrKey.trim().toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        setError("Slug chỉ gồm chữ thường, số và dấu gạch ngang.");
        return;
      }
      createWorkspace.mutate(
        { name: name.trim(), slug },
        {
          onSuccess: () => {
            setName("");
            setSlugOrKey("");
            close();
          },
        },
      );
    } else {
      const key = slugOrKey.trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
        setError("Project Key gồm 2–10 ký tự in hoa, bắt đầu bằng chữ cái (VD: ENG, APP).");
        return;
      }
      createProject.mutate(
        {
          name: name.trim(),
          key,
          githubRepoFullName: repo.trim() || undefined,
        },
        {
          onSuccess: () => {
            setName("");
            setSlugOrKey("");
            setRepo("");
            close();
          },
        },
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-blue-600" />
            {isWorkspace ? "Tạo Workspace mới" : "Tạo Project Agile mới"}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng hộp thoại"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label
              htmlFor="wp-name"
              className="block text-xs font-semibold mb-1"
            >
              {isWorkspace ? "Tên Workspace" : "Tên Project"}
            </label>
            <input
              id="wp-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={isWorkspace ? "VD: Acme Engineering" : "VD: Mobile App"}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div>
            <label
              htmlFor="wp-key"
              className="block text-xs font-semibold mb-1"
            >
              {isWorkspace ? "Đường dẫn Slug" : "Project Key (Mã tiền tố Issue)"}
            </label>
            <input
              id="wp-key"
              type="text"
              value={slugOrKey}
              onChange={(e) => setSlugOrKey(e.target.value)}
              placeholder={isWorkspace ? "acme-engineering" : "APP"}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          {!isWorkspace && (
            <div>
              <label
                htmlFor="wp-repo"
                className="block text-xs font-semibold mb-1"
              >
                GitHub Repository (tùy chọn)
              </label>
              <input
                id="wp-repo"
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo-name"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isWorkspace ? "Tạo Workspace" : "Tạo Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
