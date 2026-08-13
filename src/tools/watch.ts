// ─── Rendex Watch Tools ──────────────────────────────────────────────
// Website-change monitoring for AI agents: create/list/get/run/test/runs/delete
// watches on the shared Rendex platform (one rdx_ key, one credit pool). Mirrors
// the /v1/watches surface in the OpenAPI single source. Watch metadata + signed
// image URLs are returned as JSON text (images aren't embedded — the URLs are
// short-lived signed links a client can fetch).

import { z } from "zod";
import { RendexClient, RendexApiError } from "../lib/client.js";
import type { CreateWatchParams, UpdateWatchParams, ListWatchesQuery, ListWatchRunsQuery } from "../lib/client.js";
import { asStructured } from "../lib/preview.js";

// Mirror the API's URL forgiveness (screenshot-api schemas/watch-params.ts
// prependHttps): the API normalizes a schemeless host like "rendex.dev/pricing"
// to "https://rendex.dev/pricing" BEFORE .url(), so a bare .url() here would be
// stricter than the API and reject input the API accepts. Runs before .url();
// non-string / already-schemed / bare-token (no dot) inputs pass through
// untouched so .url() still rejects genuine junk.
function prependHttps(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s || /^https?:\/\//i.test(s)) return s;
  if (!s.includes(".")) return s;
  return "https://" + s.replace(/^\/+/, "");
}

// ─── Shared render-knobs schema (a watch's capture config) ──
const RenderParamsSchema = z
  .object({
    format: z.enum(["png", "jpeg", "webp", "pdf"]).optional()
      .describe("Capture format. A pdf cannot be visually diffed — pair it with diffMode 'text'. Default png."),
    width: z.number().int().min(320).max(3840).optional().describe("Viewport width in px (320–3840)."),
    height: z.number().int().min(240).max(2160).optional().describe("Viewport height in px (240–2160)."),
    fullPage: z.boolean().default(true)
      .describe("Monitor the whole scrollable page (default true for watches). Set false to watch only the viewport."),
    device: z.enum(["desktop", "iphone_15", "iphone_se", "pixel_8", "ipad", "ipad_pro"]).optional()
      .describe("Device preset (viewport + scale + UA). E.g. 'iphone_15' to monitor the mobile layout."),
    deviceScaleFactor: z.number().min(1).max(3).optional().describe("Device pixel ratio (1–3)."),
    darkMode: z.boolean().optional().describe("Emulate prefers-color-scheme: dark."),
    blockAds: z.boolean().optional().describe("Block ads/trackers before capture (default true)."),
    blockCookieBanners: z.boolean().optional().describe("Hide common cookie/consent banners before capture."),
    hideSelectors: z.array(z.string()).max(50).optional().describe("CSS selectors to hide before capture (max 50)."),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional()
      .describe("Navigation readiness event."),
    delay: z.number().int().min(0).max(10000).optional().describe("Delay in ms before capture (0–10000)."),
    timeout: z.number().int().min(5).max(60).optional().describe("Page-load timeout in seconds (5–60)."),
    geo: z.string().optional().describe("Pro+ — ISO country code to render from. VISUAL-ONLY: cannot combine with a 'text' OR 'both' diffMode (a geo render returns no extracted text)."),
    geoCity: z.string().optional().describe("City for more precise geo-targeting (requires geo)."),
    geoState: z.string().optional().describe("State/region for geo-targeting (requires geo)."),
    selector: z.string().max(500).optional()
      .describe("Capture and diff ONLY this CSS element — watch one price/banner/section instead of the whole page."),
    ignoreRegions: z
      .array(z.object({ x: z.number().min(0), y: z.number().min(0), width: z.number().positive(), height: z.number().positive() }))
      .max(20).optional()
      .describe("Pixel rectangles masked in both captures before the visual diff — silence dynamic zones (ad slot, clock). Visual mode only."),
    ignoreText: z.array(z.string().max(500)).max(50).optional()
      .describe("Substrings or /regex/flags stripped from both texts before the text diff — silence timestamps, counters, tokens."),
    minTextChars: z.number().int().min(0).max(100_000).optional()
      .describe("Minimum added + removed characters for a text change to count (ignore tiny edits)."),
    suppressWhilePresent: z.array(z.string().max(500)).max(20).optional()
      .describe("While the page text contains any of these markers (e.g. 'Out of stock'), treat the run as unchanged."),
    uaMode: z.enum(["auto", "identify", "stealth"]).optional()
      .describe("User-Agent identity: auto (identify then fall back), identify (always RendexWatch), stealth (always a standard browser). See https://rendex.dev/bot"),
  })
  // Mirror the API's WatchRenderParams.strict(): reject inline-source (url/html/
  // markdown/data) and credential-bearing knobs (cookies/headers/css/js) outright
  // instead of silently stripping them — they have no place in a watch's render
  // config and the API would 400 them anyway.
  .strict()
  .describe("Render knobs applied on every check (a subset of the screenshot capture params).");

