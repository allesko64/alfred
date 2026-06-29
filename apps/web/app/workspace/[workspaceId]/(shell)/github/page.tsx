import { Suspense } from "react"
import { GithubPageClient } from "./github-page-client"

export default function WorkspaceGithubPage() {
  return (
    <Suspense>
      <GithubPageClient />
    </Suspense>
  )
}
