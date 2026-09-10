export type ArticleStatus = "draft" | "in_review" | "revision_requested" | "approved" | "published" | "archived";
export type WorkflowAction = "submit" | "request_revision" | "approve" | "publish" | "archive" | "reopen";

const nextStatus: Record<WorkflowAction, ArticleStatus> = { submit: "in_review", request_revision: "revision_requested", approve: "approved", publish: "published", archive: "archived", reopen: "draft" };
const transitions = new Set(["draft:in_review", "revision_requested:in_review", "in_review:revision_requested", "in_review:approved", "approved:published", "approved:draft", "published:archived", "published:draft", "archived:draft"]);

export function isAllowedWorkflowTransition(current: ArticleStatus, next: ArticleStatus) {
  return transitions.has(`${current}:${next}`);
}

export function workflowUpdate(action: WorkflowAction, userId: string, now = new Date()) {
  const timestamp = now.toISOString();
  if (action === "submit") return { status: nextStatus[action], submitted_at: timestamp };
  if (action === "request_revision") return { status: nextStatus[action], reviewer_id: userId };
  if (action === "approve") return { status: nextStatus[action], approved_at: timestamp, reviewer_id: userId };
  if (action === "publish") return { status: nextStatus[action], published_at: timestamp };
  if (action === "archive") return { status: nextStatus[action], archived_at: timestamp };
  return { status: nextStatus[action] };
}
