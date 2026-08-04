// ─── Unkey: mint the managed per-user MCP key ────────────────────────
// Mirrors the dashboard's createApiKey (apps/landing/src/app/dashboard/
// actions.ts) EXACTLY so the minted key behaves like any other rdx_ key:
// bound to the user's identity (externalId = userId) → bills against their
// per-user credit pool + inherits their plan via meta.plan. The plaintext is
// returned only once, here, so the caller must persist it immediately.

import { Unkey } from "@unkey/api";

// Keep in sync with the shared PLAN_RATE_LIMITS / PLAN_LIMITS and the dashboard
// PLAN_CONFIG — this sets the enforced identity rate limit for MCP-OAuth signups.
const PLAN_RATE_LIMITS: Record<string, number> = {
  free: 3,
  basic: 20,
  starter: 60,
  pro: 300,
  enterprise: 1000,
};

export interface MintedKey {
  keyId: string;
  key: string;
  keyHint: string;
}

/** Masked hint for storage/display (matches the dashboard's makeKeyHint). */
function makeKeyHint(fullKey: string): string {
  if (fullKey.length <= 12) return `${fullKey.slice(0, 8)}...`;
  return `${fullKey.slice(0, 8)}...${fullKey.slice(-4)}`;
}

export async function mintManagedKey(
  rootKey: string,
  apiId: string,
  userId: string,
  plan: string
): Promise<MintedKey> {
  const unkey = new Unkey({ rootKey });

  const response = await unkey.keys.createKey({
    apiId,
    prefix: "rdx",
    externalId: userId,
    // plan is read on every API request (gating, billing) — readers fall back
    // to "free" when absent. name flags this as the connector-managed key.
    meta: { product: "screenshot-api", flagged: "false", plan, source: "mcp-oauth" },
    name: "MCP Connector",
    // Credits are pooled per-user in Supabase; null keeps verifyKey from
    // decrementing or returning USAGE_EXCEEDED on the key itself.
    credits: { remaining: null },
  } as Parameters<typeof unkey.keys.createKey>[0]);

  const keyId = response.data.keyId;
  const key = response.data.key;

  // Pool the per-minute rate limit on the user's identity (createKey
  // auto-created the identity via externalId). Falls back to a per-key limit so
  // a fresh key is never left unlimited.
  const limit = PLAN_RATE_LIMITS[plan] ?? PLAN_RATE_LIMITS.free;
  const ratelimits = [{ name: "requests", limit, duration: 60_000, autoApply: true }];
  try {
    await unkey.identities.updateIdentity({ identity: userId, ratelimits });
  } catch {
    await unkey.keys.updateKey({ keyId, ratelimits }).catch(() => {});
  }

  return { keyId, key, keyHint: makeKeyHint(key) };
}

/**
 * Re-stamp a managed key after a plan change detected on reconnect: both its
 * meta.plan (gates paid features on api.rendex.dev) AND the per-user identity
 * rate limit. mint sets the identity limit by plan, so an upgrade must move it
 * too — otherwise the caller stays throttled at the OLD plan's per-minute limit
 * until the authoritative Stripe-webhook key sync runs. updateKey REPLACES the
 * whole meta object, so read-merge-write to preserve the other meta fields
 * (product/flagged/source). Best-effort: a transient Unkey failure shouldn't
 * block the connect; the webhook sync is the authoritative correction.
 */
export async function updateManagedKeyPlan(
  rootKey: string,
  keyId: string,
  userId: string,
  plan: string
): Promise<void> {
  const unkey = new Unkey({ rootKey });
  let meta: Record<string, unknown> = {};
  try {
    const { data } = await unkey.keys.getKey({ keyId });
    if (data?.meta) meta = data.meta as Record<string, unknown>;
  } catch {
    // Fall through with the new plan only.
  }
  await unkey.keys.updateKey({ keyId, meta: { ...meta, plan } });

  // Re-pool the per-minute identity rate limit to the new plan (mirrors mint).
  const limit = PLAN_RATE_LIMITS[plan] ?? PLAN_RATE_LIMITS.free;
  const ratelimits = [{ name: "requests", limit, duration: 60_000, autoApply: true }];
  try {
    await unkey.identities.updateIdentity({ identity: userId, ratelimits });
  } catch {
    await unkey.keys.updateKey({ keyId, ratelimits }).catch(() => {});
  }
}

/**
 * Revoke (delete) a managed key. Used to clean up a freshly-minted key we could
 * NOT persist, so it never lingers as an untracked, billable credential.
 */
export async function revokeManagedKey(rootKey: string, keyId: string): Promise<void> {
  const unkey = new Unkey({ rootKey });
  await unkey.keys.deleteKey({ keyId });
}
