// ─── Rendex MCP Server — Remote HTTP Transport (Cloudflare Workers) ──
// Deployed to mcp.rendex.dev for zero-install remote MCP access

import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRendexServer } from "./server.js";

interface Env {
  RENDEX_API_KEY: string;
  RENDEX_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok", service: "rendex-mcp" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      if (!env.RENDEX_API_KEY) {
        return new Response("Server misconfigured: missing API key", { status: 500 });
      }

      // Stateless: create new server + transport per request
      const server = createRendexServer(env.RENDEX_API_KEY, env.RENDEX_API_URL);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      await server.connect(transport);

      return transport.handleRequest(request);
    }

    // Root: info page
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          name: "Rendex MCP Server",
          description: "Screenshot API for AI agents via Model Context Protocol",
          mcp_endpoint: "/mcp",
          docs: "https://rendex.dev",
          version: "0.1.1",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
