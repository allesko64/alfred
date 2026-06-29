import { Sidebar } from "@/components/workspace/sidebar"
import { WorkspaceEventsListener } from "@/components/workspace/workspace-events-listener"

export default async function WorkspaceShellLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  return (
    <>
      <WorkspaceEventsListener workspaceId={workspaceId} />
      <Sidebar workspaceId={workspaceId} />
      <div className="pl-60">{children}</div>
    </>
  )
}
