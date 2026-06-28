import { Sidebar } from "@/components/workspace/sidebar"

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  return (
    <div className="min-h-screen bg-background">
      <Sidebar workspaceId={workspaceId} />
      <div className="pl-60">{children}</div>
    </div>
  )
}
