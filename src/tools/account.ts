// ─── rendex_account Tool ─────────────────────────────────────────────
// Read-only: report the caller's plan, this month's usage (used/limit/
// remaining + reset date), per-minute rate limit, and a one-tap upgrade link.
// Lets an agent answer "how much have I used / how do I get more renders?"
// from inside the chat — no dashboard visit needed. Costs no credits.

import { z } from "zod";
import { RendexClient, RendexApiError } from "../lib/client.js";

export const ACCOUNT_NAME = "rendex_account";

export const ACCOUNT_DESCRIPTION =
  "Check the Rendex account: which plan it's on, how many render credits have been " +
  "used vs. the monthly limit (and when it resets), the per-minute rate limit, and a " +
  "one-tap link to upgrade to a higher tier. Use this whenever the user asks about " +
  "their usage, remaining quota, current plan, or how to get more renders / stop " +
  "hitting limits. Read-only — costs no credits.";

export const AccountInputSchema = z.object({});

export type AccountInput = z.infer<typeof AccountInputSchema>;

export async function handleAccount(client: RendexClient) {
  try {
    const a = await client.account();
    const u = a.usage;

    const usageLine = u.unlimited
      ? "Usage: unlimited (Enterprise)."
      : `Usage this month: ${u.used ?? 0} of ${u.limit ?? 0} render credits used, ` +
        `${u.remaining ?? 0} remaining` +
        (u.resetsAt ? ` (resets ${u.resetsAt.slice(0, 10)}).` : ".");

    const upgradeLine = a.upgrade
      ? `\n\nNeed more? Upgrade to ${a.upgrade.recommendedPlan}` +
        (a.upgrade.recommendedPlanCredits
          ? ` (${a.upgrade.recommendedPlanCredits.toLocaleString()} renders/month)`
          : "") +
        ` in one click — no surprise charges: ${a.upgrade.upgradeUrl}` +
        `\nManage or cancel billing anytime: ${a.upgrade.manageBillingUrl}`
      : "";

    const text =
      `Plan: ${a.plan}\n` +
      `${usageLine}\n` +
      `Rate limit: ${a.rateLimitPerMinute} requests/minute.` +
      upgradeLine;

    return {
      content: [{ type: "text" as const, text }],
    };
  } catch (err) {
    const message =
      err instanceof RendexApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error reading account";
    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
}
