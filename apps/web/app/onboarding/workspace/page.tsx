import { Suspense } from "react"
import { WorkspaceOnboardingClient } from "./workspace-onboarding-client"

export default function OnboardingWorkspacePage() {
  return (
    <Suspense>
      <WorkspaceOnboardingClient />
    </Suspense>
  )
}
