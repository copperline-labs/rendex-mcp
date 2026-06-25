// ─── OAuth defaultHandler — consent UI + non-API routes ──────────────
// Handles every request the OAuthProvider does NOT route to the apiHandler:
// the /authorize consent flow, the static-bearer /mcp fast path, the
// protected-resource discovery doc, and /health + /.
//
// Security (per the Cloudflare workers-oauth-provider guidance):
//  - login state lives in OAUTH_KV (10-min TTL), keyed by a __Host- cookie;
//  - a CSRF token is bound to that state and checked constant-time on POST;
//  - all dynamic output is HTML-escaped and served under a strict CSP with
//    no scripts and form-action 'self'.

import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import type { Env, Props } from "./props.js";
import { randomToken, timingSafeEqual } from "./crypto.js";
import { renderEmailForm, renderCodeForm, renderErrorPage } from "./pages.js";
import { sendLoginCode, verifyLoginCode } from "./supabase.js";
import { resolveManagedCredential } from "./credential.js";
import { runMcp } from "./mcp-runtime.js";

const LOGIN_TTL_SECONDS = 600;
const STATE_COOKIE = "__Host-rx_login";
// The consent form posts to /authorize, and the server then 302-redirects to
// the OAuth client's redirect_uri. CSP form-action governs that ENTIRE chain
// (including the redirect), so the client's origin must be allowed or the
// browser silently blocks the post-login redirect and the flow dies. Widen
// form-action to 'self' + the specific client redirect origin.
function consentCsp(formActionOrigin?: string, nonce?: string): string {
  const formAction = formActionOrigin ? `'self' ${formActionOrigin}` : "'self'";
  // Only the per-request nonce'd loading script may run — no 'unsafe-inline'.
  const scriptSrc = nonce ? ` script-src 'nonce-${nonce}';` : "";
  return `default-src 'none'; style-src 'unsafe-inline';${scriptSrc} img-src https: data:; form-action ${formAction}; base-uri 'none'; frame-ancestors 'none'`;
}

// Abuse controls mirroring the dashboard's send-otp gate (app-layer, on top of
// Supabase's global email cap). Soft caps via OAUTH_KV counters — the Supabase
// rate limit is the hard backstop.
const OTP_SENDS_PER_IP_PER_HOUR = 5;
const OTP_IP_WINDOW_SECONDS = 3600;
const OTP_EMAIL_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_LOGIN = 3; // one GET/cookie can't fan out to many addresses
const MAX_CODE_ATTEMPTS = 5;

// Redirect origins we consider first-party/verified for the consent badge.
const TRUSTED_REDIRECT_ORIGINS = [
  "https://claude.ai",
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://openai.com",
  "https://cursor.com",
];

interface LoginState {
  csrf: string;
  oauthReq: AuthRequest;
  clientName?: string;
  email?: string;
  sendCount?: number;
  codeAttempts?: number;
}

/** Client IP for throttling — collapse IPv6 to /64 (project rate-limit convention). */
function clientIp(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + "::/64";
  return ip;
}

/** Best-effort KV counter (read-modify-write; soft cap, races tolerated). */
async function bumpCounter(env: Env, key: string, ttl: number): Promise<number> {
  const cur = parseInt((await env.OAUTH_KV.get(key)) ?? "0", 10) || 0;
  const next = cur + 1;
  await env.OAUTH_KV.put(key, String(next), { expirationTtl: ttl });
  return next;
}

function redirectOrigin(oauthReq: AuthRequest): string | undefined {
  try {
    return new URL(oauthReq.redirectUri).origin;
  } catch {
    return undefined;
  }
}

function htmlResponse(
  body: string,
  extraHeaders: Record<string, string> = {},
  formActionOrigin?: string,
  nonce?: string
): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": consentCsp(formActionOrigin, nonce),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      ...extraHeaders,
    },
  });
}

