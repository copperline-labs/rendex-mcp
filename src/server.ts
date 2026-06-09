// ─── Rendex MCP Server Factory ───────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RendexClient } from "./lib/client.js";
import {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  ScreenshotInputSchema,
  handleScreenshot,
  EXTRACT_TOOL_NAME,
  EXTRACT_TOOL_DESCRIPTION,
  ExtractInputSchema,
  handleExtract,
} from "./tools/index.js";

const VERSION = "1.4.1";

export function createRendexServer(apiKey: string, baseUrl?: string) {
  const client = new RendexClient(apiKey, baseUrl);

  const server = new McpServer({
    name: "rendex",
    version: VERSION,
  });

  server.registerTool(TOOL_NAME, {
    description: TOOL_DESCRIPTION,
    inputSchema: ScreenshotInputSchema.shape,
  }, async (params) => {
    return handleScreenshot(client, params);
  });

  server.registerTool(EXTRACT_TOOL_NAME, {
    description: EXTRACT_TOOL_DESCRIPTION,
    inputSchema: ExtractInputSchema.shape,
  }, async (params) => {
    return handleExtract(client, params);
  });

  return server;
}

export { RendexClient } from "./lib/client.js";
export { TOOL_NAME, TOOL_DESCRIPTION, ScreenshotInputSchema } from "./tools/index.js";
export { EXTRACT_TOOL_NAME, EXTRACT_TOOL_DESCRIPTION, ExtractInputSchema } from "./tools/index.js";
