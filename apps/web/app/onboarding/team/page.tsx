import { Suspense } from "react"
import { TeamOnboardingClient } from "./team-onboarding-client"

export default function OnboardingTeamPage() {
  return (
    <Suspense>
      <TeamOnboardingClient />
    </Suspense>
  )
}
