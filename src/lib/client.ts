// ─── HTTP Client for Rendex REST API ─────────────────────────────────

import { formatApiError, nonJsonError } from "./errors.js";
import type { RendexRestError } from "./errors.js";

const API_BASE = "https://api.rendex.dev";

// Identifies remote (mcp.rendex.dev Worker) and stdio MCP traffic in API
// analytics so agent usage is attributable instead of landing in "Unknown"
// (CF Worker fetch sends no UA) or "Code (node)". Kept in sync by
// scripts/bump-version.sh (mirrors VERSION in src/server.ts).
const VERSION = "1.8.0";
const USER_AGENT = `rendex-mcp/${VERSION}`;

export interface ScreenshotParams {
  url?: string;
  html?: string;
  markdown?: string;
  format?: "png" | "jpeg" | "webp" | "pdf";
  width?: number;
  height?: number;
  fullPage?: boolean;
  quality?: number;
  delay?: number;
  darkMode?: boolean;
  deviceScaleFactor?: number;
  device?: "desktop" | "iphone_15" | "iphone_se" | "pixel_8" | "ipad" | "ipad_pro";
  blockAds?: boolean;
  blockResourceTypes?: ("font" | "image" | "media" | "stylesheet" | "other")[];
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  waitForSelector?: string;
  bestAttempt?: boolean;
  selector?: string;
  hideSelectors?: string[];
  blockCookieBanners?: boolean;
  resizeWidth?: number;
  resizeHeight?: number;
  css?: string;
  js?: string;
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    expires?: number;
  }>;
  headers?: Record<string, string>;
  userAgent?: string;
  pdfFormat?: "A4" | "Letter" | "Legal" | "Tabloid" | "A3";
  pdfLandscape?: boolean;
  pdfPrintBackground?: boolean;
  pdfScale?: number;
  pdfMargin?: { top?: string; right?: string; bottom?: string; left?: string };
  async?: boolean;
  webhookUrl?: string;
  cacheTtl?: number;
  data?: Record<string, unknown>;
}

export interface ExtractParams {
  url: string;
  extractFormat?: "markdown" | "json" | "html";
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  timeout?: number;
  device?: "desktop" | "iphone_15" | "iphone_se" | "pixel_8" | "ipad" | "ipad_pro";
  blockAds?: boolean;
  blockCookieBanners?: boolean;
  hideSelectors?: string[];
}

export interface ExtractResponse {
  url: string;
  format: "markdown" | "json" | "html";
  content: string;
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  length?: number;
  loadTimeMs: number;
}

export interface ScreenshotResponse {
  image: string; // base64
  contentType: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytesSize: number;
  capturedAt: string;
  quality: "full" | "degraded" | "best_attempt";
  waitStrategy: string;
  loadTimeMs: number;
  truncated?: boolean;
}

// A signed, hosted, edge-cached render URL (POST /v1/render/link) for embedding
// in <meta property="og:image"> or an <img> tag.
export interface RenderLinkResult {
  url: string;
  expiresAt: string;
  format: string;
  cacheTtl: number;
}

// ─── Agent-ready artifact (POST /v1/artifact) ────────────────────────
export interface ArtifactBranding {
  logo?: string;
  accentColor?: string;
  font?: string;
  header?: string;
  footer?: string;
}

export interface ArtifactPageSetup {
  size?: "A4" | "Letter" | "Legal" | "Tabloid" | "A3";
  orientation?: "portrait" | "landscape";
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  scale?: number;
  width?: number;
  height?: number;
  fullPage?: boolean;
}

export interface ArtifactParams {
  content: string;
  inputFormat?: "markdown" | "html";
  formats?: ("pdf" | "png")[];
  branding?: ArtifactBranding;
  pageSetup?: ArtifactPageSetup;
  data?: Record<string, unknown>;
  expiresIn?: number;
}

export interface ArtifactResult {
  pdfUrl?: string;
  pngUrl?: string;
  shareUrl: string;
  expiresAt: string;
}

// ─── Rendex Watch (website-change monitoring) ────────────────────────

