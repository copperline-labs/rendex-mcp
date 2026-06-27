// ─── Shared MCP request runner ───────────────────────────────────────
// Builds a fresh, stateless Rendex MCP server bound to a specific rdx_ key and
// handles one HTTP request. Used by BOTH the OAuth apiHandler (key from the
// validated grant's props) and the default handler's static-bearer fast path
// (key straight from the Authorization header).

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRendexServer } from "../server.js";

export async function runMcp(
  request: Request,
  apiKey: string,
  baseUrl?: string,
  opts: { authChallenge?: string } = {}
): Promise<Response> {
  // Remote transport (OAuth + static-bearer) serves the ChatGPT Apps widget;
  // the stdio entry (stdio.ts) leaves it off. authChallenge (when set) makes
  // every tool return the in-band OAuth login challenge instead of running.
  const server = createRendexServer(apiKey, baseUrl, { widgets: true, authChallenge: opts.authChallenge });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: new server + transport per request
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
