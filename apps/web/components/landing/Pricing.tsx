import { Pricing as PricingCards } from "@/components/pricing"
import { PRICING_PLANS } from "@/lib/pricing-plans"

export function Pricing() {
  return (
    <section id="pricing" className="relative bg-background py-24">
      <div className="max-w-6xl mx-auto px-6">
        <PricingCards plans={PRICING_PLANS} />
      </div>
    </section>
  )
}
