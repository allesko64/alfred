"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { buttonVariants } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-xl font-bold tracking-tight">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred while loading this page.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Try again
      </button>
    </div>
  );
}
