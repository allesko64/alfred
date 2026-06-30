type NotificationLike = {
  type: string
  featureId: string | null
}

const FEATURE_SUBPATH_BY_TYPE: Record<string, string> = {
  prd_ready: "/prd",
  prd_blocked: "/prd",
  tasks_ready: "/tasks",
  task_generation_blocked: "/tasks",
  review_blocked: "/review",
  review_complete: "/review",
  approval_requested: "/approval",
  pr_linked: "/review",
  feature_shipped: "",
  feature_rejected: "",
}

export function getNotificationPath(workspaceId: string, notification: NotificationLike): string | null {
  const { type, featureId } = notification

  if (type === "credits_exhausted") return `/workspace/${workspaceId}/billing`
  if (type === "changelog_updated") return `/workspace/${workspaceId}/changelog`
  if (type === "pr_unlinked") return `/workspace/${workspaceId}/github`
  if (type === "daily_digest") return `/workspace/${workspaceId}`

  if (!featureId) return null

  const subpath = FEATURE_SUBPATH_BY_TYPE[type] ?? ""
  return `/workspace/${workspaceId}/features/${featureId}${subpath}`
}
