import { useState } from "react";
import type { FormEvent } from "react";
import {
  AI_PROVIDERS,
  type AiProvider,
  hasMinimumRole,
  type WorkspaceRole,
} from "@taskmanager/shared";
import { KeyRound, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import {
  useAiSettings,
  useUpdateAiSettings,
} from "../../hooks/useAgileQueries";
import type { AiSettingsDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Google Gemini (Free Tier khuyến nghị)",
  groq: "Groq (Llama 3.3 siêu tốc)",
  openai: "OpenAI (GPT-4o-mini / GPT-4o)",
  anthropic: "Anthropic (Claude)",
  openrouter: "OpenRouter (Đa mô hình)",
};

function AiSettingsModalBody({
  workspaceId,
  role,
  settings,
  onClose,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  settings: AiSettingsDto;
  onClose: () => void;
}) {
  const canAdmin = hasMinimumRole(role, "admin");
  const updateSettings = useUpdateAiSettings(workspaceId);

  const [provider, setProvider] = useState<AiProvider>(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState("");

  const quotaPct = Math.min(
    100,
    Math.round((settings.quota.used / Math.max(1, settings.quota.limit)) * 100),
  );

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!canAdmin) return;
    updateSettings.mutate(
      {
        provider,
        model: model.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      },
      {
        onSuccess: () => {
          setApiKey("");
          onClose();
        },
      },
    );
  };

  return (
    <div className="flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-500" />
          Cấu hình AI Copilot & BYOK Vault
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cài đặt AI"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSave} className="p-5 space-y-4">
        {/* Quota Meter */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">Hạn mức Free Tier (24h)</span>
            <span className="font-mono font-bold">
              {settings.hasByokKey
                ? "Không giới hạn (BYOK)"
                : `${settings.quota.used}/${settings.quota.limit} lượt`}
            </span>
          </div>
          {!settings.hasByokKey && (
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${quotaPct}%` }}
              />
            </div>
          )}
          {settings.hasByokKey && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Đã mã hóa API Key riêng bằng AES-256-GCM trong cơ sở dữ liệu.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="ai-provider"
            className="block text-xs font-semibold mb-1"
          >
            Nhà cung cấp LLM
          </label>
          <select
            id="ai-provider"
            disabled={!canAdmin}
            value={provider}
            onChange={(e) => setProvider(e.target.value as AiProvider)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ai-model" className="block text-xs font-semibold mb-1">
            Model tùy chỉnh (để trống dùng mặc định)
          </label>
          <input
            id="ai-model"
            type="text"
            disabled={!canAdmin}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="VD: gemini-2.5-flash, llama-3.3-70b-versatile"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
        </div>

        <div>
          <label
            htmlFor="ai-byok-key"
            className="block text-xs font-semibold mb-1"
          >
            API Key riêng (BYOK — mã hóa AES-256-GCM)
          </label>
          <input
            id="ai-byok-key"
            type="password"
            disabled={!canAdmin}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              settings.hasByokKey
                ? "•••••••••••••••••••• (Nhập key mới để thay thế)"
                : "Dán API Key từ Google AI Studio / Groq / OpenAI..."
            }
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
        </div>

        {!canAdmin && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Chỉ quản trị viên (Admin / Owner) mới có quyền thay đổi khóa BYOK
            của Workspace.
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          {canAdmin && settings.hasByokKey ? (
            <button
              type="button"
              disabled={updateSettings.isPending}
              onClick={() =>
                updateSettings.mutate(
                  { provider, clearKey: true },
                  { onSuccess: onClose },
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa BYOK Key
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Đóng
            </button>
            {canAdmin && (
              <button
                type="submit"
                disabled={updateSettings.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {updateSettings.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Lưu cấu hình
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export function AiSettingsModal({
  workspaceId,
  role,
}: {
  workspaceId: string | null;
  role: WorkspaceRole;
}) {
  const open = useUiStore((s) => s.aiSettingsModalOpen);
  const setOpen = useUiStore((s) => s.setAiSettingsModalOpen);
  const settingsQuery = useAiSettings(open ? workspaceId : null);

  if (!open || !workspaceId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Cấu hình AI BYOK"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {settingsQuery.isLoading || !settingsQuery.data ? (
          <div className="py-14 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang tải cấu hình AI...
          </div>
        ) : (
          <AiSettingsModalBody
            key={`${workspaceId}-${settingsQuery.data.provider}-${String(settingsQuery.data.hasByokKey)}`}
            workspaceId={workspaceId}
            role={role}
            settings={settingsQuery.data}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
