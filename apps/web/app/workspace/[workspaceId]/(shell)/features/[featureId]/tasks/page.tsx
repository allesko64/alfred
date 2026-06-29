import { Suspense } from "react"
import { TasksClient } from "./tasks-client"

export default function FeatureTasksPage() {
  return (
    <Suspense>
      <TasksClient />
    </Suspense>
  )
}
