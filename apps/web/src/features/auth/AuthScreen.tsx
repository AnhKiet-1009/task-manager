import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  GitPullRequest,
  Kanban,
  Loader2,
  Moon,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import {
  useLaunchSandbox,
  useSignInEmail,
  useSignUpEmail,
} from "../../hooks/useAgileQueries";
import { useTheme } from "../../hooks/useTheme";

export function AuthScreen() {
  const { theme, toggleTheme } = useTheme();
  const launchSandbox = useLaunchSandbox();
  const signIn = useSignInEmail();
  const signUp = useSignUpEmail();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isBusy =
    launchSandbox.isPending || signIn.isPending || signUp.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFormError("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }
    if (password.length < 8) {
      setFormError("Mật khẩu cần tối thiểu 8 ký tự.");
      return;
    }

    if (mode === "signup") {
      if (name.trim().length < 2) {
        setFormError("Tên hiển thị cần tối thiểu 2 ký tự.");
        return;
      }
      signUp.mutate({ name: name.trim(), email: trimmedEmail, password });
    } else {
      signIn.mutate({ email: trimmedEmail, password });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top minimal bar */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight">
              TaskManager
            </span>
            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Agile AI
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Chuyển chế độ sáng/tối"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </header>

      {/* Main split content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Vision Column */}
          <section className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900">
              <Sparkles className="w-3.5 h-3.5" />
              AI-First Agile PM cho đội ngũ kỹ thuật
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Nhanh như{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
                Linear
              </span>
              , sâu như{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">
                Jira
              </span>{" "}
              — sẵn sàng cho kỷ nguyên AI.
            </h1>

            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
              Quản lý Sprint, Backlog, Epic và bảng Kanban kéo-thả O(1) với
              LexoRank, tối ưu Optimistic UI 0ms, tích hợp GitHub PR và nền tảng
              AI Copilot hỗ trợ bóc tách PRD & cảnh báo rủi ro Sprint.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <Kanban className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
                <h2 className="font-bold text-xs mb-1">Kanban LexoRank O(1)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cột tùy biến theo 5 nhóm ngữ nghĩa, giới hạn WIP & Optimistic
                  UI tức thì.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <GitPullRequest className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
                <h2 className="font-bold text-xs mb-1">Smart GitHub Sync</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Copy git branch 1-click, gắn PR tự động theo mã{" "}
                  <code>ENG-42</code>.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2" />
                <h2 className="font-bold text-xs mb-1">Multi-Tenant RBAC</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Phân quyền 4 vai trò (Owner/Admin/Member/Viewer) trên
                  PostgreSQL.
                </p>
              </div>
            </div>
          </section>

          {/* Right Auth & Sandbox Card */}
          <section className="lg:col-span-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-5">
              {/* 1-Click Demo Sandbox CTA */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => launchSandbox.mutate()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition cursor-pointer"
                >
                  {launchSandbox.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang khởi tạo dữ liệu Agile mẫu...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Trải nghiệm Demo 1-Click
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                  Không cần đăng ký — mở ngay Workspace mẫu với Active Sprint,
                  18 Issues, Epics & GitHub PRs.
                </p>
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
                <span className="px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  hoặc tài khoản thật
                </span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800" />
              </div>

              {/* Sign In / Sign Up Tabs */}
              <div className="grid grid-cols-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setFormError(null);
                  }}
                  className={`py-1.5 rounded-md transition cursor-pointer ${
                    mode === "signin"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setFormError(null);
                  }}
                  className={`py-1.5 rounded-md transition cursor-pointer ${
                    mode === "signup"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Đăng ký
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
                {mode === "signup" && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Họ và tên
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Trương Anh Kiệt"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.dev"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Mật khẩu (tối thiểu 8 ký tự)
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="text-xs font-medium text-rose-600 dark:text-rose-400"
                  >
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition cursor-pointer"
                >
                  {(signIn.isPending || signUp.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản mới"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
