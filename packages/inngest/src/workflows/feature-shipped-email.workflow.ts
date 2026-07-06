import {
  db,
  features,
  prds,
  users,
  workspaceMemberships,
  workspaces,
} from "@alfred/db";
import { and, eq } from "drizzle-orm";
import type { InngestFunction } from "inngest";
import { inngest } from "../client";
import { EMAIL_FROM, getResendClient } from "../email";

interface ShippedEmailContext {
  featureTitle: string;
  workspaceName: string;
  problemStatement: string | null;
  decisionPills: string[];
  approverName: string | null;
  shippedAt: string | null;
  featureUrl: string;
}

function renderShippedEmail(
  recipientName: string,
  ctx: ShippedEmailContext,
): string {
  const pills =
    ctx.decisionPills.length > 0
      ? `<p><strong>Key decisions:</strong><br/>${ctx.decisionPills
          .map((pill) => `→ ${pill}`)
          .join("<br/>")}</p>`
      : "";

  const about = ctx.problemStatement
    ? `<p><strong>What it solves:</strong><br/>${ctx.problemStatement}</p>`
    : "";

  const meta = [
    ctx.approverName ? `Approved by ${ctx.approverName}` : null,
    ctx.shippedAt ? `Shipped on ${ctx.shippedAt}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return `<div style="font-family: sans-serif; line-height: 1.5;">
    <p>Hi ${recipientName} 👋</p>
    <p>🎉 <strong>"${ctx.featureTitle}"</strong> just shipped in ${ctx.workspaceName}!</p>
    ${about}
    ${pills}
    ${meta ? `<p style="color: #666; font-size: 13px;">${meta}</p>` : ""}
    <p><a href="${ctx.featureUrl}">View the feature →</a></p>
  </div>`;
}

const _featureShippedEmailWorkflow = inngest.createFunction(
  {
    id: "feature-shipped-email",
    triggers: [{ event: "feature/shipped-email.requested" }],
  },
  async ({ event, step }) => {
    const { featureId } = event.data as { featureId: string };

    const context = await step.run("fetch-context", async () => {
      const [feature] = await db
        .select()
        .from(features)
        .where(eq(features.id, featureId))
        .limit(1);
      if (!feature) return null;

      const [workspace] = await db
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, feature.workspaceId))
        .limit(1);

      const [prd] = await db
        .select({ problemStatement: prds.problemStatement })
        .from(prds)
        .where(eq(prds.featureId, featureId))
        .limit(1);

      const approver = feature.approvedBy
        ? (
            await db
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, feature.approvedBy))
              .limit(1)
          )[0]
        : undefined;

      const members = await db
        .select({ email: users.email, name: users.name })
        .from(workspaceMemberships)
        .innerJoin(users, eq(users.id, workspaceMemberships.userId))
        .where(
          and(
            eq(workspaceMemberships.workspaceId, feature.workspaceId),
            eq(workspaceMemberships.status, "active"),
          ),
        );

      return { feature, workspace, prd, approver, members };
    });

    if (!context) {
      return { status: "skipped", reason: "feature-not-found" };
    }

    const { feature, workspace, prd, approver, members } = context;

    const emailContext: ShippedEmailContext = {
      featureTitle: feature.title,
      workspaceName: workspace?.name ?? "your workspace",
      problemStatement: prd?.problemStatement ?? null,
      decisionPills: feature.decisionPills ?? [],
      approverName: approver?.name ?? null,
      shippedAt: feature.shippedAt
        ? new Date(feature.shippedAt).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })
        : null,
      featureUrl: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? ""}/workspace/${feature.workspaceId}/features/${featureId}`,
    };

    const sentCount = await step.run("send-emails", async () => {
      const resend = getResendClient();
      if (!resend) {
        console.warn(
          "RESEND_API_KEY not set — skipping feature-shipped email send",
        );
        return 0;
      }

      let sent = 0;
      for (const member of members) {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: member.email,
          subject: `🎉 Shipped: ${feature.title}`,
          html: renderShippedEmail(member.name ?? "there", emailContext),
        });
        sent += 1;
      }
      return sent;
    });

    return { status: "completed", sentCount };
  },
);

export const featureShippedEmailWorkflow: InngestFunction.Any =
  _featureShippedEmailWorkflow;
