import type { ReactNode } from "react"

/** Mirrors APPROVER_ROLES in packages/trpc/src/routers/feature.router.ts — keep in sync. */
const APPROVER_ROLES = new Set(["owner", "admin", "reviewer"])

export function canShipFeature(role: string | null | undefined, featureStatus: string | null | undefined): boolean {
  const canApprove = !!role && APPROVER_ROLES.has(role)
  return canApprove && featureStatus === "PENDING_APPROVAL"
}

export interface ApprovalGateProps {
  role: string | null | undefined
  featureStatus: string | null | undefined
  children: ReactNode
}

/**
 * Renders `children` (the Approve/Reject controls) only when the caller's
 * workspace role and the feature's current status both allow shipping —
 * the client-side mirror of the role + status guard enforced server-side
 * in feature.approve / feature.reject.
 */
export function ApprovalGate({ role, featureStatus, children }: ApprovalGateProps) {
  if (!canShipFeature(role, featureStatus)) return null
  return <>{children}</>
}
