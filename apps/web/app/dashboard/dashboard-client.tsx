"use client"

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

  const onSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Signed in as {session?.user.email}
        </p>
        <p className="text-sm">{hello?.greeting ?? "Loading tRPC..."}</p>
        <Button onClick={onSignOut} variant="outline">
          Sign out
        </Button>
      </CardContent>
    </Card>
  )
}
