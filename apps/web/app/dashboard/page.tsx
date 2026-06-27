import { Suspense } from "react"
import { DashboardClient } from "./dashboard-client"

export default function DashboardPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Suspense>
        <DashboardClient />
      </Suspense>
    </div>
  )
}
