"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/runs", label: "Feature Runs" },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
