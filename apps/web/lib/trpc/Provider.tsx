"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@alfred/trpc";
import superjson from "superjson";
import * as Sentry from "@sentry/nextjs";
import { TRPCProvider } from "./client";
import { handleTRPCError, isTRPCError } from "./error-handler";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error) {
        // Capture every query error in Sentry.
        Sentry.captureException(error);
        // Redirect immediately for auth errors; let page-level handlers
        // deal with everything else to avoid double-toasting.
        if (isTRPCError(error) && error.data?.code === "UNAUTHORIZED") {
          handleTRPCError(error);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError(error, _variables, _context, mutation) {
        // Capture every mutation error in Sentry.
        Sentry.captureException(error);

        // If the mutation declared its own onError we trust it to show UI
        // feedback — we only step in for UNAUTHORIZED (redirect) here.
        const hasLocalHandler = typeof mutation.options.onError === "function";

        if (hasLocalHandler) {
          if (isTRPCError(error) && error.data?.code === "UNAUTHORIZED") {
            handleTRPCError(error);
          }
          return;
        }

        // No local handler — use the central handler for a consistent toast.
        if (!handleTRPCError(error)) {
          // Generic fallback for non-tRPC or unrecognised errors.
          import("sonner").then(({ toast }) =>
            toast.error("Something went wrong", {
              description:
                error instanceof Error ? error.message : "Please try again.",
            }),
          );
        }
      },
    }),
  });
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
