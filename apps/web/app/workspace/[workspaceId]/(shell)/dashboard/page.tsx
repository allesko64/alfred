import { Suspense } from "react"
import { DashboardClient } from "./dashboard-client"

export default function WorkspaceDashboardPage() {
  return (
    <Suspense>
      <DashboardClient />
    </Suspense>
  )
}
