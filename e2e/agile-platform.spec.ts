import { expect, test } from "@playwright/test";

test.describe("TaskManager Full-Stack E2E (Real Hono API + PGlite + Vite Web)", () => {
  test("launches 1-Click Demo Sandbox, triggers live WIP Limit warning on Kanban, and persists issues across reload", async ({
    page,
  }) => {
    await page.goto("/");

    const sandboxBtn = page.getByRole("button", {
      name: /trải nghiệm demo 1-click/i,
    });
    await expect(sandboxBtn).toBeVisible();
    await sandboxBtn.click();

    const inProgressCol = page.getByTestId("kanban-column-in-progress");
    await expect(inProgressCol).toBeVisible();
    await expect(page.getByTestId("issue-card-ENG-12")).toBeVisible();
    await expect(page.getByTestId("realtime-status-pill")).toHaveText("Live");

    // Seeded In Progress column has 4/5 issues -> creating 2 issues triggers real WIP warning (6/5)
    for (const title of [
      "E2E kiểm thử tạo mới Issue",
      "E2E kích hoạt vượt WIP Limit",
    ]) {
      await inProgressCol
        .getByRole("button", { name: /thêm issue vào in progress/i })
        .click();

      const modal = page.getByRole("dialog", { name: /tạo issue mới/i });
      await expect(modal).toBeVisible();
      await modal.getByLabel(/tiêu đề issue/i).fill(title);
      await modal.getByRole("button", { name: /^tạo issue$/i }).click();
      await expect(modal).toBeHidden();
    }

    await expect(inProgressCol.getByText("E2E kiểm thử tạo mới Issue")).toBeVisible();
    await expect(
      inProgressCol.getByText("E2E kích hoạt vượt WIP Limit"),
    ).toBeVisible();
    await expect(inProgressCol.getByText(/vượt giới hạn wip \(6\/5\)/i)).toBeVisible();

    // Reload browser page: Better Auth session cookie + PostgreSQL persistence remain intact
    await page.reload();
    await expect(page.getByTestId("kanban-column-in-progress")).toBeVisible();
    await expect(
      page.getByTestId("kanban-column-in-progress").getByText("E2E kiểm thử tạo mới Issue"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("kanban-column-in-progress")
        .getByText(/vượt giới hạn wip \(6\/5\)/i),
    ).toBeVisible();

    // Clicking "Thoát" immediately returns to the Login / Sandbox screen without extra clicks
    await page.getByRole("button", { name: /thoát/i }).click();
    await expect(
      page.getByRole("button", { name: /trải nghiệm demo 1-click/i }),
    ).toBeVisible();
  });

  test("supports Deep Issue Drawer (Tiptap, Sub-issue, @mention, Activity Timeline) and 2-tab SSE Realtime Sync", async ({
    context,
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /trải nghiệm demo 1-click/i })
      .click();

    await expect(page.getByTestId("issue-card-ENG-12")).toBeVisible();
    await expect(page.getByTestId("realtime-status-pill")).toHaveText("Live");

    // Open Deep Issue Detail Drawer (lazy-loaded Tiptap + ProseMirror chunk)
    // Click title heading directly so PR badge <a target="_blank"> doesn't intercept center click
    await page.getByTestId("issue-card-ENG-12").getByRole("heading").click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/phân tích velocity thực tế/i)).toBeVisible();

    // Add inline Sub-issue
    await drawer.getByRole("button", { name: /thêm sub-issue/i }).click();
    await drawer
      .getByPlaceholder(/tiêu đề sub-issue mới/i)
      .fill("E2E Sub-issue kiểm thử");
    await drawer.getByRole("button", { name: /^thêm$/i }).click();
    await expect(drawer.getByText("E2E Sub-issue kiểm thử")).toBeVisible();

    // Post comment with @mention autocomplete
    const commentInput = drawer.getByLabel(/nội dung bình luận/i);
    await commentInput.click();
    await commentInput.pressSequentially("Nhờ @Minh");
    const mentionList = drawer.getByRole("listbox", { name: /nhắc thành viên/i });
    await expect(mentionList).toBeVisible();
    await mentionList.getByRole("option", { name: /minh anh/i }).click();
    await expect(commentInput).toHaveValue(/@Minh Anh \(Staff FE\) $/);
    await page.keyboard.type("xem giúp PR này");
    await drawer.getByRole("button", { name: /^gửi$/i }).click();
    await expect(drawer.getByText(/xem giúp pr này/i)).toBeVisible();

    // Verify Activity Log Timeline tab
    await drawer.getByRole("tab", { name: /lịch sử hoạt động/i }).click();
    await expect(drawer.getByText(/đã tạo issue eng-12/i)).toBeVisible();

    await drawer
      .getByRole("button", { name: /đóng ngăn chi tiết issue/i })
      .click();
    await expect(drawer).toBeHidden();

    // Open second browser tab sharing session & verify live SSE push without reload
    const page2 = await context.newPage();
    await page2.goto("/");
    await expect(page2.getByTestId("issue-card-ENG-12")).toBeVisible();
    await expect(page2.getByTestId("realtime-status-pill")).toHaveText("Live");

    await page.getByRole("button", { name: /^tạo issue$/i }).click();
    const createDialog = page.getByRole("dialog", { name: /tạo issue mới/i });
    await createDialog
      .getByLabel(/tiêu đề issue/i)
      .fill("Đồng bộ SSE hai tab");
    await createDialog.getByRole("button", { name: /^tạo issue$/i }).click();
    await expect(createDialog).toBeHidden();

    // Tab 2 updates automatically via EventSource invalidation
    await expect(page2.getByText("Đồng bộ SSE hai tab")).toBeVisible({
      timeout: 15_000,
    });
    await page2.close();
  });

  test("executes 3 AI Copilot pillars, Sprint Analytics, GitHub PR Simulator, BYOK Vault, and Ctrl+K Palette", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /trải nghiệm demo 1-click/i })
      .click();

    await expect(page.getByTestId("issue-card-ENG-12")).toBeVisible();

    // 1. Natural Language AI Filter on Board (ENG-13 is an overdue urgent bug)
    await page
      .getByLabel(/lọc bằng ngôn ngữ tự nhiên ai/i)
      .fill("bug khẩn cấp quá hạn");
    await page.getByRole("button", { name: /^lọc ai$/i }).click();

    const aiBanner = page.getByTestId("ai-filter-banner");
    await expect(aiBanner).toBeVisible();
    await expect(page.getByTestId("issue-card-ENG-13")).toBeVisible();
    await expect(page.getByTestId("issue-card-ENG-12")).toBeHidden();

    await page.getByRole("button", { name: /xóa lọc ai/i }).click();
    await expect(page.getByTestId("issue-card-ENG-12")).toBeVisible();

    // 2. AI PRD-to-Backlog Generator -> atomic commit (1 Epic + Issues)
    await page.getByRole("button", { name: /ai backlog/i }).click();
    const prdDialog = page.getByRole("dialog", {
      name: /ai prd-to-backlog generator/i,
    });
    await expect(prdDialog).toBeVisible();
    await prdDialog
      .getByRole("button", { name: /mẫu: thông báo realtime đa kênh/i })
      .click();
    await prdDialog.getByRole("button", { name: /phân tích bằng ai/i }).click();

    await expect(
      prdDialog.getByText(/tổng hợp|thiết kế bảng notifications/i).first(),
    ).toBeVisible();
    await prdDialog.getByRole("button", { name: /tạo hàng loạt/i }).click();
    await expect(prdDialog).toBeHidden();

    // Navigate Backlog & Epics Roadmap to verify newly created Epic
    await page.getByRole("button", { name: /backlog & sprints/i }).click();
    await expect(
      page.getByRole("heading", { name: /backlog & lập kế hoạch sprint/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /epics roadmap/i }).click();
    await expect(
      page.getByRole("heading", { name: /epics & lộ trình sản phẩm/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/thông báo realtime/i).first(),
    ).toBeVisible();

    // 3. Analytics & AI Risk Radar + GitHub PR Merge Simulator
    await page.getByRole("button", { name: /analytics & ai radar/i }).click();
    await expect(
      page.getByRole("heading", { name: /sprint analytics & ai risk radar/i }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /quét rủi ro sprint bằng ai/i })
      .click();
    await expect(page.getByText(/\d+\/100/)).toBeVisible();
    await expect(page.getByRole("button", { name: "ENG-13" })).toBeVisible();

    await page.getByRole("button", { name: /merge → done/i }).click();
    await page
      .getByRole("button", { name: /chạy đồng bộ github pr/i })
      .click();
    await expect(page.getByText(/github pr #/i)).toBeVisible();

    // 4. Workspace AI BYOK Vault (AES-256-GCM encrypted persistence)
    await page.getByRole("button", { name: /cài đặt ai \(byok\)/i }).click();
    const settingsDialog = page.getByRole("dialog", {
      name: /cấu hình ai byok/i,
    });
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByLabel(/nhà cung cấp llm/i).selectOption("groq");
    await settingsDialog
      .getByLabel(/api key riêng/i)
      .fill("gsk_e2e_test_secret_123456");
    await settingsDialog
      .getByRole("button", { name: /lưu cấu hình/i })
      .click();
    await expect(settingsDialog).toBeHidden();

    await page.getByRole("button", { name: /cài đặt ai \(byok\)/i }).click();
    await expect(page.getByText(/không giới hạn \(byok\)/i)).toBeVisible();
    await page.getByRole("button", { name: /đóng cài đặt ai/i }).click();

    // 5. Global Command Palette Ctrl+K
    await page.keyboard.press("Control+k");
    await expect(
      page.getByRole("dialog", { name: /command palette/i }),
    ).toBeVisible();
  });
});
