import { Suspense } from "react"
import { ReviewClient } from "./review-client"

export default function FeatureReviewPage() {
  return (
    <Suspense>
      <ReviewClient />
    </Suspense>
  )
}
