"use client";

import { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@alfred/trpc";
import { toast } from "sonner";

export type AppTRPCError = TRPCClientError<AppRouter>;

export function isTRPCError(error: unknown): error is AppTRPCError {
  return error instanceof TRPCClientError;
}

/** True when the error is a billing/credits exhaustion FORBIDDEN. */
export function isBillingLimitError(error: unknown): boolean {
  if (!isTRPCError(error)) return false;
  return (error.data as { errorCode?: string } | undefined)?.errorCode === "BILLING_LIMIT";
}

/**
 * Central tRPC error handler.
 *
 * Returns `true` if the error was fully handled (so callers can skip their own
 * fallback toast). Pass `workspaceId` to make the "Upgrade" link workspace-aware.
 */
export function handleTRPCError(error: unknown, workspaceId?: string): boolean {
  if (!isTRPCError(error)) return false;

  const code = error.data?.code as string | undefined;

  if (code === "UNAUTHORIZED") {
    // Avoid a redirect loop if we're already on an auth page.
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    return true;
  }

  if (isBillingLimitError(error)) {
    const billingHref = workspaceId ? `/workspace/${workspaceId}/billing` : "/billing";
    toast.error("Out of AI credits", {
      description: "Upgrade your plan to keep using Alfred's AI features.",
      action: {
        label: "Upgrade",
        onClick: () => window.location.assign(billingHref),
      },
    });
    return true;
  }

  if (code === "FORBIDDEN") {
    toast.error("Access denied", {
      description: error.message || "You don't have permission to perform this action.",
    });
    return true;
  }

  if (code === "NOT_FOUND") {
    toast.error("Not found", {
      description: error.message || "The requested resource was not found.",
    });
    return true;
  }

  return false;
}
