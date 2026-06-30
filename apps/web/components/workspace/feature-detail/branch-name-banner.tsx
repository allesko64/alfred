"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { slugify } from "@/lib/utils"

export function BranchNameBanner({
  featureId,
  featureTitle,
  repoName,
}: {
  featureId: string
  featureTitle: string
  repoName: string | null
}) {
  const [copied, setCopied] = useState(false)
  // The trailing 8-char id is what auto-link matching keys off of (see
  // BRANCH_PATTERN in pr-ingestion.workflow.ts) — the rest is for readability.
  const titleSlug = slugify(featureTitle) || "feature"
  const repoSlug = repoName ? slugify(repoName) : null
  const shortId = featureId.replace(/-/g, "").slice(0, 8)
  const branchName = `${[repoSlug, titleSlug].filter(Boolean).join("/")}-${shortId}`

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
