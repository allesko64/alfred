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
import { Pricing } from "@/components/pricing"
import { PRICING_PLANS } from "@/lib/pricing-plans"

const USAGE_LABELS: Record<string, string> = {
  credits: "AI credits used",
  repos: "Connected repos",
  members: "Team members",
}

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
            <CardDescription>Credits reset monthly. Features, tasks, and PRDs are always unlimited.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {usage &&
              Object.entries(usage).map(([type, result]) => {
                if (!result) return null
                const isUnlimited = !Number.isFinite(result.limit)
                const percent = isUnlimited ? 0 : Math.min(100, (result.current / result.limit) * 100)

                return (
                  <Progress key={type} value={isUnlimited ? null : percent}>
                    <div className="flex w-full items-center justify-between text-sm">
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

        <Pricing
          plans={PRICING_PLANS}
          title="Plans"
          description="Upgrade or downgrade your workspace plan at any time."
          showToggle={false}
          currentPlanId={plan}
          renderAction={(p) => (
            <Button
              variant={p.isPopular ? "default" : "outline"}
              className="w-full rounded-md font-bold"
              disabled={plan === p.id || p.id === "free" || checkout.isPending}
              onClick={() => checkout.mutate({ workspaceId, plan: p.id as "pro" | "team" })}
            >
              {plan === p.id
                ? "Current plan"
                : p.id === "free"
                  ? "Free"
                  : checkout.isPending
                    ? "Redirecting..."
                    : "Upgrade"}
            </Button>
          )}
        />
      </div>
    </div>
  )
}