// ─── watch_create / watch_test (shared input shape) ──
const CreateWatchFields = {
  url: z.preprocess(prependHttps, z.string().url()).describe("The page to monitor (a schemeless host like 'rendex.dev/pricing' is upgraded to https)."),
  name: z.string().max(120).optional().describe("Optional label for the watch."),
  intervalMinutes: z.number().int().min(5).max(43_200).default(1440)
    .describe("Check frequency in minutes. Minimum is your plan's floor — Free 1440 (daily), Basic 180, Starter 60, Pro 30, Enterprise 5."),
  diffMode: z.enum(["visual", "text", "both"]).default("both")
    .describe("How changes are detected. Default 'both' = a pixel diff (with a highlighted overlay) AND a FULL-PAGE text diff, alerting on either — catches any change, visual or text. 'visual' or 'text' narrow to one signal only."),
  threshold: z.number().min(0).max(1).default(0.01)
    .describe("Visual sensitivity (0..1). Low (default 0.01) alerts on ANY change, including a small one on a long page (a changed-region test, not a whole-page pixel ratio). 0.06+ = only MAJOR visual changes (whole-page ratio). Text detection is unaffected."),
  renderParams: RenderParamsSchema.optional(),
  aiSummary: z.boolean().default(false).describe("Pro+ — attach a one-sentence AI 'what changed' summary to each detected change."),
  webhookUrl: z.preprocess(prependHttps, z.string().url()).optional().describe("Starter+ — HMAC-signed change-webhook target."),
  notifyEmail: z.string().email().optional()
    .describe("Any plan — send change alerts here. Must be your OWN account email (others are rejected). Defaults to it if omitted."),
  paused: z.boolean().default(false).describe("Create the watch paused (no baseline capture or charge until resumed)."),
};

export const WATCH_CREATE_NAME = "watch_create";
export const WATCH_CREATE_DESCRIPTION =
  "Use this when the user asks to monitor, watch, or track a webpage for changes, or to be " +
  "alerted/notified when a page changes. Do NOT use for a one-time capture (use rendex_screenshot). " +
  "Creates a Rendex Watch — monitors a URL on a schedule and notifies when it changes " +
  "(real-Chrome visual diff with a highlighted overlay, an extracted-text diff, or both). " +
  "An active watch captures its baseline immediately. Returns the created watch as JSON.";
// .strict() mirrors the API's CreateWatchSchema.strict(): an unknown top-level
// key is a mistake (typo or smuggled credential/source), surfaced rather than
// silently dropped. (.shape is still exposed for tool registration.)
export const WatchCreateInputSchema = z.object(CreateWatchFields).strict();
export type WatchCreateInput = z.infer<typeof WatchCreateInputSchema>;

export const WATCH_TEST_NAME = "watch_test";
export const WATCH_TEST_DESCRIPTION =
  "Dry-run a watch config BEFORE creating it — render the proposed config once and report what " +
  "was captured + whether the page is reachable (and the text a text-watch would compare). Creates " +
  "no watch, no baseline, no diff. Use this to validate a selector/scope/identity first. Returns JSON.";
export const WatchTestInputSchema = z.object(CreateWatchFields).strict();
export type WatchTestInput = z.infer<typeof WatchTestInputSchema>;

export const WATCH_LIST_NAME = "watch_list";
export const WATCH_LIST_DESCRIPTION =
  "List your watches (newest first), optionally filtered by status and paged. Returns { items, nextCursor }.";
export const WatchListInputSchema = z.object({
  status: z.enum(["active", "paused", "all"]).default("all").describe("Filter by status."),
  cursor: z.string().optional().describe("Pagination cursor from a previous nextCursor."),
  limit: z.number().int().min(1).max(100).default(20).describe("Page size (1–100)."),
});
export type WatchListInput = z.infer<typeof WatchListInputSchema>;

