import { Resend } from "resend";

let resendClient: Resend | null | undefined;

/** Lazily created from RESEND_API_KEY; null when the key is unset so callers can skip sending gracefully in dev. */
export function getResendClient(): Resend | null {
  if (resendClient === undefined) {
    const apiKey = process.env.RESEND_API_KEY;
    resendClient = apiKey ? new Resend(apiKey) : null;
  }
  return resendClient;
}

export const EMAIL_FROM = "Alfred <alfred@ayushlabs.tech>";
