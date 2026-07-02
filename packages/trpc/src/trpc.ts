import { initTRPC, TRPCError } from "@trpc/server";
import { type OpenApiMeta } from "trpc-to-openapi";
import superjson from "superjson";
import { z } from "zod";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { users } from "@alfred/db";
import type { Context } from "./context";
import { type MembershipRole, requireMembership } from "./permissions";

const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      // Extract top-level Zod field name (first failing path segment) for
      // client-side per-field error display.
      const field =
        error.cause instanceof ZodError
          ? (error.cause.errors[0]?.path.join(".") || undefined)
          : undefined;

      // Billing-limit errors are tagged via `cause` (TRPCError's `code` must
      // stay one of tRPC's standard codes) so the client can distinguish them
      // from generic FORBIDDEN responses without string-matching messages.
      const billingLimit =
        (error.cause as { billingLimit?: boolean } | undefined)
          ?.billingLimit === true;
      const errorCode = billingLimit ? "BILLING_LIMIT" : undefined;

      // Clean envelope per the audit: `{ code, message, field? }`, plus the
      // `httpStatus` tRPC's HTTP transport needs from the default shape —
      // deliberately not spreading the rest of the default `shape`/`shape.data`.
      return {
        code: shape.code,
        message: shape.message,
        data: {
          code: error.code,
          httpStatus: shape.data?.httpStatus,
          path: shape.data?.path,
          field,
          errorCode,
        },
      };
    },
  });

export const createTRPCRouter = t.router;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

/** No auth required. */
export const publicProcedure = t.procedure;

const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/** Requires a valid session. */
export const protectedProcedure = publicProcedure.use(isAuthed);

const isPlatformAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const [row] = await ctx.db
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);

  if (!row?.isPlatformAdmin) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Requires a valid session AND a platform-admin flag on the user record.
 * Re-checked against the DB on every call (not cached in the session) so
 * flipping the flag takes effect immediately.
 */
export const adminProcedure = publicProcedure.use(isPlatformAdmin);

export const workspaceInputSchema = z.object({
  workspaceId: z.string().uuid(),
});

const hasWorkspaceMembership = middleware(
  async ({ ctx, getRawInput, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const raw = await getRawInput();
    const { workspaceId } = workspaceInputSchema.parse(raw);

    const role = await requireMembership(ctx.user.id, workspaceId);

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        workspaceId,
        role,
      },
    });
  },
);

/** Requires a valid session AND active membership in `input.workspaceId`. */
export const workspaceProcedure = publicProcedure.use(hasWorkspaceMembership);

/**
 * Chain after `workspaceProcedure` to restrict an action to specific roles,
 * e.g. `workspaceProcedure.use(requireWorkspaceRole(["owner", "admin"]))`.
 */
export function requireWorkspaceRole(allowedRoles: MembershipRole[]) {
  return middleware(({ ctx, next }) => {
    const role = (ctx as { role?: MembershipRole }).role;

    if (!role || !allowedRoles.includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires one of these roles: ${allowedRoles.join(", ")}`,
      });
    }

    return next({ ctx });
  });
}
