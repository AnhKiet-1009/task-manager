# Hướng dẫn Triển khai Production chi phí \$0 (Cloudflare + Neon + Upstash)

Tài liệu này hướng dẫn từng bước đưa **TaskManager (AI-First Agile PM Platform)** lên môi trường Production thật bằng 100% gói miễn phí (Free Tier) — không phát sinh chi phí thẻ tín dụng và giữ nguyên khả năng nâng cấp thương mại không cần viết lại code.

---

## Kiến trúc Hạ tầng Production (\$0/tháng)

| Thành phần | Dịch vụ Free Tier | Vai trò & Giới hạn miễn phí |
| :--- | :--- | :--- |
| **PostgreSQL** | [Neon](https://neon.tech/) Free | 0.5 GB storage, Serverless WebSocket/HTTP, branching, sẵn sàng `pgvector` |
| **Backend Edge API** | [Cloudflare Workers](https://workers.cloudflare.com/) Free | Hono + Better Auth + AI Copilot (`apps/api/src/worker.ts`), **100.000 req/ngày**, 0ms cold start, Cron dọn Sandbox mỗi 6 giờ |
| **Frontend SPA** | [Cloudflare Pages](https://pages.cloudflare.com/) Free | React 19 + Vite 8 (`apps/web/dist`), băng thông không giới hạn, HTTP/3 CDN toàn cầu |
| **Rate Limit Cache** | [Upstash Redis](https://upstash.com/) Free *(tùy chọn)* | 10.000 lệnh/ngày (nếu bỏ trống, hệ thống tự fallback đếm quota qua bảng `ai_usage_logs` của Neon) |
| **LLM AI Copilot** | [Google AI Studio (Gemini)](https://aistudio.google.com/) / [Groq](https://console.groq.com/) Free | Khóa server dùng chung cho Demo có Rate Limit (15 lượt/ngày), hoặc Workspace nhập BYOK riêng (AES-256-GCM) |

---

## Bước 1: Tạo Neon PostgreSQL & Chạy Migration

1. Đăng nhập Neon và tạo 1 project mới (ví dụ `taskmanager-prod`).
2. Sao chép **Connection String** có dạng:
   `postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
3. Chạy migration Drizzle từ máy local:

```bash
pnpm install
pnpm --filter @taskmanager/db build
DATABASE_URL="postgresql://..." pnpm --filter @taskmanager/db db:migrate
```

---

## Bước 2: (Tùy chọn) Tạo Upstash Redis cho AI Rate Limit

1. Tạo Redis database Free trên [Upstash Console](https://console.upstash.com/).
2. Lấy `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`.
> Nếu bỏ qua bước này, `apps/api` tự động fallback sang đếm quota AI trong PostgreSQL mà không bị lỗi.

---

## Bước 3: Deploy Backend API lên Cloudflare Workers (`apps/api`)

```bash
cd apps/api
pnpm wrangler login
```

Tạo khóa ngẫu nhiên an toàn (32-byte hex):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Nạp các biến môi trường bí mật (Secrets) cho Worker `taskmanager-api`:

```bash
pnpm wrangler secret put DATABASE_URL
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put BETTER_AUTH_URL        # VD: https://taskmanager-api.<subdomain>.workers.dev
pnpm wrangler secret put CORS_ORIGIN            # VD: https://taskmanager-web.pages.dev
pnpm wrangler secret put BYOK_ENCRYPTION_KEY    # Khóa 32-byte hex dùng mã hóa AES-256-GCM
```

Các secrets tùy chọn (bổ sung khi cần bật tính năng nâng cao):
```bash
pnpm wrangler secret put GEMINI_API_KEY
pnpm wrangler secret put GROQ_API_KEY
pnpm wrangler secret put GITHUB_WEBHOOK_SECRET
pnpm wrangler secret put GITHUB_CLIENT_ID
pnpm wrangler secret put GITHUB_CLIENT_SECRET
pnpm wrangler secret put UPSTASH_REDIS_REST_URL
pnpm wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

Deploy Worker:
```bash
pnpm --filter @taskmanager/api... build
cd apps/api
pnpm wrangler deploy
```

> [!NOTE]
> **Cron Job dọn Demo Sandbox tự động**: File [wrangler.toml](../apps/api/wrangler.toml) đã cấu hình sẵn `[triggers] crons = ["0 */6 * * *"]`, tự động gọi `cleanupExpiredSandboxes()` mỗi 6 tiếng để xóa các Workspace Sandbox quá 24 giờ, giúp Neon Free luôn sạch sẽ.

> [!IMPORTANT]
> **Cookie đăng nhập Cross-Site HTTPS**: Khi `BETTER_AUTH_URL` bắt đầu bằng `https://` và khác domain với `CORS_ORIGIN` (ví dụ `*.pages.dev` gọi tới `*.workers.dev`), hệ thống tự động bật `SameSite=None; Secure; HttpOnly` trong Better Auth và động phản hồi `Access-Control-Allow-Origin` khớp với danh sách origin ngăn cách bởi dấu phẩy.

---

## Bước 4: Deploy Frontend SPA lên Cloudflare Pages (`apps/web`)

Xây dựng bản production trỏ về URL Worker vừa deploy:

```bash
VITE_API_URL="https://taskmanager-api.<subdomain>.workers.dev" pnpm --filter @taskmanager/web... build
pnpm wrangler pages deploy apps/web/dist --project-name=taskmanager-web
```

Thư mục `apps/web/public/` đã kèm sẵn:
- `_redirects`: định tuyến SPA `/* /index.html 200`
- `_headers`: Security Headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) + Cache 1 năm cho `/assets/*`

---

## Bước 5: Kích hoạt GitHub OAuth & Smart PR Webhook (Tùy chọn)

1. **GitHub OAuth App**:
   - **Homepage URL**: URL Cloudflare Pages của bạn (`https://taskmanager-web.pages.dev`)
   - **Authorization callback URL**: `https://taskmanager-api.<subdomain>.workers.dev/api/auth/callback/github`
2. **GitHub Smart PR Webhook** (trong Settings → Webhooks của repo GitHub cần đồng bộ):
   - **Payload URL**: `https://taskmanager-api.<subdomain>.workers.dev/api/v1/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Trùng với `GITHUB_WEBHOOK_SECRET` trên Worker
   - **Events**: Chọn *Pull requests* (`pull_request`)

---

## Bước 6: Tự động hóa 1-Click Deploy trên GitHub Actions

Repo đã có sẵn workflow [deploy.yml](../.github/workflows/deploy.yml) kích hoạt bằng tay (*Run workflow*). Bạn chỉ cần thêm vào **GitHub Repository Settings → Secrets and variables → Actions**:

| Loại | Tên biến | Giá trị |
| :--- | :--- | :--- |
| **Secret** | `CLOUDFLARE_API_TOKEN` | API Token có quyền edit Workers & Pages |
| **Secret** | `CLOUDFLARE_ACCOUNT_ID` | Account ID trên Cloudflare Dashboard |
| **Secret** | `DATABASE_URL` | Neon PostgreSQL Connection String |
| **Variable** | `VITE_API_URL` | URL Cloudflare Worker (`https://taskmanager-api...workers.dev`) |
| **Variable** | `CF_PAGES_PROJECT_NAME` | Tên project Cloudflare Pages (mặc định `taskmanager-web`) |
