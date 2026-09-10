import { describe, expect, it } from "vitest";
import { isAllowedWorkflowTransition, workflowUpdate } from "./article-workflow";

describe("article workflow", () => {
  it("menghasilkan timestamp publish yang deterministik", () => {
    const now = new Date("2026-09-10T08:30:00.000Z");
    expect(workflowUpdate("publish", "user-1", now)).toEqual({ status: "published", published_at: now.toISOString() });
  });

  it("menyimpan reviewer saat approve", () => {
    const update = workflowUpdate("approve", "editor-1", new Date("2026-09-10T08:30:00.000Z"));
    expect(update).toMatchObject({ status: "approved", reviewer_id: "editor-1", approved_at: "2026-09-10T08:30:00.000Z" });
  });

  it.each([["draft", "in_review"], ["in_review", "approved"], ["approved", "published"], ["published", "archived"]] as const)("menerima transisi %s ke %s", (current, next) => expect(isAllowedWorkflowTransition(current, next)).toBe(true));
  it.each([["draft", "published"], ["in_review", "published"], ["archived", "published"]] as const)("menolak transisi %s ke %s", (current, next) => expect(isAllowedWorkflowTransition(current, next)).toBe(false));
});
