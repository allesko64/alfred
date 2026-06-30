"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { CheckCircleIcon, GithubLogoIcon, SpinnerIcon } from "@phosphor-icons/react"

import { useTRPC, useTRPCClient } from "@/lib/trpc/client"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Field, FieldLabel, FieldGroup, FieldSeparator, FieldDescription } from "@/components/ui/field"

const STORAGE_PREFIX = "alfred:onboarding:"

const BUILDING_TYPES = [
  { value: "saas", label: "SaaS Product" },
  { value: "mobile", label: "Mobile App" },
  { value: "internal", label: "Internal Tool" },
  { value: "oss", label: "Open Source Project" },
  { value: "other", label: "Something Else" },
]

type Phase = "idle" | "finalizing" | "success"

export function WorkspaceOnboardingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  const [name, setName] = useState("")
  const [buildingType, setBuildingType] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [isRedirecting, setIsRedirecting] = useState(false)
  const hasHandledReturn = useRef(false)

  const completeOnboarding = useMutation(trpc.github.completeWorkspaceOnboarding.mutationOptions())

  useEffect(() => {
    if (hasHandledReturn.current) return

    const installationIdParam = searchParams.get("installation_id")
    const stateParam = searchParams.get("state")
    const errorParam = searchParams.get("error")

    if (errorParam) {
      hasHandledReturn.current = true
      toast.error("GitHub didn't return an installation. Please try again.")
      router.replace("/onboarding/workspace")
      return
    }

    if (!installationIdParam || !stateParam) return
    hasHandledReturn.current = true

    const raw = localStorage.getItem(`${STORAGE_PREFIX}${stateParam}`)
    if (!raw) {
      toast.error("We couldn't find your workspace details. Please start again.")
      router.replace("/onboarding/workspace")
      return
    }

    const saved = JSON.parse(raw) as { name: string; buildingType?: string }
    setName(saved.name)
    setBuildingType(saved.buildingType ?? null)
    setPhase("finalizing")

    completeOnboarding.mutate(
      {
        name: saved.name,
        buildingType: saved.buildingType ?? undefined,
        installationId: Number(installationIdParam),
      },
      {
        onSuccess: (data) => {
          localStorage.removeItem(`${STORAGE_PREFIX}${stateParam}`)
          setPhase("success")
          setTimeout(() => {
            router.push(`/onboarding/team?workspaceId=${data.workspaceId}`)
          }, 1100)
        },
        onError: (error) => {
          toast.error(error.message || "Something went wrong setting up your workspace.")
          setPhase("idle")
          router.replace("/onboarding/workspace")
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canConnect = name.trim().length > 0

  async function handleConnect() {
    if (!canConnect || phase !== "idle") return

    setIsRedirecting(true)
    const state = crypto.randomUUID()
    localStorage.setItem(
      `${STORAGE_PREFIX}${state}`,
      JSON.stringify({ name: name.trim(), buildingType: buildingType ?? undefined }),
    )

    try {
      const { url } = await trpcClient.github.getInstallationUrl.query({ state })
      window.location.href = url
    } catch {
      toast.error("Could not start the GitHub connection. Please try again.")
      localStorage.removeItem(`${STORAGE_PREFIX}${state}`)
      setIsRedirecting(false)
    }
  }

  const isBusy = isRedirecting || phase !== "idle"
  const buttonLabel =
    phase !== "idle"
      ? "Setting up your workspace..."
      : isRedirecting
        ? "Redirecting to GitHub..."
        : "Connect GitHub"

  const connectButton = (
    <Button type="button" className="w-full" disabled={isBusy} onClick={handleConnect}>
      {isBusy ? (
        <SpinnerIcon className="size-4 animate-spin" />
      ) : (
        <GithubLogoIcon weight="fill" className="size-4" />
      )}
      {buttonLabel}
    </Button>
  )

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="mb-8 flex w-full max-w-md flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-foreground">Set up your workspace</h1>
        <p className="text-lg text-muted-foreground">
          This is where your team and projects will live.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase !== "success" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="surface-card w-full max-w-md p-6 md:p-8"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
                <Input
                  id="workspace-name"
                  placeholder="e.g. Acme Corp"
                  autoFocus
                  disabled={isBusy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="building-type">What are you building?</FieldLabel>
                <Select
                  value={buildingType}
                  onValueChange={setBuildingType}
                  disabled={isBusy}
                >
                  <SelectTrigger id="building-type" className="w-full">
                    <SelectValue placeholder="Select one" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Then connect your repository
              </FieldSeparator>

              <Field>
                {canConnect || isBusy ? (
                  connectButton
                ) : (
                  <Tooltip>
                    <TooltipTrigger render={<span className="block w-full" />}>
                      {connectButton}
                    </TooltipTrigger>
                    <TooltipContent>Fill in your workspace name first</TooltipContent>
                  </Tooltip>
                )}
                <FieldDescription>
                  We&apos;ll use this to watch your PRs and run AI reviews.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="surface-card flex w-full max-w-md flex-col items-center gap-3 p-10 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            >
              <CheckCircleIcon weight="fill" className="size-12 text-success" />
            </motion.div>
            <p className="text-lg font-medium text-foreground">Workspace ready</p>
            <p className="text-lg text-muted-foreground">
              Taking you to invite your team...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
