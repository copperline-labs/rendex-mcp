// ─── Rendex MCP Server — Remote HTTP Transport (Cloudflare Workers) ──
// Deployed to mcp.rendex.dev. Fronted by OAuth 2.1 (auth-code + PKCE S256) so
// each caller authenticates as their own Rendex user and bills against their
// own credit pool — the keystone that unlocks ChatGPT Apps + the Claude
// Connectors directory + authed registry listings.
//
// The OAuthProvider owns the router:
//   • /mcp with a valid access token  → mcpApiHandler (per-caller props.rendexApiKey)
//   • /authorize, /token, /register, /.well-known/*, everything else
//     (incl. /mcp with a static rdx_ bearer or no token) → defaultHandler
//
// Token/grant/client storage is the provider's, encrypted, in OAUTH_KV.

import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { mcpApiHandler } from "./mcp-handler.js";
import { defaultHandler } from "./oauth/default-handler.js";
import { runMcp } from "./oauth/mcp-runtime.js";
import type { Env } from "./oauth/props.js";

// Channel version marker — kept in lockstep with server.ts / server.json /
// package.json by scripts/bump-version.sh (and enforced by the preflight
// version-consistency gate, which requires this literal in remote.ts).
export const VERSION = "1.5.1";

const provider = new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: mcpApiHandler,
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["rendex"],
  // OAuth 2.1: only S256 PKCE (no plain), no implicit flow.
  allowImplicitFlow: false,
  allowPlainPKCE: false,
});

// The OAuthProvider validates the bearer token on /mcp and rejects anything that
// isn't a provider-issued OAuth access token with 401 — so it would break the
// existing static-key path (clients passing their own `Authorization: Bearer
// rdx_…`). Wrap the provider to intercept the static-key fast path (and the
// browser visit) BEFORE the provider sees them; everything else (the OAuth
// flows + validated OAuth tokens) delegates to the provider.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // OpenAI Apps domain verification — serve the challenge token at the well-known
    // path so ChatGPT can confirm we control mcp.rendex.dev. This is a public
    // verification value (not a secret), safe to serve as-is.
    if (url.pathname === "/.well-known/openai-apps-challenge") {
      return new Response("lELVsFB2HRpum3rs0NwknefCBpHmLnLJZbaWmb-fu_Q", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname === "/mcp") {
      const accept = request.headers.get("accept") ?? "";
      if (request.method === "GET") {
        // Browser visit (no SSE accept) → docs.
        if (!accept.includes("text/event-stream")) {
          return Response.redirect("https://rendex.dev/docs", 302);
        }
        // This server is STATELESS (no session id), so there is no
        // server-initiated SSE stream. Per the Streamable HTTP spec, return 405
        // so clients use POST request/response only. Without this, the stateless
        // transport's GET handler hangs and the Workers runtime cancels the
        // request — which is why real clients (Claude/ChatGPT) never connect
        // even though POST works.
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST, DELETE" },
        });
      }
      // Static-key fast path: a client presenting its OWN rdx_ key (not an OAuth
      // token) keeps working, billed to that key. OAuth access tokens don't start
      // with rdx_, so they fall through to the provider untouched.
      const auth = request.headers.get("authorization") ?? "";
      if (/^Bearer\s+rdx_/.test(auth)) {
        return runMcp(request, auth.replace(/^Bearer\s+/, ""), env.RENDEX_API_URL);
      }
    }
    return provider.fetch(request, env, ctx);
  },
};
