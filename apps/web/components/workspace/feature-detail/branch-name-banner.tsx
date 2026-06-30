"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

export function BranchNameBanner({ featureId }: { featureId: string }) {
  const [copied, setCopied] = useState(false)
  const branchName = `alfred/${featureId}`

  async function handleCopy() {
    await navigator.clipboard.writeText(branchName)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
      <span>
        Name your branch <code className="rounded bg-muted px-1.5 py-0.5 text-foreground/70">{branchName}</code> to
        auto-link your PR
      </span>
      <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
        {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
      </Button>
    </div>
  )
}
