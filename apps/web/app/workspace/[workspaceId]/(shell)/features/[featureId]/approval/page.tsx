import { Suspense } from "react"
import { ApprovalClient } from "./approval-client"

export default function FeatureApprovalPage() {
  return (
    <Suspense>
      <ApprovalClient />
    </Suspense>
  )
}
