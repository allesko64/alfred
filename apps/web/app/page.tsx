import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { FeatureBentoGrid } from "@/components/landing/FeatureBentoGrid"
import { Pricing } from "@/components/landing/Pricing"
import { Footer } from "@/components/ui/footer-section"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <FeatureBentoGrid />
      <Pricing />
      <Footer />
    </main>
  )
}
