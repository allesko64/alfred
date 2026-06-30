"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { XIcon } from "@phosphor-icons/react"

import { inviteMemberSchema, membershipRoleValues } from "@alfred/validators"

import { useTRPC } from "@/lib/trpc/client"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  reviewer: "Reviewer",
  viewer: "Viewer",
}

// Owners aren't invited — they're whoever created the workspace.
const INVITABLE_ROLES = membershipRoleValues.filter((role) => role !== "owner")
const ROLES = INVITABLE_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))

type InviteRole = (typeof INVITABLE_ROLES)[number]

interface PendingInvite {
  id: string
  username: string
  name: string | null
  avatarUrl: string
  role: InviteRole
}

export function TeamOnboardingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const trpc = useTRPC()

  const workspaceId = searchParams.get("workspaceId")

  const [username, setUsername] = useState("")
  const [debouncedUsername, setDebouncedUsername] = useState("")
  const [role, setRole] = useState<InviteRole>("developer")
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!workspaceId) {
      toast.error("We lost track of your workspace. Please start onboarding again.")
      router.replace("/onboarding/workspace")
    }
  }, [workspaceId, router])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedUsername(username.trim()), 500)
    return () => clearTimeout(timeout)
  }, [username])

  const lookup = useQuery(
    trpc.github.lookupUser.queryOptions(
      { username: debouncedUsername },
      { enabled: debouncedUsername.length > 0 },
    ),
  )

  const inviteMember = useMutation(trpc.workspace.inviteMember.mutationOptions())
  const completeStep = useMutation(trpc.workspace.completeOnboardingStep.mutationOptions())

  const alreadyAdded = pendingInvites.some(
    (invite) => invite.username.toLowerCase() === debouncedUsername.toLowerCase(),
  )
  const showProfileCard = debouncedUsername.length > 0 && !lookup.isFetching && lookup.data
  const showNotFound =
    debouncedUsername.length > 0 && !lookup.isFetching && lookup.data === null

  function handleAdd() {
    if (!lookup.data || alreadyAdded) return

    setPendingInvites((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        username: lookup.data!.username,
        name: lookup.data!.name,
        avatarUrl: lookup.data!.avatarUrl,
        role,
      },
    ])
    setUsername("")
    setDebouncedUsername("")
  }

  function handleRemove(id: string) {
    setPendingInvites((prev) => prev.filter((invite) => invite.id !== id))
  }

  async function finishOnboarding() {
    if (!workspaceId) return

    setIsSubmitting(true)
    try {
      const payloads = pendingInvites.map((invite) =>
        inviteMemberSchema.parse({
          workspaceId,
          githubUsername: invite.username,
          role: invite.role,
        }),
      )
      await Promise.all(payloads.map((payload) => inviteMember.mutateAsync(payload)))
      await completeStep.mutateAsync({ workspaceId, step: "complete" })
      router.push(`/workspace/${workspaceId}/dashboard`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not finish onboarding. Please try again.",
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="mb-8 flex w-full max-w-md flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-foreground">Who&apos;s building with you?</h1>
        <p className="text-lg text-muted-foreground">
          Invite your team to collaborate. You can always do this later.
        </p>
      </div>

      <div className="surface-card flex w-full max-w-md flex-col gap-4 p-6 md:p-8">
        <div className="flex items-center gap-2">
          <Input
            placeholder="GitHub username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isSubmitting}
            className="flex-1"
          />
          <Select value={role} onValueChange={(value) => setRole(value as InviteRole)}>
            <SelectTrigger className="w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AnimatePresence>
          {showProfileCard && lookup.data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 rounded-none bg-muted px-3 py-2"
            >
              <Avatar size="sm">
                <AvatarImage src={lookup.data.avatarUrl} alt={lookup.data.username} />
                <AvatarFallback>{lookup.data.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-sm font-medium text-foreground">
                  {lookup.data.name ?? lookup.data.username}
                </span>
                <span className="text-sm text-muted-foreground">@{lookup.data.username}</span>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={alreadyAdded}
                onClick={handleAdd}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                {alreadyAdded ? "Added" : "Add"}
              </Button>
            </motion.div>
          )}
          {showNotFound && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-1 text-sm text-muted-foreground"
            >
              GitHub user not found
            </motion.p>
          )}
        </AnimatePresence>

        {pendingInvites.length > 0 && (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-none border border-border">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 bg-muted px-3 py-2"
              >
                <Avatar size="sm">
                  <AvatarImage src={invite.avatarUrl} alt={invite.username} />
                  <AvatarFallback>{invite.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col leading-tight">
                  <span className="text-sm font-medium text-foreground">
                    {invite.name ?? invite.username}
                  </span>
                  <span className="text-sm text-muted-foreground">@{invite.username}</span>
                </div>
                <Badge variant="secondary">
                  {ROLES.find((r) => r.value === invite.role)?.label}
                </Badge>
                <button
                  type="button"
                  onClick={() => handleRemove(invite.id)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${invite.username}`}
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <Button type="button" className="w-full" disabled={isSubmitting} onClick={finishOnboarding}>
            {isSubmitting ? "Finishing up..." : "Continue"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full border-none text-muted-foreground"
            disabled={isSubmitting}
            onClick={finishOnboarding}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  )
}
