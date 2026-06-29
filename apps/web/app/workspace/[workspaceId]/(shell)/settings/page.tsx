import { Suspense } from "react"
import { SettingsClient } from "./settings-client"

export default function WorkspaceSettingsPage() {
  return (
    <Suspense>
      <SettingsClient />
    </Suspense>
  )
}
