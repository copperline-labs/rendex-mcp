// ─── Resolve a usable rdx_ credential for an authenticated user ──────
// The keystone: turn a logged-in user (post-OAuth-consent) into a usable
// Rendex API key for per-caller MCP billing. Existing dashboard keys are
// unrecoverable (Unkey hashes them; our DB stores only a hint), so we manage a
// dedicated per-user "MCP Connector" key: minted once via Unkey, stored
// encrypted in public.mcp_credentials, reused on every subsequent connect.
//
// Because billing is pooled per user_id (Unkey identity externalId), this
// managed key bills against the same credit pool + plan as the user's
// dashboard — it just lives in a separate table so it never eats a free-tier
// dashboard key slot (MAX_ACTIVE_KEYS.free = 1).

import type { Env } from "./props.js";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { getMcpCredential, getUserPlan, saveMcpCredential, updateMcpCredentialPlan } from "./supabase.js";
import { mintManagedKey, updateManagedKeyPlan } from "./unkey.js";

export interface ResolvedCredential {
  apiKey: string;
  plan: string;
}

export async function resolveManagedCredential(
  env: Env,
  userId: string
): Promise<ResolvedCredential> {
  const plan = await getUserPlan(env, userId);

  // Reuse the existing managed key if we have one.
  const existing = await getMcpCredential(env, userId);
  if (existing) {
    try {
      const apiKey = await decryptSecret(existing.encrypted_key, env.MCP_KEY_ENCRYPTION_KEY);
      // Reconnect backstop for plan drift: the key's meta.plan was stamped at
      // mint time and gates paid features on api.rendex.dev. If the user's plan
      // has since changed, re-stamp it now. (The authoritative fix is in the
      // Stripe-webhook key sync — see syncUnkeyKeysForUser — which corrects the
      // key even without a reconnect; this only narrows the window.)
      if (existing.plan !== plan) {
        await updateManagedKeyPlan(env.UNKEY_ROOT_KEY, existing.unkey_key_id, plan).catch(() => {});
        await updateMcpCredentialPlan(env, userId, plan).catch(() => {});
      }
      return { apiKey, plan };
    } catch {
      // Decryption failed (rotated key / corrupt row) — fall through to mint a
      // fresh credential and overwrite the row.
    }
  }

  // Mint a new managed key, encrypt it, and persist.
  const minted = await mintManagedKey(env.UNKEY_ROOT_KEY, env.UNKEY_API_ID, userId, plan);
  const encrypted = await encryptSecret(minted.key, env.MCP_KEY_ENCRYPTION_KEY);
  const saved = await saveMcpCredential(env, userId, minted.keyId, encrypted, minted.keyHint, plan);
  if (!saved.ok) {
    // The key works regardless of the DB write — return it so this session
    // proceeds; a later connect re-mints if the row is still missing.
    console.log(
      JSON.stringify({
        level: "warn",
        event: "mcp_credential_persist_failed",
        userId,
        error: saved.error,
        timestamp: new Date().toISOString(),
      })
    );
  }
  return { apiKey: minted.key, plan };
}
