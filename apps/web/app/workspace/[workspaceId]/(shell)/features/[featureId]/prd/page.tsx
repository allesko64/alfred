import { Suspense } from "react"
import { PRDClient } from "./prd-client"

export default function FeaturePRDPage() {
  return (
    <Suspense>
      <PRDClient />
    </Suspense>
  )
}
