import type { IssueType } from "./enums.js";

const BRANCH_PREFIX_BY_TYPE: Record<IssueType, string> = {
  epic: "epic",
  story: "feat",
  task: "chore",
  bug: "fix",
  subtask: "feat",
};

/**
 * Converts Vietnamese and Unicode strings into a clean git-safe ASCII slug.
 */
export function slugifyForBranch(input: string, maxLength = 42): string {
  const normalized = input
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, maxLength).replace(/-+$/g, "") || "issue";
}

/**
 * Formats a Linear-style git branch name for 1-click copy, e.g.:
 *   formatGitBranchName("ENG-42", "Fix OAuth callback", "bug")
 *   -> "fix/eng-42-fix-oauth-callback"
 */
export function formatGitBranchName(
  identifier: string,
  title: string,
  type: IssueType = "task",
): string {
  const prefix = BRANCH_PREFIX_BY_TYPE[type] ?? "feat";
  const keySlug = identifier.trim().toLowerCase();
  const titleSlug = slugifyForBranch(title);
  return `${prefix}/${keySlug}-${titleSlug}`;
}

export interface ExtractedIssueReference {
  key: string;
  autoClose: boolean;
}

const CLOSING_KEYWORD_REGEX =
  /\b(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s*:?\s*#?([A-Za-z][A-Za-z0-9]{1,9}-\d+)\b/gi;

const GENERAL_ISSUE_KEY_REGEX = /\b([A-Za-z][A-Za-z0-9]{1,9}-\d+)\b/g;

/**
 * Extracts unique issue identifiers (e.g. `ENG-42`) from PR titles, bodies, or branch names.
 * Detects closing keywords (`Closes ENG-42`, `Fixes ENG-10`) to trigger auto-completion on merge.
 */
export function extractIssueKeys(text: string): ExtractedIssueReference[] {
  const refs = new Map<string, boolean>();

  for (const match of text.matchAll(CLOSING_KEYWORD_REGEX)) {
    const rawKey = match[1];
    if (rawKey) {
      refs.set(rawKey.toUpperCase(), true);
    }
  }

  for (const match of text.matchAll(GENERAL_ISSUE_KEY_REGEX)) {
    const rawKey = match[1];
    if (rawKey) {
      const key = rawKey.toUpperCase();
      if (!refs.has(key)) {
        refs.set(key, false);
      }
    }
  }

  return Array.from(refs.entries()).map(([key, autoClose]) => ({
    key,
    autoClose,
  }));
}
