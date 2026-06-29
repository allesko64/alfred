"use client"

import { useParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { useTRPC } from "@/lib/trpc/client"
import { TopBar } from "@/components/workspace/topbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const USAGE_LABELS: Record<string, string> = {
  features: "Features",
  prd_generations: "PRD generations",
  ai_reviews: "AI reviews",
  repos: "Connected repos",
  members: "Team members",
}

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "₹0",
    features: ["3 features", "2 PRD generations", "5 AI reviews", "1 connected repo", "1 team member"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "₹999/mo",
    features: ["Unlimited features", "Unlimited PRD generations", "Unlimited AI reviews", "Unlimited repos & members"],
  },
  {
    id: "team" as const,
    name: "Team",
    price: "₹2999/mo",
    features: ["Everything in Pro", "Priority support", "Team-wide usage analytics"],
  },
]

export function BillingClient() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const trpc = useTRPC()

  const { data: subscriptionData } = useQuery(trpc.billing.getSubscription.queryOptions({ workspaceId }))
  const { data: usage } = useQuery(trpc.billing.getUsage.queryOptions({ workspaceId }))

  const checkout = useMutation(
    trpc.billing.createCheckoutSession.mutationOptions({
      onSuccess: ({ checkoutUrl }) => {
        window.location.href = checkoutUrl
      },
      onError: (error) => toast.error(error.message || "Couldn't start checkout"),
    }),
  )

  const plan = subscriptionData?.workspace?.plan ?? "free"
  const billingStatus = subscriptionData?.workspace?.billingStatus
  const subscription = subscriptionData?.subscription

  return (
    <div className="flex flex-col">
      <TopBar title="Billing" workspaceId={workspaceId} />

      <div className="flex flex-col gap-6 p-6">
        <Card className="max-w-[480px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 capitalize">
              {plan} plan
              {billingStatus && (
                <Badge variant={billingStatus === "active" ? "secondary" : "destructive"} className="capitalize">
                  {billingStatus}
                </Badge>
              )}
            </CardTitle>
            {subscription?.currentPeriodEnd && (
              <CardDescription>
                Current period ends {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        <Card className="max-w-[480px]">
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>
              {plan === "free" ? "Free plan limits" : "Unlimited on your current plan"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {usage &&
              Object.entries(usage).map(([type, result]) => {
                if (!result) return null
                const isUnlimited = !Number.isFinite(result.limit)
                const percent = isUnlimited ? 0 : Math.min(100, (result.current / result.limit) * 100)

                return (
                  <Progress key={type} value={isUnlimited ? null : percent}>
                    <div className="flex w-full items-center justify-between text-xs">
                      <span className="text-foreground">{USAGE_LABELS[type] ?? type}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {isUnlimited ? "Unlimited" : `${result.current}/${result.limit}`}
                      </span>
                    </div>
                  </Progress>
                )
              })}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-4">
          {PLANS.map((p) => (
            <Card key={p.id} className="w-64">
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.price}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {p.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {p.id === "free" ? (
                  <Button size="sm" variant="secondary" disabled className="self-start">
                    {plan === "free" ? "Current plan" : "Free"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="self-start"
                    disabled={plan === p.id || checkout.isPending}
                    onClick={() => checkout.mutate({ workspaceId, plan: p.id })}
                  >
                    {plan === p.id ? "Current plan" : checkout.isPending ? "Redirecting..." : "Upgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
