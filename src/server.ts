// ─── Rendex MCP Server Factory ───────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RendexClient } from "./lib/client.js";
import {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  ScreenshotInputSchema,
  handleScreenshot,
} from "./tools/index.js";

const VERSION = "1.0.0";

export function createRendexServer(apiKey: string, baseUrl?: string) {
  const client = new RendexClient(apiKey, baseUrl);

  const server = new McpServer({
    name: "rendex",
    version: VERSION,
  });

  server.registerTool(TOOL_NAME, {
    description: TOOL_DESCRIPTION,
    inputSchema: ScreenshotInputSchema,
  }, async (params) => {
    return handleScreenshot(client, params);
  });

  return server;
}

export { RendexClient } from "./lib/client.js";
export { TOOL_NAME, TOOL_DESCRIPTION, ScreenshotInputSchema } from "./tools/index.js";
