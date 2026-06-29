import { createHmac, timingSafeEqual } from "crypto";
import { billingSubscriptions, db, workspaces } from "@alfred/db";
import { eq } from "drizzle-orm";

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    subscription?: { entity?: { id?: string; current_start?: number; current_end?: number } };
    payment?: { entity?: { id?: string; subscription_id?: string } };
  };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || !verifySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Never log the full payload — it may contain sensitive billing data.
  const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  console.log(`razorpay webhook: event=${payload.event}`);

  try {
    if (payload.event === "subscription.activated") {
      const sub = payload.payload?.subscription?.entity;
      if (sub?.id) {
        const [billing] = await db
          .update(billingSubscriptions)
          .set({
            status: "active",
            currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : null,
            currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
          })
          .where(eq(billingSubscriptions.razorpaySubscriptionId, sub.id))
          .returning();

        if (billing) {
          await db
            .update(workspaces)
            .set({ plan: billing.plan, billingStatus: "active" })
            .where(eq(workspaces.id, billing.workspaceId));
        }
      }
    } else if (payload.event === "subscription.cancelled") {
      const sub = payload.payload?.subscription?.entity;
      if (sub?.id) {
        const [billing] = await db
          .update(billingSubscriptions)
          .set({ status: "cancelled" })
          .where(eq(billingSubscriptions.razorpaySubscriptionId, sub.id))
          .returning();

        if (billing) {
          await db
            .update(workspaces)
            .set({ plan: "free", billingStatus: "cancelled" })
            .where(eq(workspaces.id, billing.workspaceId));
        }
      }
    } else if (payload.event === "payment.failed") {
      const subscriptionId = payload.payload?.payment?.entity?.subscription_id;
      if (subscriptionId) {
        const [billing] = await db
          .update(billingSubscriptions)
          .set({ status: "past_due" })
          .where(eq(billingSubscriptions.razorpaySubscriptionId, subscriptionId))
          .returning();

        if (billing) {
          await db
            .update(workspaces)
            .set({ billingStatus: "past_due" })
            .where(eq(workspaces.id, billing.workspaceId));
        }
      }
    }
  } catch (error) {
    console.error("Failed to process razorpay webhook", error);
  }

  return new Response("ok", { status: 200 });
}
