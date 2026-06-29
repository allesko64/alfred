import { Suspense } from "react"
import { PublicChangelogClient } from "./public-changelog-client"

export default function PublicChangelogPage() {
  return (
    <Suspense>
      <PublicChangelogClient />
    </Suspense>
  )
}
