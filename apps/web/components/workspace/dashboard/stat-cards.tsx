"use client"

import { useQuery } from "@tanstack/react-query"
import {
  ClockIcon,
  LightningIcon,
  RocketLaunchIcon,
  SparkleIcon,
} from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useCountUp } from "@/lib/use-count-up"
import { PHASE_COLORS } from "@/lib/phase-colors"

const STAT_CARDS = [
  { key: "activeFeatures", label: "Active Features", icon: SparkleIcon, color: PHASE_COLORS.amber },
  { key: "inReview", label: "In Review", icon: ClockIcon, color: PHASE_COLORS.orange },
  {
    key: "shippedThisMonth",
    label: "Shipped This Month",
    icon: RocketLaunchIcon,
    color: PHASE_COLORS.emerald,
  },
  { key: "aiCreditsRemaining", label: "AI Credits Remaining", icon: LightningIcon },
] as const

function StatCardValue({ value, color }: { value: number; color?: string }) {
  const display = useCountUp(value)
  return (
    <span
      className={cn("text-[2.75rem] leading-none font-semibold", !color && "text-foreground")}
      style={color ? { color } : undefined}
    >
      {display}
    </span>
  )
}

export function StatCards({ workspaceId }: { workspaceId: string }) {
  const trpc = useTRPC()
  const { data: stats, isLoading } = useQuery(
    trpc.workspace.getDashboardStats.queryOptions({ workspaceId }),
  )

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon
        const value = stats?.[card.key]
        const color = "color" in card ? card.color : undefined

        return (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-xs">{card.label}</CardTitle>
              <Icon
                className={cn("size-4", !color && "text-muted-foreground")}
                style={color ? { color } : undefined}
              />
            </CardHeader>
            <CardContent>
              {isLoading || value === undefined ? (
                <Skeleton className="h-10 w-16" />
              ) : (
                <StatCardValue value={value} color={color} />
              )}
              {card.key === "aiCreditsRemaining" && stats && (
                <span
                  className={cn(
                    "ml-1.5 text-xs text-muted-foreground",
                    stats.aiCreditsRemaining === 0 && "text-destructive",
                  )}
                >
                  / {stats.aiCreditsLimit}
                </span>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
