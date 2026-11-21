# AI-First Agile PM Platform (TaskManager Monorepo)

Nền tảng quản lý dự án **AI-First Agile PM** dành cho đội ngũ kỹ thuật (Sprint, Backlog, Epics, Story Points, Smart GitHub PR Automation & AI Copilot), được nâng cấp từ ứng dụng Task Manager cá nhân lên kiến trúc **TypeScript Monorepo** sẵn sàng mở rộng thương mại với chi phí vận hành **\$0**.

---

## Kiến trúc Monorepo

```text
TaskManager/
├── apps/
│   ├── web/              # Frontend SPA (React 19, Vite 8, Tailwind CSS v4, Vitest)
│   └── api/              # Backend API (Hono — chạy cả Node.js & Cloudflare Workers Free)
├── packages/
│   ├── shared/           # Zod schemas, Domain enums, LexoRank O(1), GitHub branch/key parser
│   └── db/               # Drizzle ORM PostgreSQL Schema (Agile-Native Unified Graph)
├── .github/workflows/    # GitHub Actions CI (build, typecheck, lint, test)
├── docker-compose.yml    # PostgreSQL 16 (pgvector) + Redis 7 cho môi trường local
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Tech Stack Cốt Lõi

| Tầng hệ thống | Công nghệ | Vai trò |
| :--- | :--- | :--- |
| **Monorepo** | `pnpm workspaces` + `Turborepo` | Quản lý đa package, build cache thông minh |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4 | Giao diện tốc độ cao, Optimistic UI |
| **Backend API** | Hono + Zod + SSE EventBus | End-to-end Type-safe RPC, 0ms cold-start trên Cloudflare Workers |
| **Database** | Drizzle ORM + PostgreSQL (`pgvector` ready) | Unified Issue Graph, LexoRank, Activity Logs, JSONB Custom Properties |
| **Testing & CI** | Vitest + React Testing Library + GitHub Actions | Tự động kiểm thử toàn bộ Monorepo |

---

## Hướng dẫn Cài đặt & Chạy Local

### 1. Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v11+
- [Docker](https://www.docker.com/) (tùy chọn — để chạy PostgreSQL + Redis local)

### 2. Cài đặt dependencies
```bash
pnpm install
```

### 3. Cấu hình biến môi trường & hạ tầng local
```bash
cp .env.example .env
docker compose up -d
```

### 4. Chạy môi trường phát triển (Web + API song song)
```bash
pnpm dev
# Hoặc chạy riêng từng ứng dụng:
pnpm dev:web   # http://localhost:5173
pnpm dev:api   # http://localhost:8787
```

### 5. Kiểm tra chất lượng toàn Monorepo
```bash
pnpm build       # Build tất cả packages & apps
pnpm typecheck   # Kiểm tra TypeScript toàn bộ workspace
pnpm lint        # Chạy ESLint
pnpm test        # Chạy toàn bộ Vitest suite (web, api, shared)
```

---

## Lộ trình Phát triển

- [x] **Giai đoạn 0**: Chuyển đổi Monorepo (`pnpm` + `Turborepo`), lõi `@taskmanager/shared` (LexoRank, Zod, GitHub parser), toàn bộ Drizzle PostgreSQL Schema (`@taskmanager/db`), khung Hono API + Realtime SSE (`@taskmanager/api`), Docker & CI.
- [x] **Giai đoạn 1**: Tích hợp Better Auth (GitHub OAuth + Email + RBAC 4 vai trò), 1-Click Demo Sandbox Workspace (PGlite zero-Docker dev & Neon Edge), và trọn bộ CRUD APIs (Workspaces, Projects, Workflow States, Sprints, Issues với LexoRank O(1) & WIP Warning).
- [x] **Giai đoạn 2**: Nâng cấp Frontend sang Core Agile Suite (`@dnd-kit` + LexoRank O(1), cảnh báo WIP Limit, Backlog & Sprint Planning, Epics Roadmap, Optimistic UI + IndexedDB persist, Zustand, Auth + 1-Click Sandbox, Command Palette `Ctrl+K`).
- [x] **Giai đoạn 3**: Issue Detail Drawer chuyên sâu (Tiptap v3 Rich Text Markdown, Sub-issues inline, Issue Relations, Comments kèm `@mention` autocomplete & RBAC delete, Activity Log Timeline) + Realtime SSE đồng bộ đa tab với trạng thái `Live`.
- [x] **Giai đoạn 4**: 3 Trụ cột AI Copilot bằng Vercel AI SDK v7 + Zod Structured Output & Smart Fallback (PRD-to-Backlog tạo hàng loạt Epic/Issues/Relations, AI Sprint Risk & Bottleneck Radar, Natural Language Filter), Sprint Analytics (Recharts Burndown, Velocity, Workload), Kho mã hóa BYOK AES-256-GCM (Web Crypto) kèm Rate-limit 15 lượt/ngày, và GitHub Smart PR Webhook (xác thực HMAC-SHA256 + PR Simulator).
- [ ] **Giai đoạn 5**: E2E Testing (Playwright), triển khai Live (\$0 trên Cloudflare + Neon + Upstash) & Case Study kỹ thuật.

---

## Tác giả

- **Trương Anh Kiệt** — GitHub: [@AnhKiet-1009](https://github.com/AnhKiet-1009)
