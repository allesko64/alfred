"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { buttonVariants } from "@/components/ui/button";

export default function ErrorBoundary({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="text-2xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="max-w-sm text-muted-foreground">
        An unexpected error occurred. We&apos;ve been notified and will look
        into it.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className={buttonVariants({ variant: "default" })}
      >
        Try again
      </button>
    </div>
  );
}