function setStateCookie(stateId: string): string {
  // __Host- requires Secure + Path=/ + no Domain. SameSite=Lax lets the
  // top-level redirect from the client survive while blocking cross-site POSTs.
  return `${STATE_COOKIE}=${stateId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${LOGIN_TTL_SECONDS}`;
}
function clearStateCookie(): string {
  return `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
function readStateCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

async function loadState(env: Env, stateId: string | null): Promise<LoginState | null> {
  if (!stateId) return null;
  const raw = await env.OAUTH_KV.get(`rxlogin:${stateId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LoginState;
  } catch {
    return null;
  }
}
function saveState(env: Env, stateId: string, state: LoginState): Promise<void> {
  return env.OAUTH_KV.put(`rxlogin:${stateId}`, JSON.stringify(state), {
    expirationTtl: LOGIN_TTL_SECONDS,
  });
}

// ─── GET /authorize — render consent + email form ────────────────────
async function handleAuthorizeGet(request: Request, env: Env): Promise<Response> {
  let oauthReq: AuthRequest;
  try {
    oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch {
    return htmlResponse(renderErrorPage("Invalid authorization request."));
  }
  const clientInfo = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId).catch(() => null);

  const stateId = randomToken();
  const csrf = randomToken();

  // Anti-phishing: show where the client redirects + whether it's first-party,
  // since the DCR client_name is attacker-controllable.
  const origin = redirectOrigin(oauthReq);
  const verified = !!origin && TRUSTED_REDIRECT_ORIGINS.includes(origin);

  await saveState(env, stateId, { csrf, oauthReq, clientName: clientInfo?.clientName ?? undefined });

  const nonce = randomToken(16);
  return htmlResponse(
    renderEmailForm({ clientName: clientInfo?.clientName, redirectOrigin: origin, verified, csrf, nonce }),
    { "Set-Cookie": setStateCookie(stateId) },
    origin,
    nonce
  );
}

// ─── POST /authorize — email step → code step → completeAuthorization ─
async function handleAuthorizePost(request: Request, env: Env): Promise<Response> {
  const stateId = readStateCookie(request);
  const state = await loadState(env, stateId);
  if (!state || !stateId) {
    return htmlResponse(renderErrorPage("Your sign-in session expired. Start again from your client."));
  }

  const form = await request.formData();
  const csrf = String(form.get("csrf") ?? "");
  if (!timingSafeEqual(csrf, state.csrf)) {
    return htmlResponse(renderErrorPage("Security check failed. Start again from your client."));
  }

  const step = String(form.get("step") ?? "");

  // Re-render the email form with the same consent context recovered from state.
  const origin = redirectOrigin(state.oauthReq);
  const trusted = !!origin && TRUSTED_REDIRECT_ORIGINS.includes(origin);
  const emailForm = (error?: string) => {
    const nonce = randomToken(16);
    return htmlResponse(
      renderEmailForm({ clientName: state.clientName, redirectOrigin: origin, verified: trusted, csrf: state.csrf, error, nonce }),
      {},
      origin,
      nonce
    );
  };
  const codeForm = (error?: string) => {
    const nonce = randomToken(16);
    return htmlResponse(renderCodeForm({ email: state.email ?? "", csrf: state.csrf, error, nonce }), {}, origin, nonce);
  };

  if (step === "email") {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return emailForm("Enter a valid email address.");

    // A single login session (one cookie/CSRF) can't fan out to many addresses.
    if ((state.sendCount ?? 0) >= MAX_SENDS_PER_LOGIN) {
      return htmlResponse(renderErrorPage("Too many code requests. Start again from your client."));
    }
    // Per-IP hourly cap (soft; Supabase's global email cap is the hard backstop).
    const ip = clientIp(request);
    if ((await bumpCounter(env, `rxotp:ip:${ip}`, OTP_IP_WINDOW_SECONDS)) > OTP_SENDS_PER_IP_PER_HOUR) {
      return emailForm("Too many code requests from your network. Try again later.");
    }
    // Per-email cooldown.
    const cooldownKey = `rxotp:em:${email}`;
    if (await env.OAUTH_KV.get(cooldownKey)) {
      return emailForm("Please wait a minute before requesting another code.");
    }
    await env.OAUTH_KV.put(cooldownKey, "1", { expirationTtl: OTP_EMAIL_COOLDOWN_SECONDS });

    const sent = await sendLoginCode(env, email);
    if (!sent.ok) return emailForm(sent.error ?? "Could not send a code. Try again.");

    await saveState(env, stateId, { ...state, email, sendCount: (state.sendCount ?? 0) + 1 });
    return codeForm();
  }

  if (step === "code") {
    const email = state.email;
    const code = String(form.get("code") ?? "").trim();
    if (!email) {
      return htmlResponse(renderErrorPage("Your sign-in session expired. Start again from your client."));
    }

    // Cap incorrect-code attempts, then burn the login state (defense-in-depth
    // on top of Supabase's per-code verify limit).
    const attempts = state.codeAttempts ?? 0;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await env.OAUTH_KV.delete(`rxlogin:${stateId}`);
      return htmlResponse(renderErrorPage("Too many incorrect codes. Start again from your client."), {
        "Set-Cookie": clearStateCookie(),
      });
    }
    if (!code) {
      return codeForm("Enter the code from your email.");
    }

    const verified = await verifyLoginCode(env, email, code);
    if (verified.error || !verified.user) {
      await saveState(env, stateId, { ...state, codeAttempts: attempts + 1 });
      return codeForm(verified.error ?? "That code didn't work. Try again.");
    }

    // Resolve (mint or reuse) the user's managed rdx_ credential, then complete
    // the grant — props carry it, encrypted, to every future /mcp call.
    let props: Props;
    try {
      const cred = await resolveManagedCredential(env, verified.user.userId);
      props = {
        userId: verified.user.userId,
        email: verified.user.email,
        plan: cred.plan,
        rendexApiKey: cred.apiKey,
      };
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "resolve_credential_failed",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        })
      );
      return htmlResponse(renderErrorPage("Could not provision your Rendex credential. Please try again."));
    }

    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: state.oauthReq,
      userId: verified.user.userId,
      metadata: { label: verified.user.email },
      scope: state.oauthReq.scope ?? [],
      props,
    });

    await env.OAUTH_KV.delete(`rxlogin:${stateId}`);
    return new Response(null, {
      status: 302,
      headers: { Location: redirectTo, "Set-Cookie": clearStateCookie() },
    });
  }

  return htmlResponse(renderErrorPage("Unexpected request."));
}