export const WATCH_GET_NAME = "watch_get";
export const WATCH_GET_DESCRIPTION = "Fetch one watch by ID, including its current baseline image URL and status. Returns JSON.";
export const WatchGetInputSchema = z.object({ id: z.string().describe("The watch ID (UUID).") });
export type WatchGetInput = z.infer<typeof WatchGetInputSchema>;

export const WATCH_RUN_NAME = "watch_run";
export const WATCH_RUN_DESCRIPTION =
  "Run an immediate check now (charges 1 credit). Returns the queued run; poll watch_runs for the result " +
  "or receive a watch.changed webhook.";
export const WatchRunInputSchema = z.object({ id: z.string().describe("The watch ID (UUID).") });
export type WatchRunInput = z.infer<typeof WatchRunInputSchema>;

export const WATCH_RUNS_NAME = "watch_runs";
export const WATCH_RUNS_DESCRIPTION =
  "Read a watch's run history (newest first), paged. Each run includes changed, diffScore, and signed " +
  "before/after/overlay image URLs. Returns { items, nextCursor }.";
export const WatchRunsInputSchema = z.object({
  id: z.string().describe("The watch ID (UUID)."),
  cursor: z.string().optional().describe("Pagination cursor from a previous nextCursor."),
  limit: z.number().int().min(1).max(100).default(20).describe("Page size (1–100)."),
});
export type WatchRunsInput = z.infer<typeof WatchRunsInputSchema>;

export const WATCH_DELETE_NAME = "watch_delete";
export const WATCH_DELETE_DESCRIPTION = "Delete a watch and its run history. Irreversible.";
export const WatchDeleteInputSchema = z.object({ id: z.string().describe("The watch ID (UUID).") });
export type WatchDeleteInput = z.infer<typeof WatchDeleteInputSchema>;

export const WATCH_UPDATE_NAME = "watch_update";
export const WATCH_UPDATE_DESCRIPTION =
  "Update a watch in place — pause/resume (paused), re-point (url), change schedule/diff/notify " +
  "settings, or turn a channel off (webhookUrl/notifyEmail = null). Only the fields you send change; " +
  "renderParams is deep-merged over the existing config. A scope change (url/selector/fullPage/size/device) " +
  "re-baselines on the next check. Returns the updated watch as JSON.";
// A partial of the create shape: every field optional, no defaults injected
// (.partial() neutralizes the create defaults), and webhookUrl/notifyEmail accept
// null to clear a channel — mirrors the API's UpdateWatchRequest.
export const WatchUpdateInputSchema = z
  .object({
    id: z.string().describe("The watch ID (UUID) to update."),
    url: z.preprocess(prependHttps, z.string().url()).optional()
      .describe("Re-point to a new URL (clears the baseline; the next check re-baselines)."),
    name: z.string().max(120).nullable().optional().describe("Rename the watch (null to clear)."),
    intervalMinutes: z.number().int().min(5).max(43_200).optional()
      .describe("New check frequency in minutes (subject to your plan's floor)."),
    diffMode: z.enum(["visual", "text", "both"]).optional().describe("Change what counts as a change."),
    threshold: z.number().min(0).max(1).optional().describe("Change the visual-change noise floor (0..1)."),
    renderParams: RenderParamsSchema.partial().optional()
      .describe("Render knobs to deep-merge over the existing capture config."),
    aiSummary: z.boolean().optional().describe("Pro+ — toggle the one-sentence AI 'what changed' summary on each detected change."),
    webhookUrl: z.preprocess(prependHttps, z.string().url()).nullable().optional()
      .describe("Starter+ — set or replace the change-webhook target; null to turn it off."),
    notifyEmail: z.string().email().nullable().optional()
      .describe("Set the alert email (your account email only); null to turn it off."),
    paused: z.boolean().optional().describe("true to pause the watch, false to resume."),
  })
  .strict();
export type WatchUpdateInput = z.infer<typeof WatchUpdateInputSchema>;

