import { chatComplete } from "@alfred/ai";
import {
  db,
  features,
  notifications,
  users,
  workspaceMemberships,
  workspaces,
} from "@alfred/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { Resend } from "resend";
import { inngest } from "../client";

const ACTIVE_STATUSES = [
  "PLANNING",
  "TASK_GENERATION",
  "IN_DEVELOPMENT",
  "PR_LINKED",
  "REVIEWING",
  "RE_REVIEWING",
  "REVIEW_PASSED",
] as const;

const APPROVAL_ROLES = ["owner", "admin", "reviewer"] as const;

interface DigestItem {
  title: string;
  detail: string;
}

interface MemberDigest {
  blockingIssues: DigestItem[];
  pendingApprovals: DigestItem[];
  inProgress: DigestItem[];
  shippedYesterday: DigestItem[];
}

/** Converts a UTC instant to the wall-clock hour in `timezone`, so each member can pick their own delivery hour while the cron itself just ticks hourly in UTC. */
function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(date);
    return Number.parseInt(formatted, 10) % 24;
  } catch {
    return date.getUTCHours();
  }
}

async function buildMemberDigest(
  workspaceId: string,
  userId: string,
  role: string,
): Promise<MemberDigest> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [blocking, inProgress, shippedYesterday, approvals] = await Promise.all(
    [
      db
        .select({ title: features.title })
        .from(features)
        .where(
          and(
            eq(features.workspaceId, workspaceId),
            eq(features.assignedTo, userId),
            eq(features.status, "CHANGES_REQUESTED"),
          ),
        ),
      db
        .select({ title: features.title, status: features.status })
        .from(features)
        .where(
          and(
            eq(features.workspaceId, workspaceId),
            eq(features.assignedTo, userId),
            inArray(features.status, ACTIVE_STATUSES),
          ),
        ),
      db
        .select({ title: features.title })
        .from(features)
        .where(
          and(
            eq(features.workspaceId, workspaceId),
            gte(features.shippedAt, oneDayAgo),
          ),
        ),
      (APPROVAL_ROLES as readonly string[]).includes(role)
        ? db
            .select({ title: features.title })
            .from(features)
            .where(
              and(
                eq(features.workspaceId, workspaceId),
                eq(features.status, "PENDING_APPROVAL"),
              ),
            )
        : Promise.resolve([]),
    ],
  );

  return {
    blockingIssues: blocking.map((f) => ({
      title: f.title,
      detail: "has blocking review issues waiting for fixes",
    })),
    pendingApprovals: approvals.map((f) => ({
      title: f.title,
      detail: "is pending your approval",
    })),
    inProgress: inProgress.map((f) => ({
      title: f.title,
      detail: `is currently ${f.status.toLowerCase().replaceAll("_", " ")}`,
    })),
    shippedYesterday: shippedYesterday.map((f) => ({
      title: f.title,
      detail: "was approved and shipped",
    })),
  };
}

function summarizeDigest(digest: MemberDigest): string {
  return [
    digest.blockingIssues.length > 0
      ? `${digest.blockingIssues.length} blocking issue(s)`
      : null,
    digest.pendingApprovals.length > 0
      ? `${digest.pendingApprovals.length} approval(s) pending`
      : null,
    digest.inProgress.length > 0
      ? `${digest.inProgress.length} feature(s) in progress`
      : null,
    digest.shippedYesterday.length > 0
      ? `${digest.shippedYesterday.length} feature(s) shipped yesterday`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
}

async function generateIntroLine(
  name: string,
  digest: MemberDigest,
): Promise<string> {
  const summary = summarizeDigest(digest);

  const prompt = `You are Alfred, an AI software delivery co-pilot writing a one-line, friendly
intro for ${name}'s daily digest email. Their day looks like: ${summary || "nothing urgent — a quiet day"}.
Write exactly one short sentence (max 20 words), warm and direct, no emoji, no greeting (the greeting
is already written separately). Respond with just the sentence, nothing else.`;

  try {
    return (await chatComplete([{ role: "system", content: prompt }])).trim();
  } catch {
    return summary
      ? "You have a few things on your plate today."
      : "Smooth sailing today.";
  }
}

function renderDigestEmail(
  name: string,
  intro: string,
  digest: MemberDigest,
): string {
  function section(emoji: string, label: string, items: DigestItem[]): string {
    if (items.length === 0) return "";
    const lines = items
      .map((item) => `→ "${item.title}" ${item.detail}`)
      .join("<br/>");
    return `<p><strong>${emoji} ${label}:</strong><br/>${lines}</p>`;
  }

  return `<div style="font-family: sans-serif; line-height: 1.5;">
    <p>Good morning ${name} 👋</p>
    <p>${intro}</p>
    ${section("🔴", "Needs your attention", digest.blockingIssues)}
    ${section("🔴", "Pending approvals", digest.pendingApprovals)}
    ${section("🟡", "In progress", digest.inProgress)}
    ${section("✅", "Shipped yesterday", digest.shippedYesterday)}
    <p><a href="${process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? ""}">Open Alfred →</a></p>
  </div>`;
}

let resendClient: Resend | null | undefined;

function getResendClient(): Resend | null {
  if (resendClient === undefined) {
    const apiKey = process.env.RESEND_API_KEY;
    resendClient = apiKey ? new Resend(apiKey) : null;
  }
  return resendClient;
}

const _dailyDigestWorkflow = inngest.createFunction(
  { id: "daily-digest", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    const now = new Date();

    const activeWorkspaces = await step.run(
      "fetch-active-workspaces",
      async () => {
        return db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.billingStatus, "active"));
      },
    );

    let sentCount = 0;

    for (const workspace of activeWorkspaces) {
      const members = await step.run(
        `fetch-members-${workspace.id}`,
        async () => {
          return db
            .select({
              userId: workspaceMemberships.userId,
              role: workspaceMemberships.role,
              email: users.email,
              name: users.name,
              digestEnabled: users.digestEnabled,
              digestHourLocal: users.digestHourLocal,
              digestTimezone: users.digestTimezone,
            })
            .from(workspaceMemberships)
            .innerJoin(users, eq(users.id, workspaceMemberships.userId))
            .where(
              and(
                eq(workspaceMemberships.workspaceId, workspace.id),
                eq(workspaceMemberships.status, "active"),
              ),
            );
        },
      );

      for (const member of members) {
        if (!member.digestEnabled) continue;
        if (
          getHourInTimezone(now, member.digestTimezone) !==
          member.digestHourLocal
        )
          continue;

        await step.run(
          `send-digest-${workspace.id}-${member.userId}`,
          async () => {
            const digest = await buildMemberDigest(
              workspace.id,
              member.userId,
              member.role,
            );
            const name = member.name ?? "there";
            const intro = await generateIntroLine(name, digest);

            const resend = getResendClient();
            if (resend) {
              await resend.emails.send({
                from: "Alfred <alfred@alfred.dev>",
                to: member.email,
                subject: `Your Alfred digest — ${now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
                html: renderDigestEmail(name, intro, digest),
              });
            } else {
              console.warn(
                "RESEND_API_KEY not set — skipping digest email send, in-app notification still created",
              );
            }

            await db.insert(notifications).values({
              userId: member.userId,
              workspaceId: workspace.id,
              type: "daily_digest",
              title: "Your daily digest is ready",
              message: intro,
            });
          },
        );

        sentCount += 1;
      }
    }

    return { status: "completed", sentCount };
  },
);

export const dailyDigestWorkflow: InngestFunction.Any = _dailyDigestWorkflow;
