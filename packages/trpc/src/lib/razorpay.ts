import Razorpay from "razorpay";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

let client: Razorpay | undefined;

export function getRazorpayClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: requiredEnv("RAZORPAY_KEY_ID"),
      key_secret: requiredEnv("RAZORPAY_KEY_SECRET"),
    });
  }
  return client;
}

export type PaidPlan = "pro" | "team";

/** Razorpay plan IDs created in the dashboard (execution_plan.md 11.1) — one per paid plan. */
export function getRazorpayPlanId(plan: PaidPlan): string {
  return requiredEnv(plan === "pro" ? "RAZORPAY_PLAN_ID_PRO" : "RAZORPAY_PLAN_ID_TEAM");
}
