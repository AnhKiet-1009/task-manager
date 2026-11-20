import { describe, expect, it } from "vitest";
import {
  extractIssueKeys,
  formatGitBranchName,
  generateInitialRanks,
  generateRankBetween,
  aiBreakdownResponseSchema,
  createIssueSchema,
  moveIssueSchema,
} from "../index.js";

describe("LexoRank fractional indexing", () => {
  it("generates strictly ascending initial ranks", () => {
    const ranks = generateInitialRanks(20);
    expect(ranks).toHaveLength(20);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i - 1]! < ranks[i]!).toBe(true);
    }
  });

  it("inserts repeatedly at the beginning, middle, and end without collisions", () => {
    const list: string[] = [generateRankBetween(null, null)];

    // 30 insertions at the very front
    for (let i = 0; i < 30; i++) {
      const r = generateRankBetween(null, list[0]);
      expect(r < list[0]!).toBe(true);
      list.unshift(r);
    }

    // 30 insertions at the very end
    for (let i = 0; i < 30; i++) {
      const last = list[list.length - 1]!;
      const r = generateRankBetween(last, null);
      expect(last < r).toBe(true);
      list.push(r);
    }

    // 40 insertions strictly in the middle between adjacent items
    for (let i = 0; i < 40; i++) {
      const midIndex = Math.floor(list.length / 2);
      const prev = list[midIndex - 1]!;
      const next = list[midIndex]!;
      const r = generateRankBetween(prev, next);
      expect(prev < r).toBe(true);
      expect(r < next).toBe(true);
      list.splice(midIndex, 0, r);
    }

    // Verify full sorted uniqueness
    const sorted = [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(list).toEqual(sorted);
    expect(new Set(list).size).toBe(list.length);
  });

  it("throws when prev >= next", () => {
    expect(() => generateRankBetween("b", "a")).toThrow();
    expect(() => generateRankBetween("V", "V")).toThrow();
  });
});

describe("GitHub Smart PR & Branch helpers", () => {
  it("formats Vietnamese titles into clean ASCII git branch names", () => {
    expect(
      formatGitBranchName("ENG-42", "Sửa lỗi đăng nhập OAuth GitHub", "bug"),
    ).toBe("fix/eng-42-sua-loi-dang-nhap-oauth-github");

    expect(
      formatGitBranchName("APP-7", "Add Sprint Burndown Chart", "story"),
    ).toBe("feat/app-7-add-sprint-burndown-chart");
  });

  it("extracts issue keys and detects auto-close keywords", () => {
    const refs = extractIssueKeys(
      "Branch feat/eng-12-board: Implements drag & drop. Closes ENG-42 and fixes #APP-9 (relates to ENG-12)",
    );

    expect(refs).toEqual([
      { key: "ENG-42", autoClose: true },
      { key: "APP-9", autoClose: true },
      { key: "ENG-12", autoClose: false },
    ]);
  });
});

describe("Shared Zod Schemas", () => {
  it("validates createIssue and moveIssue payloads", () => {
    const issue = createIssueSchema.parse({
      title: "Build LexoRank Kanban board",
      type: "story",
      priority: "high",
      storyPoints: 5,
    });
    expect(issue.title).toBe("Build LexoRank Kanban board");

    const move = moveIssueSchema.parse({
      stateId: "11111111-1111-4111-8111-111111111111",
      prevPosition: "V",
      nextPosition: "k",
    });
    expect(move.prevPosition).toBe("V");
  });

  it("validates AI PRD-to-Backlog structured output", () => {
    const parsed = aiBreakdownResponseSchema.parse({
      epic: {
        title: "GitHub OAuth & Webhook Automation",
        descriptionMd: "End-to-end GitHub PR linking",
        priority: "high",
      },
      issues: [
        {
          tempId: "t1",
          title: "Verify HMAC-SHA256 webhook signature",
          descriptionMd: "Reject unsigned webhook payloads",
          type: "task",
          priority: "urgent",
          storyPoints: 3,
          blockedByTempIds: [],
        },
      ],
      rationale: "Split security verification before state transition logic.",
    });

    expect(parsed.issues[0]?.storyPoints).toBe(3);
  });
});
