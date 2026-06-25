// ─── Rendex MCP Server Factory ───────────────────────────────────────

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RendexClient } from "./lib/client.js";
import { ARTIFACT_WIDGET_HTML, WIDGET_URI, WIDGET_MIME } from "./widget.js";
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
  ARTIFACT_NAME,
  ARTIFACT_DESCRIPTION,
  ArtifactInputSchema,
  handleArtifact,
  ACCOUNT_NAME,
  ACCOUNT_DESCRIPTION,
  AccountInputSchema,
  handleAccount,
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

export function createRendexServer(
  apiKey: string,
  baseUrl?: string,
  opts: { widgets?: boolean } = {}
) {
  const client = new RendexClient(apiKey, baseUrl);

  const server = new McpServer({
    name: "rendex",
    version: VERSION,
  });

  // ─── Tool annotations (MCP spec hints for agent clients) ──────────────
  // readOnlyHint    — does NOT mutate the caller's own resources (a render
  //                   reads a page; a watch_create writes a watch).
  // destructiveHint — irreversible data loss (only watch_delete).
  // idempotentHint  — repeating with the same args has no additional effect.
  // openWorldHint   — touches arbitrary external URLs (the open web) vs only
  //                   the caller's own Rendex resources.
  // Defaults in the spec are the cautious ones (readOnly=false, destructive=
  // true, openWorld=true), so every tool sets all four explicitly.

  server.registerTool(TOOL_NAME, {
    title: "Capture Screenshot or PDF",
    description: TOOL_DESCRIPTION,
    inputSchema: ScreenshotInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    return handleScreenshot(client, params);
  });

  server.registerTool(EXTRACT_TOOL_NAME, {
    title: "Extract Reader-Mode Content",
    description: EXTRACT_TOOL_DESCRIPTION,
    inputSchema: ExtractInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    return handleExtract(client, params);
  });

  server.registerTool(RENDER_LINK_NAME, {
    title: "Mint Hosted Render URL",
    description: RENDER_LINK_DESCRIPTION,
    inputSchema: RenderLinkInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    return handleRenderLink(client, params);
  });

  // render_artifact: Markdown/HTML → branded PDF + PNG + hosted share page.
  // Read-only w.r.t. the caller's resources (mints hosted output, mutates
  // nothing); does not touch arbitrary external URLs (inline content only).
  server.registerTool(ARTIFACT_NAME, {
    title: "Render Branded Artifact (PDF + PNG)",
    description: ARTIFACT_DESCRIPTION,
    inputSchema: ArtifactInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    // ChatGPT Apps inline preview: point the tool at the widget resource below.
    // Other clients ignore this _meta key. Only set on remote transports.
    ...(opts.widgets ? { _meta: { "openai/outputTemplate": WIDGET_URI } } : {}),
  }, async (params) => {
    return handleArtifact(client, params);
  });

  // rendex_account: read-only plan + usage + one-tap upgrade link. Touches only
  // the caller's own Rendex account (no external URLs); costs no credits.
  server.registerTool(ACCOUNT_NAME, {
    title: "Check Plan & Usage",
    description: ACCOUNT_DESCRIPTION,
    inputSchema: AccountInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    return handleAccount(client);
  });

  // ─── Rendex Watch ──
  server.registerTool(WATCH_CREATE_NAME, {
    title: "Create Watch",
    description: WATCH_CREATE_DESCRIPTION,
    inputSchema: WatchCreateInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => handleWatchCreate(client, params));

  server.registerTool(WATCH_TEST_NAME, {
    title: "Test Watch Config (dry-run)",
    description: WATCH_TEST_DESCRIPTION,
    inputSchema: WatchTestInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => handleWatchTest(client, params));

  server.registerTool(WATCH_LIST_NAME, {
    title: "List Watches",
    description: WATCH_LIST_DESCRIPTION,
    inputSchema: WatchListInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => handleWatchList(client, params));

  server.registerTool(WATCH_GET_NAME, {
    title: "Get Watch",
    description: WATCH_GET_DESCRIPTION,
    inputSchema: WatchGetInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => handleWatchGet(client, params));

  server.registerTool(WATCH_RUN_NAME, {
    title: "Run Watch Now",
    description: WATCH_RUN_DESCRIPTION,
    inputSchema: WatchRunInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => handleWatchRun(client, params));

  server.registerTool(WATCH_RUNS_NAME, {
    title: "List Watch Runs",
    description: WATCH_RUNS_DESCRIPTION,
    inputSchema: WatchRunsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => handleWatchRuns(client, params));

  server.registerTool(WATCH_DELETE_NAME, {
    title: "Delete Watch",
    description: WATCH_DELETE_DESCRIPTION,
    inputSchema: WatchDeleteInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async (params) => handleWatchDelete(client, params));

  server.registerTool(WATCH_UPDATE_NAME, {
    title: "Update Watch",
    description: WATCH_UPDATE_DESCRIPTION,
    inputSchema: WatchUpdateInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (params) => handleWatchUpdate(client, params));

  // ─── ChatGPT Apps preview widget (remote transports only) ──────────
  // Served as a UI resource; render_artifact's _meta.openai/outputTemplate
  // (above) points here so ChatGPT renders the rendered PNG/PDF inline with
  // download + open-share links. Gated behind opts.widgets so the stdio/npm
  // surface and non-ChatGPT clients stay clean.
  if (opts.widgets) {
    // ChatGPT Apps requires a widget template to declare its sandbox domain + a
    // CSP, or submission fails ("Widget CSP/domain not set"). This preview only
    // loads the rendered PNG and links to the PDF/PNG/share page — all hosted on
    // api.rendex.dev. We set both the standard `ui` form and the legacy openai/*
    // keys (and the legacy redirect_domains for the open/download links).
    const widgetMeta = {
      "openai/widgetDomain": "https://rendex.dev",
      "openai/widgetDescription":
        "Preview of a rendered Rendex artifact — a PNG preview with Download PDF/PNG and Open share-page links.",
      "openai/widgetCSP": {
        connect_domains: ["https://api.rendex.dev"],
        resource_domains: ["https://api.rendex.dev"],
        redirect_domains: ["https://api.rendex.dev"],
      },
      ui: {
        domain: "https://rendex.dev",
        csp: {
          connectDomains: ["https://api.rendex.dev"],
          resourceDomains: ["https://api.rendex.dev"],
        },
      },
    };
    server.registerResource(
      "artifact-preview",
      WIDGET_URI,
      { title: "Rendex artifact preview", mimeType: WIDGET_MIME, _meta: widgetMeta },
      async () => ({
        contents: [
          { uri: WIDGET_URI, mimeType: WIDGET_MIME, text: ARTIFACT_WIDGET_HTML, _meta: widgetMeta },
        ],
        _meta: widgetMeta,
      })
    );
  }

  return server;
}

export { RendexClient } from "./lib/client.js";
export { TOOL_NAME, TOOL_DESCRIPTION, ScreenshotInputSchema } from "./tools/index.js";
export { EXTRACT_TOOL_NAME, EXTRACT_TOOL_DESCRIPTION, ExtractInputSchema } from "./tools/index.js";
