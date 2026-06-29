import { Suspense } from "react"
import { BillingClient } from "./billing-client"

export default function WorkspaceBillingPage() {
  return (
    <Suspense>
      <BillingClient />
    </Suspense>
  )
}
