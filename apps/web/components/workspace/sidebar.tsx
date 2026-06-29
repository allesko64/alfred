"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { motion } from "motion/react"
import {
  CaretDownIcon,
  CreditCardIcon,
  GearIcon,
  GithubLogoIcon,
  HouseIcon,
  PlusIcon,
  ScrollIcon,
  SignOutIcon,
  SparkleIcon,
  UserCircleIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { PHASE_COLORS } from "@/lib/phase-colors"
import { useSession, signOut } from "@/lib/auth-client"
import { useTRPC } from "@/lib/trpc/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const NAV_ITEMS = [
  { label: "Dashboard", icon: HouseIcon, segment: "dashboard" },
  { label: "Features", icon: SparkleIcon, segment: "features", color: PHASE_COLORS.amber },
  { label: "GitHub", icon: GithubLogoIcon, segment: "github" },
  { label: "Changelog", icon: ScrollIcon, segment: "changelog" },
] as const

const BOTTOM_ITEMS = [
  { label: "Billing", icon: CreditCardIcon, segment: "billing" },
  { label: "Settings", icon: GearIcon, segment: "settings" },
] as const

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  color,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  color?: string
}) {
  return (
    <Link
      href={href}
      style={color ? ({ "--nav-color": color } as React.CSSProperties) : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? color
            ? "font-medium text-[var(--nav-color)]"
            : "font-medium text-foreground"
          : color
            ? "font-normal text-muted-foreground hover:bg-muted hover:text-[var(--nav-color)]"
            : "font-normal text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className={cn(
            "absolute inset-y-1 -left-3 w-0.5",
            color ? "bg-[var(--nav-color)]" : "bg-primary",
          )}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <Icon className="size-4" />
      {label}
    </Link>
  )
}

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const trpc = useTRPC()
  const { data: session } = useSession()

  const { data: workspaces } = useQuery(trpc.workspace.list.queryOptions())
  const currentWorkspace = workspaces?.find((w) => w.id === workspaceId)

  const onSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-border bg-card">
      <Link
        href={`/workspace/${workspaceId}/dashboard`}
        className="flex items-center px-4 py-5 text-foreground"
      >
        <span className="font-mono text-lg font-semibold">A.L.F.R.E.D</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="mx-3 flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-left text-xs hover:bg-muted/70"
            />
          }
        >
          <span className="truncate font-medium">
            {currentWorkspace?.name ?? "Select workspace"}
          </span>
          <CaretDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces?.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => router.push(`/workspace/${workspace.id}/dashboard`)}
              className="justify-between"
            >
              <span className="truncate">{workspace.name}</span>
              <Badge variant="secondary" className="capitalize">
                {workspace.plan}
              </Badge>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/onboarding/workspace")}>
            <PlusIcon />
            Create new workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <nav className="mt-4 flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const href = `/workspace/${workspaceId}/${item.segment}`
          return (
            <NavLink
              key={item.segment}
              href={href}
              label={item.label}
              icon={item.icon}
              isActive={pathname.startsWith(href)}
              color={"color" in item ? item.color : undefined}
            />
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-2">
        {BOTTOM_ITEMS.map((item) => {
          const href = `/workspace/${workspaceId}/${item.segment}`
          return (
            <NavLink
              key={item.segment}
              href={href}
              label={item.label}
              icon={item.icon}
              isActive={pathname.startsWith(href)}
            />
          )
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex items-center gap-2 border-t border-border px-3 py-3 text-left hover:bg-muted"
            />
          }
        >
          <Avatar size="sm">
            <AvatarImage src={session?.user.image ?? undefined} alt={session?.user.name ?? ""} />
            <AvatarFallback>
              {session?.user.name?.slice(0, 2).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden leading-tight">
            <span className="truncate text-xs font-medium text-foreground">
              {session?.user.name ?? "Account"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {session?.user.email}
            </span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuItem onClick={() => router.push(`/workspace/${workspaceId}/settings`)}>
            <UserCircleIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onSignOut}>
            <SignOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  )
}
