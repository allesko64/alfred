import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { Pricing } from "@/components/landing/Pricing"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Pricing />
    </main>
  )
}
