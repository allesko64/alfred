import { FeatureHeader } from "@/components/workspace/feature-detail/feature-header"
import { FeatureDock } from "./feature-dock"

export default async function FeatureDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string; featureId: string }>
}) {
  const { workspaceId, featureId } = await params

  return (
    <div className="flex flex-col">
      <FeatureHeader workspaceId={workspaceId} featureId={featureId} />
      <div className="flex-1 px-6 pb-24">{children}</div>
      <FeatureDock workspaceId={workspaceId} featureId={featureId} />
    </div>
  )
}
