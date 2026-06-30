import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Capture 10 % of sessions for performance monitoring.
  tracesSampleRate: 0.1,
  // Only enable in production to keep local logs clean.
  enabled: process.env.NODE_ENV === "production",
  // Don't surface Sentry UI in the terminal.
  debug: false,
});
