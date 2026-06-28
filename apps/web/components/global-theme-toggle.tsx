"use client"

import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

export function GlobalThemeToggle() {
  const pathname = usePathname()
  if (pathname === "/" || pathname.startsWith("/workspace/")) return null
  return <ThemeToggle className="fixed right-4 top-4 z-50" />
}
