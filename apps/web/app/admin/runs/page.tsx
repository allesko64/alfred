import { Suspense } from "react"
import { AdminRunsClient } from "./admin-runs-client"

export default function AdminRunsPage() {
  return (
    <Suspense>
      <AdminRunsClient />
    </Suspense>
  )
}
