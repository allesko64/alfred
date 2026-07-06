"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { useTRPC } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SettingsClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const trpc = useTRPC()

  const { data: preferences } = useQuery(trpc.user.getDigestPreferences.queryOptions())

  const [digestEnabled, setDigestEnabled] = useState(true)

  useEffect(() => {
    if (!preferences) return
    setDigestEnabled(preferences.digestEnabled)
  }, [preferences])

  const updatePreferences = useMutation(
    trpc.user.updateDigestPreferences.mutationOptions({
      onSuccess: () => toast.success("Digest preferences saved"),
      onError: () => toast.error("Couldn't save preferences"),
    }),
  )

  function onSave() {
    updatePreferences.mutate({ digestEnabled })
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Settings" workspaceId={workspaceId} />

      <div className="flex flex-col gap-6 p-6">
        <Card className="max-w-[480px]">
          <CardHeader>
            <CardTitle>Daily digest</CardTitle>
            <CardDescription>
              Alfred emails you a personalized summary of what needs attention every morning at 9:00 AM IST.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Enable daily digest email
            </label>

            <Button size="sm" className="self-start" disabled={updatePreferences.isPending} onClick={onSave}>
              {updatePreferences.isPending ? "Saving..." : "Save preferences"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
