import { Suspense } from "react"
import { FeaturesListClient } from "./features-list-client"

export default function FeaturesPage() {
  return (
    <Suspense>
      <FeaturesListClient />
    </Suspense>
  )
}
