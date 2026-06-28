import { Suspense } from "react"
import { OverviewClient } from "./overview-client"

export default function FeatureOverviewPage() {
  return (
    <Suspense>
      <OverviewClient />
    </Suspense>
  )
}
