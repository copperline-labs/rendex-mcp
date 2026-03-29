#!/usr/bin/env node

// ─── Rendex MCP Server — stdio Transport ─────────────────────────────
// Usage: npx @copperline/rendex-mcp
// Requires: RENDEX_API_KEY environment variable

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRendexServer } from "./server.js";

async function main() {
  const apiKey = process.env.RENDEX_API_KEY;

  if (!apiKey) {
    console.error(
      "Error: RENDEX_API_KEY environment variable is required.\n\n" +
        "Set it in your MCP client config:\n" +
        '  "env": { "RENDEX_API_KEY": "your-api-key" }\n\n' +
        "Get your API key at https://rendex.dev"
    );
    process.exit(1);
  }

  const baseUrl = process.env.RENDEX_API_URL;
  const server = createRendexServer(apiKey, baseUrl);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Rendex MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Smithery sandbox — allows registry to scan tools without real credentials
export function createSandboxServer() {
  return createRendexServer("sandbox-key");
}
