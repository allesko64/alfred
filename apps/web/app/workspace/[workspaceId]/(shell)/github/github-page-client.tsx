"use client"

import { useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { GithubLogoIcon, GitPullRequestIcon, SpinnerIcon } from "@phosphor-icons/react"

import { useTRPC, useTRPCClient } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlfredAvatar } from "@/components/workspace/conversation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RepoCard } from "@/components/workspace/github/repo-card"
import { PRRow } from "@/components/workspace/github/pr-row"
import { LinkPRDialog } from "@/components/workspace/github/link-pr-dialog"

export function GithubPageClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const queryClient = useQueryClient()

  const [isRedirecting, setIsRedirecting] = useState(false)
  const [selectedGithubRepoId, setSelectedGithubRepoId] = useState<string | null>(null)
  const [linkingPR, setLinkingPR] = useState<{
    id: string
    title: string | null
    githubPrNumber: number | null
  } | null>(null)

  const installationId = searchParams.get("installation_id")
  const isReturningFromOAuth = !!installationId && !searchParams.get("error")

  const reposQuery = useQuery(trpc.github.listRepositories.queryOptions({ workspaceId }))
  const prsQuery = useQuery(trpc.github.getRecentPRs.queryOptions({ workspaceId }))

  const installationReposQuery = useQuery({
    ...trpc.github.listInstallationRepos.queryOptions({ installationId: Number(installationId) }),
    enabled: isReturningFromOAuth,
  })

  const invalidateRepos = () =>
    queryClient.invalidateQueries({ queryKey: trpc.github.listRepositories.queryKey({ workspaceId }) })

  const connectRepository = useMutation(
    trpc.github.connectRepository.mutationOptions({
      onSuccess: () => {
        toast.success("Repository connected")
        invalidateRepos()
        router.replace(`/workspace/${workspaceId}/github`)
        setSelectedGithubRepoId(null)
      },
      onError: (error) => toast.error(error.message || "Could not connect that repository"),
    }),
  )

  const disconnectRepository = useMutation(
    trpc.github.disconnectRepository.mutationOptions({ onSuccess: invalidateRepos }),
  )
  const reconnectRepository = useMutation(
    trpc.github.reconnectRepository.mutationOptions({ onSuccess: invalidateRepos }),
  )

  async function handleConnect() {
    setIsRedirecting(true)
    const state = `add-repo:${workspaceId}:${crypto.randomUUID()}`

    try {
      const { url } = await trpcClient.github.getInstallationUrl.query({ state })
      window.location.href = url
    } catch {
      toast.error("Could not start the GitHub connection. Please try again.")
      setIsRedirecting(false)
    }
  }

  function handleConfirmRepoSelection() {
    if (!selectedGithubRepoId || !installationId) return
    connectRepository.mutate({
      workspaceId,
      installationId: Number(installationId),
      githubRepoId: Number(selectedGithubRepoId),
    })
  }

  const repos = reposQuery.data ?? []
  const prs = prsQuery.data ?? []
  const isLoading = reposQuery.isLoading

  return (
    <div className="flex flex-col">
      <TopBar title="GitHub" workspaceId={workspaceId} />

      <div className="flex flex-col gap-8 p-6">
        <div className="flex items-center justify-between">
          <p className="text-lg text-muted-foreground">
            Connect repositories so Alfred can watch your PRs and run AI reviews.
          </p>
          <Button onClick={handleConnect} disabled={isRedirecting}>
            {isRedirecting ? <SpinnerIcon className="size-4 animate-spin" /> : <GithubLogoIcon weight="fill" />}
            Connect Repository
          </Button>
        </div>

        {isReturningFromOAuth && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <span className="text-sm font-medium text-foreground">Select a repository to connect</span>
            {installationReposQuery.isLoading ? (
              <Skeleton className="h-9 w-full max-w-sm" />
            ) : (
              <div className="flex items-center gap-2">
                <Select value={selectedGithubRepoId} onValueChange={setSelectedGithubRepoId}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Choose a repository">
                      {(value: string | null) =>
                        installationReposQuery.data?.find((repo) => String(repo.githubRepoId) === value)
                          ?.fullName ?? "Choose a repository"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {installationReposQuery.data?.map((repo) => (
                      <SelectItem key={repo.githubRepoId} value={String(repo.githubRepoId)}>
                        {repo.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleConfirmRepoSelection}
                  disabled={!selectedGithubRepoId || connectRepository.isPending}
                >
                  {connectRepository.isPending && <SpinnerIcon className="size-4 animate-spin" />}
                  Connect
                </Button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : repos.length === 0 && !isReturningFromOAuth ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="scale-150">
              <AlfredAvatar />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">No repositories connected yet</span>
              <span className="text-sm text-muted-foreground">
                Connect a repo so Alfred can watch PRs and run AI reviews.
              </span>
            </div>
            <Button onClick={handleConnect} disabled={isRedirecting}>
              <GithubLogoIcon weight="fill" />
              Connect your first repository
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-foreground">Connected repositories</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {repos.map((repo) => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  onDisconnect={() => disconnectRepository.mutate({ workspaceId, repositoryId: repo.id })}
                  onReconnect={() => reconnectRepository.mutate({ workspaceId, repositoryId: repo.id })}
                  isDisconnecting={disconnectRepository.isPending}
                  isReconnecting={reconnectRepository.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {repos.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-foreground">Recent pull requests</h2>
            {prs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border py-10 text-center">
                <GitPullRequestIcon className="size-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  No pull requests yet — they&apos;ll land here once a PR is opened.
                </span>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {prs.map((pr) => (
                  <PRRow key={pr.id} pr={pr} onLinkClick={() => setLinkingPR(pr)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <LinkPRDialog
        workspaceId={workspaceId}
        pullRequest={linkingPR}
        onOpenChange={(open) => !open && setLinkingPR(null)}
      />
    </div>
  )
}
