import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { Redis } from "@upstash/redis";
import { db, type MembershipRole, workspaceMemberships } from "@alfred/db";

export type { MembershipRole };

const ROLE_CACHE_TTL_MS = 60_000;

const lruCache = new LRUCache<string, MembershipRole>({
  max: 500,
  ttl: ROLE_CACHE_TTL_MS,
});

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

function cacheKey(userId: string, workspaceId: string) {
  return `permission:${workspaceId}:${userId}`;
}

/**
 * L1 (in-process LRU) -> L2 (Upstash Redis) -> DB. Each cache layer is
 * populated on a miss so subsequent requests on this process or any other
 * process avoid the DB round trip.
 */
export async function getMembershipRole(
  userId: string,
  workspaceId: string,
): Promise<MembershipRole | null> {
  const key = cacheKey(userId, workspaceId);

  const lruHit = lruCache.get(key);
  if (lruHit) return lruHit;

  const redis = getRedis();
  if (redis) {
    const redisHit = await redis.get<MembershipRole>(key);
    if (redisHit) {
      lruCache.set(key, redisHit);
      return redisHit;
    }
  }

  const [membership] = await db
    .select({ role: workspaceMemberships.role })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership) return null;

  lruCache.set(key, membership.role);
  if (redis) {
    await redis.set(key, membership.role, { ex: ROLE_CACHE_TTL_MS / 1000 });
  }

  return membership.role;
}

export async function requireMembership(
  userId: string,
  workspaceId: string,
  allowedRoles?: MembershipRole[],
): Promise<MembershipRole> {
  const role = await getMembershipRole(userId, workspaceId);

  if (!role) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this workspace",
    });
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This action requires one of these roles: ${allowedRoles.join(", ")}`,
    });
  }

  return role;
}

export async function invalidateMembershipCache(
  userId: string,
  workspaceId: string,
) {
  const key = cacheKey(userId, workspaceId);
  lruCache.delete(key);

  const redis = getRedis();
  if (redis) {
    await redis.del(key);
  }
}
