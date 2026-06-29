"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { useTRPC } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export function SettingsClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const trpc = useTRPC()

  const { data: preferences } = useQuery(trpc.user.getDigestPreferences.queryOptions())

  const [digestEnabled, setDigestEnabled] = useState(true)
  const [digestHourLocal, setDigestHourLocal] = useState(9)
  const [digestTimezone, setDigestTimezone] = useState("UTC")

  useEffect(() => {
    if (!preferences) return
    setDigestEnabled(preferences.digestEnabled)
    setDigestHourLocal(preferences.digestHourLocal)
    setDigestTimezone(preferences.digestTimezone)
  }, [preferences])

  const updatePreferences = useMutation(
    trpc.user.updateDigestPreferences.mutationOptions({
      onSuccess: () => toast.success("Digest preferences saved"),
      onError: () => toast.error("Couldn't save preferences"),
    }),
  )

  function onSave() {
    updatePreferences.mutate({ digestEnabled, digestHourLocal, digestTimezone })
  }

  return (
    <div className="flex flex-col">
      <TopBar title="Settings" workspaceId={workspaceId} />

      <div className="flex flex-col gap-6 p-6">
        <Card className="max-w-[480px]">
          <CardHeader>
            <CardTitle>Daily digest</CardTitle>
            <CardDescription>
              Alfred emails you a personalized summary of what needs attention each day.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Enable daily digest email
            </label>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="digest-hour">Delivery hour (your local time)</Label>
              <select
                id="digest-hour"
                value={digestHourLocal}
                disabled={!digestEnabled}
                onChange={(e) => setDigestHourLocal(Number(e.target.value))}
                className="h-8 w-32 rounded-lg border border-input bg-transparent px-2 text-xs disabled:opacity-50"
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="digest-timezone">Timezone (IANA name)</Label>
              <Input
                id="digest-timezone"
                value={digestTimezone}
                disabled={!digestEnabled}
                onChange={(e) => setDigestTimezone(e.target.value)}
                placeholder="e.g. Asia/Kolkata"
                className="w-56"
              />
            </div>

            <Button size="sm" className="self-start" disabled={updatePreferences.isPending} onClick={onSave}>
              {updatePreferences.isPending ? "Saving..." : "Save preferences"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
