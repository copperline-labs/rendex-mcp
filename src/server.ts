// ─── Rendex MCP Server Factory ───────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RendexClient } from "./lib/client.js";
import {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  ScreenshotInputSchema,
  handleScreenshot,
  RENDER_LINK_NAME,
  RENDER_LINK_DESCRIPTION,
  RenderLinkInputSchema,
  handleRenderLink,
  EXTRACT_TOOL_NAME,
  EXTRACT_TOOL_DESCRIPTION,
  ExtractInputSchema,
  handleExtract,
  WATCH_CREATE_NAME,
  WATCH_CREATE_DESCRIPTION,
  WatchCreateInputSchema,
  handleWatchCreate,
  WATCH_TEST_NAME,
  WATCH_TEST_DESCRIPTION,
  WatchTestInputSchema,
  handleWatchTest,
  WATCH_LIST_NAME,
  WATCH_LIST_DESCRIPTION,
  WatchListInputSchema,
  handleWatchList,
  WATCH_GET_NAME,
  WATCH_GET_DESCRIPTION,
  WatchGetInputSchema,
  handleWatchGet,
  WATCH_RUN_NAME,
  WATCH_RUN_DESCRIPTION,
  WatchRunInputSchema,
  handleWatchRun,
  WATCH_RUNS_NAME,
  WATCH_RUNS_DESCRIPTION,
  WatchRunsInputSchema,
  handleWatchRuns,
  WATCH_DELETE_NAME,
  WATCH_DELETE_DESCRIPTION,
  WatchDeleteInputSchema,
  handleWatchDelete,
  WATCH_UPDATE_NAME,
  WATCH_UPDATE_DESCRIPTION,
  WatchUpdateInputSchema,
  handleWatchUpdate,
} from "./tools/index.js";

const VERSION = "1.5.1";

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

  server.registerTool(RENDER_LINK_NAME, {
    description: RENDER_LINK_DESCRIPTION,
    inputSchema: RenderLinkInputSchema.shape,
  }, async (params) => {
    return handleRenderLink(client, params);
  });

  // ─── Rendex Watch ──
  server.registerTool(WATCH_CREATE_NAME, {
    description: WATCH_CREATE_DESCRIPTION,
    inputSchema: WatchCreateInputSchema.shape,
  }, async (params) => handleWatchCreate(client, params));

  server.registerTool(WATCH_TEST_NAME, {
    description: WATCH_TEST_DESCRIPTION,
    inputSchema: WatchTestInputSchema.shape,
  }, async (params) => handleWatchTest(client, params));

  server.registerTool(WATCH_LIST_NAME, {
    description: WATCH_LIST_DESCRIPTION,
    inputSchema: WatchListInputSchema.shape,
  }, async (params) => handleWatchList(client, params));

  server.registerTool(WATCH_GET_NAME, {
    description: WATCH_GET_DESCRIPTION,
    inputSchema: WatchGetInputSchema.shape,
  }, async (params) => handleWatchGet(client, params));

  server.registerTool(WATCH_RUN_NAME, {
    description: WATCH_RUN_DESCRIPTION,
    inputSchema: WatchRunInputSchema.shape,
  }, async (params) => handleWatchRun(client, params));

  server.registerTool(WATCH_RUNS_NAME, {
    description: WATCH_RUNS_DESCRIPTION,
    inputSchema: WatchRunsInputSchema.shape,
  }, async (params) => handleWatchRuns(client, params));

  server.registerTool(WATCH_DELETE_NAME, {
    description: WATCH_DELETE_DESCRIPTION,
    inputSchema: WatchDeleteInputSchema.shape,
  }, async (params) => handleWatchDelete(client, params));

  server.registerTool(WATCH_UPDATE_NAME, {
    description: WATCH_UPDATE_DESCRIPTION,
    inputSchema: WatchUpdateInputSchema.shape,
  }, async (params) => handleWatchUpdate(client, params));

  return server;
}

export { RendexClient } from "./lib/client.js";
export { TOOL_NAME, TOOL_DESCRIPTION, ScreenshotInputSchema } from "./tools/index.js";
export { EXTRACT_TOOL_NAME, EXTRACT_TOOL_DESCRIPTION, ExtractInputSchema } from "./tools/index.js";
