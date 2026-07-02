"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CoinsIcon, SpinnerIcon } from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Timestamp } from "@/components/workspace/timestamp"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", team: "Team" }

export function AdminUsersClient() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: rows, isLoading } = useQuery(trpc.admin.listUsers.queryOptions())
  const { data: stats } = useQuery(trpc.admin.getStats.queryOptions())

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: trpc.admin.listUsers.queryKey() })

  const changePlan = useMutation(
    trpc.admin.changePlan.mutationOptions({
      onSuccess: () => {
        toast.success("Plan updated")
        invalidateUsers()
      },
      onError: (error) => toast.error(error.message || "Could not change plan"),
    })
  )

  const adjustCredits = useMutation(
    trpc.admin.adjustCredits.mutationOptions({
      onSuccess: () => {
        toast.success("Credits updated")
        invalidateUsers()
      },
      onError: (error) => toast.error(error.message || "Could not adjust credits"),
    })
  )

  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Users" value={stats.totalUsers} />
          <StatTile label="Workspaces" value={stats.totalWorkspaces} />
          <StatTile label="Active runs" value={stats.activeWorkflowRuns} />
          <StatTile label="Credits used (cycle)" value={stats.creditsUsedThisCycle} />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="surface-card flex flex-col">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-2 text-sm text-muted-foreground">
            <span>User</span>
            <span>Signup</span>
            <span>Org</span>
            <span>Plan</span>
            <span>Credits</span>
          </div>
          {rows?.map((row) => (
            <div
              key={`${row.userId}-${row.workspaceId ?? "none"}`}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {row.name ?? row.email}
                </span>
                <span className="truncate text-sm text-muted-foreground">{row.email}</span>
              </div>

              <Timestamp date={row.signupDate} className="text-sm text-muted-foreground" />

              <span className="truncate text-sm text-foreground">
                {row.workspaceName ?? <span className="text-muted-foreground">— no workspace —</span>}
              </span>

              {row.workspaceId ? (
                <Select
                  value={row.plan ?? undefined}
                  onValueChange={(plan) =>
                    changePlan.mutate({ workspaceId: row.workspaceId!, plan: plan as "free" | "pro" | "team" })
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue>{row.plan ? PLAN_LABEL[row.plan] : "—"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}

              {row.workspaceId ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {row.creditsRemaining} / {row.creditsLimit}
                  </Badge>
                  <AdjustCreditsDialog
                    workspaceName={row.workspaceName ?? "workspace"}
                    isPending={adjustCredits.isPending}
                    onSubmit={(delta, reason) =>
                      adjustCredits.mutate({ workspaceId: row.workspaceId!, delta, reason })
                    }
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card flex flex-col gap-1 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-medium text-foreground">{value.toLocaleString()}</span>
    </div>
  )
}

function AdjustCreditsDialog({
  workspaceName,
  isPending,
  onSubmit,
}: {
  workspaceName: string
  isPending: boolean
  onSubmit: (delta: number, reason: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [delta, setDelta] = useState("")
  const [reason, setReason] = useState("")

  const parsedDelta = Number(delta)
  const canSubmit = delta.trim() !== "" && Number.isInteger(parsedDelta) && parsedDelta !== 0 && reason.trim() !== ""

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setDelta("")
          setReason("")
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Adjust credits for ${workspaceName}`} />
        }
      >
        <CoinsIcon className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust credits — {workspaceName}</DialogTitle>
          <DialogDescription>
            Positive numbers top up the balance, negative numbers deduct. This bypasses billing and is
            logged to the admin audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            type="number"
            placeholder="e.g. 500 or -100"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
          <Textarea
            placeholder="Reason (required, e.g. demo top-up)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || isPending}
            onClick={() => {
              onSubmit(parsedDelta, reason.trim())
              setOpen(false)
              setDelta("")
              setReason("")
            }}
          >
            {isPending && <SpinnerIcon className="size-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
