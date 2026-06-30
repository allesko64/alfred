"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  GithubLogoIcon,
  LinkedinLogoIcon,
  MagnifyingGlassIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react"

import { useTRPC } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { StatusBadge, statusLabel } from "@/components/workspace/dashboard/status-dot"

const SOCIAL_LINKS = [
  { label: "Follow on X", href: "https://x.com/ayush__64", icon: XLogoIcon },
  { label: "Connect on LinkedIn", href: "https://www.linkedin.com/in/ayush-sharma-5b7938282/", icon: LinkedinLogoIcon },
  { label: "View on GitHub", href: "https://github.com/allesko64", icon: GithubLogoIcon },
]

export function SearchPalette({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const trpc = useTRPC()

  const { data: features } = useQuery(
    trpc.feature.list.queryOptions({ workspaceId }, { enabled: open }),
  )

  const results = useMemo(() => {
    if (!features) return []
    const q = query.trim().toLowerCase()
    if (!q) return features.slice(0, 8)
    return features.filter((feature) => feature.title.toLowerCase().includes(q)).slice(0, 8)
  }, [features, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  function goToFeature(featureId: string) {
    setOpen(false)
    router.push(`/workspace/${workspaceId}/features/${featureId}`)
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const feature = results[activeIndex]
      if (feature) goToFeature(feature.id)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <button
            type="button"
            className="relative mx-auto w-full max-w-md text-left"
          />
        }
      >
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <span className="flex h-8 w-full items-center rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-muted-foreground">
          Search features...
        </span>
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 isolate z-50 bg-black/20 backdrop-blur-sm duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-24 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="relative flex items-center border-b border-border px-4">
            <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Type a command or search..."
              className="h-12 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <DialogPrimitive.Close
              render={
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                />
              }
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
              Connect
            </div>
            {SOCIAL_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setOpen(false)}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {link.label}
                </a>
              )
            })}

            <div className="mt-2 px-2 py-1.5 text-sm font-medium text-muted-foreground">
              {query.trim() ? "Features" : "Recent features"}
            </div>
            {results.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No features match &quot;{query}&quot;
              </div>
            )}
            {results.map((feature, index) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => goToFeature(feature.id)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm",
                  index === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span className="truncate">{feature.title}</span>
                <StatusBadge status={feature.status} className="shrink-0" />
                <span className="sr-only">{statusLabel(feature.status)}</span>
              </button>
            ))}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
