"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  CaretDownIcon,
  CodeIcon,
  CreditCardIcon,
  GearIcon,
  GithubLogoIcon,
  HouseIcon,
  PlusIcon,
  ScrollIcon,
  SignOutIcon,
  SparkleIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { PHASE_COLORS } from "@/lib/phase-colors";
import { useSession, signOut } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GooDropdown } from "@/components/ui/goo-dropdown";

const NAV_ITEMS = [
  { label: "Dashboard", icon: HouseIcon, segment: "dashboard", shortcut: "G D" },
  {
    label: "Features",
    icon: SparkleIcon,
    segment: "features",
    color: PHASE_COLORS.amber,
    shortcut: "G F",
  },
  { label: "GitHub", icon: GithubLogoIcon, segment: "github", shortcut: "G H" },
  { label: "Changelog", icon: ScrollIcon, segment: "changelog", shortcut: "G C" },
] as const;

const BOTTOM_ITEMS = [
  { label: "Billing", icon: CreditCardIcon, segment: "billing" },
  { label: "Settings", icon: GearIcon, segment: "settings" },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  color,
  shortcut,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  color?: string;
  shortcut?: string;
}) {
  return (
    <Link
      href={href}
      style={
        color ? ({ "--nav-color": color } as React.CSSProperties) : undefined
      }
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-semibold transition-colors",
        isActive
          ? color
            ? "text-[var(--nav-color)]"
            : "text-foreground"
          : color
            ? "text-muted-foreground hover:bg-muted hover:text-[var(--nav-color)]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="flex items-center gap-0.5">
          {shortcut.split(" ").map((key) => (
            <kbd
              key={key}
              className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground"
            >
              {key}
            </kbd>
          ))}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();

  const { data: workspaces } = useQuery(trpc.workspace.list.queryOptions());
  const currentWorkspace = workspaces?.find((w) => w.id === workspaceId);

  const pendingGRef = useRef(false);
  const gTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);

        const segments: Record<string, string> = { d: "dashboard", f: "features", h: "github", c: "changelog" };
        if (segments[key]) {
          e.preventDefault();
          router.push(`/workspace/${workspaceId}/${segments[key]}`);
        }
        return;
      }

      if (key === "g") {
        pendingGRef.current = true;
        gTimeoutRef.current = setTimeout(() => { pendingGRef.current = false; }, 1000);
        return;
      }

      if (key === "n") {
        e.preventDefault();
        router.push(`/workspace/${workspaceId}/features/new`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
    };
  }, [workspaceId, router]);

  const onSignOut = async () => {
    await signOut();
    // Purge the client-side Router Cache so back navigation after logout
    // re-fetches from the server, where middleware redirects to /login.
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-border bg-card">
      <Link
        href={`/workspace/${workspaceId}/dashboard`}
        className="flex items-center px-4 py-5 text-foreground"
      >
        <span className="font-mono text-lg font-semibold">A.L.F.R.E.D</span>
      </Link>

      <div className="mx-3">
        <GooDropdown
          panelWidth={216}
          align="start"
          triggerClassName="flex w-full items-center justify-between gap-2 bg-muted px-3 py-2 text-left text-base font-semibold hover:bg-muted/70"
          trigger={
            <>
              <span className="truncate">
                {currentWorkspace?.name ?? "Select workspace"}
              </span>
              <CaretDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          }
        >
          {(close) => (
            <>
              <div className="px-2 py-2 text-sm text-muted-foreground">
                Workspaces
              </div>
              {workspaces?.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => {
                    router.push(`/workspace/${workspace.id}/dashboard`);
                    close();
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">{workspace.name}</span>
                  <Badge variant="secondary" className="capitalize">
                    {workspace.plan}
                  </Badge>
                </button>
              ))}
              <div className="-mx-1 my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  router.push("/onboarding/workspace");
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent [&_svg]:size-4"
              >
                <PlusIcon />
                Create new workspace
              </button>
            </>
          )}
        </GooDropdown>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const href = `/workspace/${workspaceId}/${item.segment}`;
          return (
            <NavLink
              key={item.segment}
              href={href}
              label={item.label}
              icon={item.icon}
              isActive={pathname.startsWith(href)}
              color={"color" in item ? item.color : undefined}
              shortcut={item.shortcut}
            />
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-2">
        {BOTTOM_ITEMS.map((item) => {
          const href = `/workspace/${workspaceId}/${item.segment}`;
          return (
            <NavLink
              key={item.segment}
              href={href}
              label={item.label}
              icon={item.icon}
              isActive={pathname.startsWith(href)}
            />
          );
        })}
        <Link
          href="/docs"
          className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <CodeIcon className="size-4" />
          API Docs
        </Link>
      </div>

      <GooDropdown
        panelWidth={240}
        align="start"
        side="top"
        buttonRadius={0}
        triggerClassName="flex w-full items-center gap-2 border-t border-border px-3 py-3 text-left hover:bg-muted"
        trigger={
          <>
            <Avatar size="sm">
              <AvatarImage
                src={session?.user.image ?? undefined}
                alt={session?.user.name ?? ""}
              />
              <AvatarFallback>
                {session?.user.name?.slice(0, 2).toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col overflow-hidden leading-tight">
              <span className="truncate text-base font-semibold text-foreground">
                {session?.user.name ?? "Account"}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {session?.user.email}
              </span>
            </div>
          </>
        }
      >
        {(close) => (
          <>
            <button
              type="button"
              onClick={() => {
                onSignOut();
                close();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-destructive hover:bg-destructive/10 [&_svg]:size-4"
            >
              <SignOutIcon />
              Log out
            </button>
          </>
        )}
      </GooDropdown>
    </aside>
  );
}
