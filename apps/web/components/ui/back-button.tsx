"use client"

import { useRouter } from "next/navigation"
import { ArrowLeftIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export function BackButton({
  fallbackHref = "/",
  className,
}: {
  fallbackHref?: string
  className?: string
}) {
  const router = useRouter()

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <ArrowLeftIcon className="size-4" />
      Back
    </button>
  )
}
