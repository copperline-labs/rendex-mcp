// ─── OAuth apiHandler — validated /mcp requests ──────────────────────
// Reached ONLY after the OAuthProvider has validated the bearer access token
// and decrypted the grant's props into ctx.props. The per-caller managed rdx_
// key rides in props.rendexApiKey, so every screenshot/extract/artifact/watch
// call bills against that user's own credit pool + plan.

import type { Env, Props } from "./oauth/props.js";
import { runMcp } from "./oauth/mcp-runtime.js";

export const mcpApiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // The provider injects the decrypted grant props onto ctx after validating
    // the bearer token; it's typed `unknown` upstream, so narrow it here.
    const props = (ctx as ExecutionContext & { props?: Props }).props;
    if (!props?.rendexApiKey) {
      return new Response(
        JSON.stringify({ error: "invalid_token", error_description: "No Rendex credential on this grant." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    return runMcp(request, props.rendexApiKey, env.RENDEX_API_URL);
  },
};
