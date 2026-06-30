export type PlanId = "free" | "pro" | "team"

export interface PricingPlan {
  id: PlanId
  name: string
  price: number
  yearlyPrice: number
  period: string
  features: string[]
  description: string
  buttonText: string
  href: string
  isPopular: boolean
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    yearlyPrice: 0,
    period: "month",
    description: "For trying Alfred out on a small project.",
    features: [
      "100 AI credits / month",
      "1 connected repo",
      "1 team member (just you)",
      "Unlimited features, tasks & PRDs",
    ],
    buttonText: "Get started free",
    href: "/signup",
    isPopular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 999,
    yearlyPrice: 799,
    period: "month",
    description: "For fast-moving teams shipping every week.",
    features: [
      "2,000 AI credits / month",
      "3 connected repos",
      "5 team members",
      "Everything in Free",
      "Priority AI processing",
    ],
    buttonText: "Get started",
    href: "/signup",
    isPopular: true,
  },
  {
    id: "team",
    name: "Team",
    price: 4999,
    yearlyPrice: 3999,
    period: "month",
    description: "For growing organizations that need more control.",
    features: [
      "10,000 AI credits / month",
      "Unlimited repos",
      "25 team members",
      "Everything in Pro",
      "Shared credit pool, audit logs & priority support",
    ],
    buttonText: "Get started",
    href: "/signup",
    isPopular: false,
  },
]
