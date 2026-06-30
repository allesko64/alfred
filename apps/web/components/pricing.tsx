"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import NumberFlow from "@number-flow/react"
import { Check, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import type { PricingPlan } from "@/lib/pricing-plans"

interface PricingProps {
  plans: PricingPlan[]
  title?: string
  description?: string
  showToggle?: boolean
  currentPlanId?: string
  renderAction?: (plan: PricingPlan, isMonthly: boolean) => React.ReactNode
}

export function Pricing({
  plans,
  title = "Simple, transparent pricing",
  description = "Choose the plan that works for you.\nAll plans include access to the Alfred platform and core AI tooling.",
  showToggle = true,
  currentPlanId,
  renderAction,
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true)
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const switchRef = useRef<HTMLButtonElement>(null)

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked)
    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect()
      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
        colors: ["#0075DE", "#338FE6", "#16A34A"],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ["circle"],
      })
    }
  }

  return (
    <div className="w-full">
      {(title || description) && (
        <div className="text-center space-y-4 mb-12">
          {title && (
            <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-muted-foreground text-lg whitespace-pre-line">
              {description}
            </p>
          )}
        </div>
      )}

      {showToggle && (
        <div className="flex justify-center items-center gap-2 mb-10">
          <Label>
            <Switch ref={switchRef} checked={!isMonthly} onCheckedChange={handleToggle} />
          </Label>
          <span className="font-semibold text-foreground">
            Annual billing <span className="text-primary">(Save 20%)</span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map((plan, index) => {
          const isCurrent = currentPlanId === plan.id
          const price = isMonthly ? plan.price : plan.yearlyPrice

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{
                opacity: 1,
                y: isDesktop && plan.isPopular ? -8 : 0,
              }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
              className={cn(
                "relative flex h-full flex-col rounded-2xl border bg-card p-6 text-center transition-colors",
                plan.isPopular
                  ? "pricing-card-pro shadow-lg"
                  : "border-border",
                isCurrent && !plan.isPopular && "border-primary"
              )}
            >
              {plan.isPopular && !isCurrent && (
                <div className="absolute top-0 right-0 bg-primary py-0.5 px-2.5 rounded-bl-xl rounded-tr-2xl flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-current text-primary-foreground" />
                  <span className="text-primary-foreground text-sm font-semibold">Popular</span>
                </div>
              )}
              {isCurrent && (
                <Badge className="absolute top-4 right-4" variant="secondary">
                  Current plan
                </Badge>
              )}

              <div className="flex-1 flex flex-col">
                <p className="text-base font-semibold text-muted-foreground">{plan.name}</p>

                <div className="mt-6 flex items-center justify-center gap-x-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground">
                    <NumberFlow
                      value={price}
                      format={{
                        style: "currency",
                        currency: "INR",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }}
                      transformTiming={{ duration: 500, easing: "ease-out" }}
                      willChange
                      className="tabular-nums"
                    />
                  </span>
                  {price > 0 && (
                    <span className="text-sm font-semibold text-muted-foreground">
                      /{plan.period}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-5 text-muted-foreground">
                  {price === 0 ? "free forever" : isMonthly ? "billed monthly" : "billed annually"}
                </p>

                <ul className="mt-6 gap-2.5 flex flex-col">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-left text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <hr className="w-full my-6 border-border" />

                <div className="mt-auto">
                  {renderAction ? (
                    renderAction(plan, isMonthly)
                  ) : (
                    <Button
                      variant={plan.isPopular ? "default" : "outline"}
                      className="w-full rounded-md font-bold"
                      render={<Link href={plan.href} />}
                      nativeButton={false}
                    >
                      {plan.buttonText}
                    </Button>
                  )}
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    {plan.description}
                  </p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
