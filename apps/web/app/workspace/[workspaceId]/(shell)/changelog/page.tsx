import { Suspense } from "react"
import { ChangelogClient } from "./changelog-client"

export default function WorkspaceChangelogPage() {
  return (
    <Suspense>
      <ChangelogClient />
    </Suspense>
  )
}
