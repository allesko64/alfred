import { Suspense } from "react"
import { AdminUsersClient } from "./admin-users-client"

export default function AdminUsersPage() {
  return (
    <Suspense>
      <AdminUsersClient />
    </Suspense>
  )
}
