"use client"

import { useParams } from "next/navigation"

import { TopBar } from "@/components/workspace/topbar"
import { StatCards } from "@/components/workspace/dashboard/stat-cards"
import { FeaturePipeline } from "@/components/workspace/dashboard/feature-pipeline"
import { ActivityFeed } from "@/components/workspace/dashboard/activity-feed"
import { RecentFeatures } from "@/components/workspace/dashboard/recent-features"
import { GithubActivity } from "@/components/workspace/dashboard/github-activity"

export function DashboardClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()

  return (
    <div className="flex flex-col">
      <TopBar title="Dashboard" workspaceId={workspaceId} />

      <div className="flex flex-col gap-4 p-6">
        <StatCards workspaceId={workspaceId} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FeaturePipeline workspaceId={workspaceId} />
          <ActivityFeed workspaceId={workspaceId} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RecentFeatures workspaceId={workspaceId} />
          <GithubActivity workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  )
}