export interface WatchRenderParams {
  format?: "png" | "jpeg" | "webp" | "pdf";
  width?: number;
  height?: number;
  fullPage?: boolean;
  device?: "desktop" | "iphone_15" | "iphone_se" | "pixel_8" | "ipad" | "ipad_pro";
  deviceScaleFactor?: number;
  darkMode?: boolean;
  blockAds?: boolean;
  blockCookieBanners?: boolean;
  hideSelectors?: string[];
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  delay?: number;
  timeout?: number;
  geo?: string;
  geoCity?: string;
  geoState?: string;
  selector?: string;
  ignoreRegions?: Array<{ x: number; y: number; width: number; height: number }>;
  ignoreText?: string[];
  minTextChars?: number;
  suppressWhilePresent?: string[];
  uaMode?: "auto" | "identify" | "stealth";
}

export interface CreateWatchParams {
  url: string;
  name?: string;
  intervalMinutes?: number;
  diffMode?: "visual" | "text" | "both";
  threshold?: number;
  renderParams?: WatchRenderParams;
  aiSummary?: boolean;
  webhookUrl?: string;
  notifyEmail?: string;
  paused?: boolean;
}

// Partial create shape for PATCH /v1/watches/{id}. webhookUrl/notifyEmail accept
// null to clear a channel; renderParams is deep-merged server-side.
export interface UpdateWatchParams {
  url?: string;
  name?: string | null;
  intervalMinutes?: number;
  diffMode?: "visual" | "text" | "both";
  threshold?: number;
  renderParams?: WatchRenderParams;
  aiSummary?: boolean;
  webhookUrl?: string | null;
  notifyEmail?: string | null;
  paused?: boolean;
}

export interface ListWatchesQuery {
  status?: "active" | "paused" | "all";
  cursor?: string;
  limit?: number;
}

export interface ListWatchRunsQuery {
  cursor?: string;
  limit?: number;
}

export interface Watch {
  id: string;
  url: string;
  name: string | null;
  intervalMinutes: number;
  diffMode: "visual" | "text" | "both";
  threshold: number;
  renderParams: WatchRenderParams;
  aiSummary: boolean;
  webhookUrl: string | null;
  notifyEmail: string | null;
  status: "active" | "paused";
  baselineImageUrl: string | null;
  baselineCapturedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastChangedAt: string | null;
  lastStatus: string | null;
  consecutiveFailures: number;
  uaBlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchRun {
  id: string;
  watchId: string;
  status: "queued" | "processing" | "completed" | "failed";
  changed: boolean | null;
  diffScore: number | null;
  diffPixels: number | null;
  beforeUrl: string | null;
  afterUrl: string | null;
  diffOverlayUrl: string | null;
  cropUrl: string | null;
  changedRegion: { x: number; y: number; width: number; height: number } | null;
  aiSummary: string | null;
  textDiff: { added?: string[]; removed?: string[]; summary?: string } | null;
  creditsCharged: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WatchTestResult {
  ok: boolean;
  reachable: boolean;
  format?: string;
  httpStatus?: number | null;
  usedGeo?: boolean;
  screenshotUrl?: string | null;
  extractedText?: string | null;
  capturedAt?: string;
  reason?: string;
}

export interface WatchRunQueued {
  runId: string;
  watchId: string;
  status: "queued";
}

export interface WatchList {
  items: Watch[];
  nextCursor: string | null;
}

export interface WatchRunList {
  items: WatchRun[];
  nextCursor: string | null;
}

export interface AccountResult {
  plan: "free" | "starter" | "pro" | "enterprise";
  usage: {
    used: number | null;
    limit: number | null;
    remaining: number | null;
    unlimited: boolean;
    resetsAt: string | null;
  };
  rateLimitPerMinute: number;
  upgrade: {
    recommendedPlan: "starter" | "pro" | "enterprise";
    recommendedPlanCredits: number | null;
    upgradeUrl: string;
    manageBillingUrl: string;
  } | null;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    usage?: { credits: number; remaining: number };
  };
}

interface ApiErrorResponse {
  success: false;
  error: RendexRestError;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class RendexClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? API_BASE;
  }

