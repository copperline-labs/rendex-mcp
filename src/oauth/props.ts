// ─── OAuth Worker types ──────────────────────────────────────────────
// Shared Env + Props for the OAuth-fronted remote MCP. Props are the per-grant
// payload the OAuthProvider encrypts into the access token and re-injects as
// ctx.props on every validated /mcp request — this is how a caller's own
// Rendex credential reaches the MCP server without ever touching the client.

import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

/** Per-grant identity + credential, encrypted into the access token by the provider. */
export interface Props {
  userId: string;
  email: string;
  plan: string;
  // The user's managed Rendex (rdx_) key. Bound to their Unkey identity, so it
  // bills against their per-user credit pool and inherits their plan — exactly
  // like a dashboard key, but minted + stored for MCP use only.
  rendexApiKey: string;
  [key: string]: unknown;
}

export interface Env {
  // Provider-managed token/grant/client store (binding name is the convention).
  OAUTH_KV: KVNamespace;
  // Injected by OAuthProvider — the callback API (parseAuthRequest, lookupClient,
  // completeAuthorization, …) available to the default handler.
  OAUTH_PROVIDER: OAuthHelpers;

  // Legacy/fallback shared key (kept for the static-bearer power-user path).
  RENDEX_API_KEY?: string;
  RENDEX_API_URL?: string;

  // Supabase (same project as the dashboard) — Auth for login + service-role
  // REST for the managed-credential table + plan lookup.
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;

  // Unkey — mint the managed per-user MCP key.
  UNKEY_ROOT_KEY: string;
  UNKEY_API_ID: string;

  // base64-encoded 32-byte AES-256-GCM key for encrypting the managed rdx_ key
  // at rest in public.mcp_credentials (Unkey can't return the plaintext later).
  MCP_KEY_ENCRYPTION_KEY: string;
}
