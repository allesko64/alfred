import Link from "next/link"
import { ArrowRightIcon } from "@phosphor-icons/react"

export function NextStepLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-medium text-success-foreground transition duration-200 hover:bg-success/90"
    >
      {label}
      <ArrowRightIcon className="size-4" />
    </Link>
  )
}