// ─── Handlers ──
function jsonText(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown, fallback: string) {
  const message =
    err instanceof RendexApiError ? err.message : err instanceof Error ? err.message : fallback;
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export async function handleWatchCreate(client: RendexClient, params: WatchCreateInput) {
  try {
    const w = await client.watchCreate(params as CreateWatchParams);
    const summary =
      `Created watch ${w.name ? `'${w.name}' ` : ""}on ${w.url}, checking every ${w.intervalMinutes} min ` +
      `(${w.diffMode} diff)${w.status === "active" ? "; baseline capturing now" : "; paused"}. ID ${w.id}.`;
    return { content: [{ type: "text" as const, text: `${summary}\n\n${JSON.stringify(w, null, 2)}` }] };
  } catch (err) {
    return errorResult(err, "Unknown error creating watch");
  }
}

export async function handleWatchTest(client: RendexClient, params: WatchTestInput, preview = false) {
  try {
    const result = await client.watchTest(params as CreateWatchParams);
    if (preview && result.screenshotUrl) {
      return {
        ...jsonText(result),
        structuredContent: asStructured({
          title: `Watch test · ${params.url}`,
          imageUrl: result.screenshotUrl,
          pngUrl: result.screenshotUrl,
          openUrl: result.screenshotUrl,
          note: result.reachable
            ? "Reachable — this is what Rendex would capture each check."
            : "Not reachable" + (result.reason ? ": " + result.reason : "") + ".",
        }),
      };
    }
    return jsonText(result);
  } catch (err) {
    return errorResult(err, "Unknown error testing watch config");
  }
}

export async function handleWatchList(client: RendexClient, params: WatchListInput) {
  try {
    return jsonText(await client.watchList(params as ListWatchesQuery));
  } catch (err) {
    return errorResult(err, "Unknown error listing watches");
  }
}

export async function handleWatchGet(client: RendexClient, params: WatchGetInput, preview = false) {
  try {
    const w = await client.watchGet(params.id);
    if (preview && w.baselineImageUrl) {
      return {
        ...jsonText(w),
        structuredContent: asStructured({
          title: `Watch · ${w.name ?? w.url}`,
          imageUrl: w.baselineImageUrl,
          openUrl: w.baselineImageUrl,
          note: `Status: ${w.status}; baseline captured ${w.baselineCapturedAt ?? "—"}.`,
        }),
      };
    }
    return jsonText(w);
  } catch (err) {
    return errorResult(err, "Unknown error fetching watch");
  }
}

export async function handleWatchRun(client: RendexClient, params: WatchRunInput) {
  try {
    return jsonText(await client.watchRun(params.id));
  } catch (err) {
    return errorResult(err, "Unknown error running watch");
  }
}

export async function handleWatchRuns(client: RendexClient, params: WatchRunsInput, preview = false) {
  try {
    const { id, ...query } = params;
    const result = await client.watchRuns(id, query as ListWatchRunsQuery);
    const latest = result.items[0];
    if (preview && latest) {
      const images = [
        // Lead with the crop-to-change ("what changed") so an agent sees the actual
        // change first, not the top of a tall page.
        { label: "What changed", url: latest.cropUrl },
        { label: "Before", url: latest.beforeUrl },
        { label: "After", url: latest.afterUrl },
        { label: "Overlay (diff)", url: latest.diffOverlayUrl },
      ].filter((i): i is { label: string; url: string } => typeof i.url === "string");
      if (images.length) {
        return {
          ...jsonText(result),
          structuredContent: asStructured({
            title: `Latest run · watch ${id}`,
            images,
            openUrl: latest.cropUrl ?? latest.afterUrl ?? latest.beforeUrl ?? undefined,
            note:
              latest.changed === true
                ? latest.aiSummary ?? "Change detected since the previous check."
                : latest.changed === false
                  ? "No change since the previous check."
                  : `Status: ${latest.status}.`,
          }),
        };
      }
    }
    return jsonText(result);
  } catch (err) {
    return errorResult(err, "Unknown error reading run history");
  }
}

export async function handleWatchDelete(client: RendexClient, params: WatchDeleteInput) {
  try {
    await client.watchDelete(params.id);
    return { content: [{ type: "text" as const, text: `Watch ${params.id} deleted.` }] };
  } catch (err) {
    return errorResult(err, "Unknown error deleting watch");
  }
}

export async function handleWatchUpdate(client: RendexClient, params: WatchUpdateInput) {
  try {
    const { id, ...patch } = params;
    return jsonText(await client.watchUpdate(id, patch as UpdateWatchParams));
  } catch (err) {
    return errorResult(err, "Unknown error updating watch");
  }
}
