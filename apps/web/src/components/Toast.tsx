import { CheckCircle2, Info, RotateCcw, AlertTriangle, X } from "lucide-react";
import { useTasks } from "../hooks/useTasks";

export function Toast() {
  const { toast, undoLastAction, dismissToast } = useTasks();

  if (!toast) return null;

  const styleByType = {
    success:
      "bg-slate-900 dark:bg-slate-800 text-white border-emerald-500/40",
    warning:
      "bg-slate-900 dark:bg-slate-800 text-white border-amber-500/40",
    error: "bg-rose-950 text-rose-100 border-rose-500/50",
    info: "bg-slate-900 dark:bg-slate-800 text-white border-blue-500/40",
  }[toast.type];

  const Icon =
    toast.type === "success"
      ? CheckCircle2
      : toast.type === "warning" || toast.type === "error"
        ? AlertTriangle
        : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-50 max-w-md flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl ${styleByType}`}
    >
      <Icon className="w-4 h-4 shrink-0 text-blue-400" />
      <p className="text-sm font-medium flex-1">{toast.message}</p>

      {toast.canUndo && (
        <button
          type="button"
          onClick={undoLastAction}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Hoàn tác
        </button>
      )}

      <button
        type="button"
        onClick={dismissToast}
        aria-label="Đóng thông báo"
        className="text-slate-400 hover:text-white transition cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