// ─── default handler entry ───────────────────────────────────────────
export const defaultHandler = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === "/health" && (method === "GET" || method === "HEAD")) {
      return new Response(JSON.stringify({ status: "ok", service: "rendex-mcp" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/" && (method === "GET" || method === "HEAD")) {
      return new Response(
        JSON.stringify({
          name: "Rendex MCP Server",
          description:
            "Capture screenshots, generate PDFs, render branded artifacts, and monitor pages via AI agents — Model Context Protocol server for Rendex",
          mcp_endpoint: "/mcp",
          authorization: "OAuth 2.1 (auth-code + PKCE) or a static Authorization: Bearer rdx_ key",
          docs: "https://rendex.dev",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // RFC 9728 protected-resource metadata (MCP 2025-06-18 discovery). Served
    // here as a fallback in case the provider version doesn't emit it.
    if (path === "/.well-known/oauth-protected-resource") {
      return new Response(
        JSON.stringify({
          resource: `${url.origin}/mcp`,
          authorization_servers: [url.origin],
        }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (path === "/authorize") {
      if (method === "GET") return handleAuthorizeGet(request, env);
      if (method === "POST") return handleAuthorizePost(request, env);
      return new Response("Method Not Allowed", { status: 405 });
    }

    // /mcp requests reach the default handler ONLY when they lack a valid OAuth
    // access token (the provider routes valid-token requests to the apiHandler).
    if (path === "/mcp") {
      const accept = request.headers.get("accept") ?? "";
      // Browser visit → docs.
      if (method === "GET" && !accept.includes("text/event-stream")) {
        return new Response(null, { status: 302, headers: { Location: "https://rendex.dev/docs" } });
      }
      // Static-bearer fast path: a client presenting its own rdx_ key directly
      // (no OAuth) keeps working — per-caller billing via that key.
      const auth = request.headers.get("authorization") ?? "";
      if (/^Bearer\s+rdx_/.test(auth)) {
        return runMcp(request, auth.replace(/^Bearer\s+/, ""), env.RENDEX_API_URL);
      }
      // Otherwise: 401 + discovery pointer so OAuth clients start the flow.
      return new Response(
        JSON.stringify({ error: "invalid_token", error_description: "Authentication required." }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`,
          },
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
