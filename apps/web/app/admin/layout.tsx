import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db, users } from "@alfred/db"
import { auth } from "@/lib/auth"
import { AdminNav } from "./admin-nav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    redirect("/login")
  }

  const [user] = await db
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!user?.isPlatformAdmin) {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium text-foreground">Platform Admin</h1>
        <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
      </div>
      <AdminNav />
      {children}
    </div>
  )
}
