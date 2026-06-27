import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import type { Context } from "./context";
import { type MembershipRole, requireMembership } from "./permissions";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
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

const workspaceInputSchema = z.object({ workspaceId: z.string().uuid() });

const hasWorkspaceMembership = middleware(async ({ ctx, getRawInput, next }) => {
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
});

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
