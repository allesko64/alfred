import { Sidebar } from "@/components/workspace/sidebar"

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
      <Sidebar workspaceId={workspaceId} />
      <div className="pl-60">{children}</div>
    </>
  )
}
