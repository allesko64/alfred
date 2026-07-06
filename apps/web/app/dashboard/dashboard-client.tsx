"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSession, signOut } from "@/lib/auth-client"
import { useTRPC } from "@/lib/trpc/client"

export function DashboardClient() {
  const router = useRouter()
  const { data: session } = useSession()
  const trpc = useTRPC()

  const { data: hello } = useQuery(trpc.user.hello.queryOptions({ name: session?.user.name ?? undefined }))
  const { data: workspaces, isPending: isWorkspacesPending } = useQuery(trpc.workspace.list.queryOptions())

  useEffect(() => {
    if (isWorkspacesPending || !workspaces) return

    if (workspaces.length === 0) {
      router.replace("/onboarding/workspace")
      return
    }

    const workspace = workspaces[0]!
    if (workspace.onboardingStep === "complete") {
      router.replace(`/workspace/${workspace.id}/dashboard`)
    } else {
      router.replace(`/onboarding/${workspace.onboardingStep}`)
    }
  }, [workspaces, isWorkspacesPending, router])

  const onSignOut = async () => {
    await signOut()
    // Purge the client-side Router Cache so back navigation after logout
    // re-fetches from the server, where middleware redirects to /login.
    router.push("/login")
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg text-muted-foreground">
          Signed in as {session?.user.email}
        </p>
        <p className="text-lg">{hello?.greeting ?? "Loading tRPC..."}</p>
        <Button onClick={onSignOut} variant="outline">
          Sign out
        </Button>
      </CardContent>
    </Card>
  )
}
