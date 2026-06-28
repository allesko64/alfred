import { Suspense } from "react"
import { NewFeatureChatClient } from "./new-feature-chat-client"

export default function NewFeaturePage() {
  return (
    <Suspense>
      <NewFeatureChatClient />
    </Suspense>
  )
}