  // Fail FAST instead of hanging. The API bounds a render at ~60s, so a call
  // still pending past ~65s is a stalled socket — abort it and return a terminal
  // error so the agent doesn't hang or silently retry-loop. (No client deadline
  // existed before; the `timeout` param is only the upstream page-load budget.)
  private async fetchWithTimeout(url: string, init: RequestInit, ms = 65_000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new RendexApiError(
          `The request exceeded ${Math.round(ms / 1000)}s and was aborted. Try a simpler request (a single format, a shorter timeout, or bestAttempt=true). Do not retry immediately.`
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async screenshot(params: ScreenshotParams): Promise<ScreenshotResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/v1/screenshot/json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(params),
    });

    const body = (await response.json().catch(() => null)) as ApiResponse<ScreenshotResponse> | null;
    if (body && body.success) return body.data;
    if (body && body.success === false) {
      throw new RendexApiError(formatApiError(response.status, body.error, response.headers.get("retry-after")));
    }
    throw new RendexApiError(nonJsonError(response));
  }

  async extract(params: ExtractParams): Promise<ExtractResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/v1/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(params),
    });

    const body = (await response.json().catch(() => null)) as ApiResponse<ExtractResponse> | null;
    if (body && body.success) return body.data;
    if (body && body.success === false) {
      throw new RendexApiError(formatApiError(response.status, body.error, response.headers.get("retry-after")));
    }
    throw new RendexApiError(nonJsonError(response));
  }

  async renderLink(params: ScreenshotParams & { expiresIn?: number }): Promise<RenderLinkResult> {
    return this.request<RenderLinkResult>("POST", "/v1/render/link", params);
  }

  async artifact(params: ArtifactParams): Promise<ArtifactResult> {
    return this.request<ArtifactResult>("POST", "/v1/artifact", params);
  }

  async account(): Promise<AccountResult> {
    return this.request<AccountResult>("GET", "/v1/account");
  }

  // ─── Rendex Watch ──────────────────────────────────────────────────

  async watchCreate(params: CreateWatchParams): Promise<Watch> {
    return this.request<Watch>("POST", "/v1/watches", params);
  }

  async watchList(query?: ListWatchesQuery): Promise<WatchList> {
    return this.request<WatchList>("GET", `/v1/watches${this.qs(query)}`);
  }

  async watchGet(id: string): Promise<Watch> {
    return this.request<Watch>("GET", `/v1/watches/${encodeURIComponent(id)}`);
  }

  async watchRun(id: string): Promise<WatchRunQueued> {
    return this.request<WatchRunQueued>("POST", `/v1/watches/${encodeURIComponent(id)}/run`, {});
  }

  async watchTest(params: CreateWatchParams): Promise<WatchTestResult> {
    return this.request<WatchTestResult>("POST", "/v1/watches/test", params);
  }

  async watchRuns(id: string, query?: ListWatchRunsQuery): Promise<WatchRunList> {
    return this.request<WatchRunList>("GET", `/v1/watches/${encodeURIComponent(id)}/runs${this.qs(query)}`);
  }

  async watchDelete(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/watches/${encodeURIComponent(id)}`);
  }

  async watchUpdate(id: string, patch: UpdateWatchParams): Promise<Watch> {
    return this.request<Watch>("PATCH", `/v1/watches/${encodeURIComponent(id)}`, patch);
  }

  // ─── Shared request helper (GET/POST/PATCH/DELETE + 204 + envelope) ──

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": USER_AGENT,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // 204 No Content (DELETE) — nothing to parse.
    if (response.status === 204) return undefined as T;

    const parsed = (await response.json().catch(() => null)) as ApiResponse<T> | null;
    if (parsed && parsed.success) return parsed.data;

    if (parsed && parsed.success === false) {
      throw new RendexApiError(formatApiError(response.status, parsed.error, response.headers.get("retry-after")));
    }
    throw new RendexApiError(nonJsonError(response));
  }

  private qs(query?: ListWatchesQuery | ListWatchRunsQuery): string {
    if (!query) return "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  }
}

export class RendexApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RendexApiError";
  }
}
