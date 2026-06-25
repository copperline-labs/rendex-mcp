// ─── Supabase: login (Auth OTP) + plan + managed-credential store ────
// Targets the SAME Supabase project as the dashboard, so the principal the
// connector authenticates is the same auth.users UUID already mapped to
// public.users / api_keys / user_credits. Email OTP (the dashboard's
// passwordless method) is used for the consent login; the service role reads
// the plan and reads/writes public.mcp_credentials.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./props.js";

function anonClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Send a one-time login code to the email (auto-provisions a new Rendex user). */
export async function sendLoginCode(env: Env, email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await anonClient(env).auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface VerifiedUser {
  userId: string;
  email: string;
}

/** Verify the emailed code → resolved auth user (UUID + email). */
export async function verifyLoginCode(
  env: Env,
  email: string,
  token: string
): Promise<{ user?: VerifiedUser; error?: string }> {
  const { data, error } = await anonClient(env).auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: error.message };
  const user = data.user;
  if (!user) return { error: "Verification failed." };
  return { user: { userId: user.id, email: user.email ?? email } };
}

/** Read the user's plan (mirror of users.plan); "free" only when the row is genuinely absent. */
export async function getUserPlan(env: Env, userId: string): Promise<string> {
  const { data, error } = await serviceClient(env)
    .from("users")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  // Distinguish a real read failure from a legitimately-absent row. A new user's
  // public.users row is trigger-created on signup (003_auth_trigger.sql), so "no
  // row" means free. A transient DB/network error must NOT silently fall open to
  // "free" — that would mint a free-stamped managed key for a PAYING user (and
  // throttle + under-provision them until a later reconnect re-stamps). Throw so
  // resolveManagedCredential surfaces "try again" instead.
  if (error) throw new Error(`getUserPlan read failed: ${error.message}`);
  return (data?.plan as string | undefined) ?? "free";
}

export interface McpCredentialRow {
  unkey_key_id: string;
  encrypted_key: string;
  plan: string | null;
}

/** Look up the user's stored managed MCP credential, or null if none yet. */
export async function getMcpCredential(env: Env, userId: string): Promise<McpCredentialRow | null> {
  const { data, error } = await serviceClient(env)
    .from("mcp_credentials")
    .select("unkey_key_id, encrypted_key, plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as McpCredentialRow;
}

/** Persist (or replace) the user's managed MCP credential. */
export async function saveMcpCredential(
  env: Env,
  userId: string,
  unkeyKeyId: string,
  encryptedKey: string,
  keyHint: string,
  plan: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await serviceClient(env)
    .from("mcp_credentials")
    .upsert(
      {
        user_id: userId,
        unkey_key_id: unkeyKeyId,
        encrypted_key: encryptedKey,
        key_hint: keyHint,
        plan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Update only the stored plan tag on the managed credential row. */
export async function updateMcpCredentialPlan(
  env: Env,
  userId: string,
  plan: string
): Promise<void> {
  await serviceClient(env)
    .from("mcp_credentials")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
