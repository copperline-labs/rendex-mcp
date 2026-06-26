// ─── REST API Error → MCP Error Translation ─────────────────────────

export interface RendexRestError {
  code: string;
  message: string;
  details?: unknown;
  /**
   * Present on plan-wall responses (the API's upgradeError() + the over-quota
   * 429). The actionable upgrade link — surfaced to the agent, never dropped.
   */
  upgrade_url?: string;
}

const ERROR_MESSAGES: Record<string, (original: string) => string> = {
  MISSING_API_KEY: () =>
    "No API key provided. Set RENDEX_API_KEY in your MCP client config. Get a key at https://rendex.dev",
  INVALID_API_KEY: () =>
    "Invalid API key. Check your key at https://rendex.dev/dashboard",
  KEY_DISABLED: () =>
    "Your API key has been disabled. Contact support at https://rendex.dev",
  RATE_LIMITED: () => "Per-minute rate limit reached for your plan.",
  USAGE_EXCEEDED: () =>
    "Monthly render quota reached — retrying won't help until it resets. Upgrade for more at https://rendex.dev/pricing",
  VALIDATION_ERROR: (msg) => `Invalid parameters: ${msg}`,
  INVALID_URL: (msg) => `Invalid URL: ${msg}`,
  INVALID_JSON: (msg) => msg,
  TIMEOUT: () =>
    "The page took too long to load. Increase the timeout, or set bestAttempt=true to return a partial capture instead of failing.",
  CAPTURE_FAILED: (msg) =>
    msg || "The render failed — check the input (URL reachable, valid HTML, valid selector).",
  UNSAFE_URL: (msg) => `URL blocked for safety: ${msg}`,
  INVALID_WEBHOOK_URL: (msg) => `Webhook URL not allowed: ${msg}`,
  QUEUE_LIMIT_REACHED: (msg) => `Too many active async jobs. ${msg}`,
  BATCH_LIMIT_EXCEEDED: (msg) => `Batch size exceeds plan limit. ${msg}`,
  NOT_FOUND: (msg) => msg || "The requested resource was not found.",
  INTERNAL_ERROR: () =>
    "An internal server error occurred. Please try again or contact support.",
  FORBIDDEN: () =>
    "Check your API key permissions.",
  GEO_FEATURE_UNAVAILABLE: (msg) => `Geo-targeting issue: ${msg}`,
  PLAN_UPGRADE_REQUIRED: (msg) => `Plan upgrade required: ${msg}`,
  CONFIGURATION_ERROR: () =>
    "A server configuration issue occurred. Please try again later.",
  SERVICE_UNAVAILABLE: () =>
    "Rendex is briefly unavailable (a transient backend hiccup).",
  // ── Rendex Watch ──
  WATCH_NOT_FOUND: (msg) => msg || "Watch not found.",
  WATCH_PAUSED: (msg) => msg || "This watch is paused — resume it before running.",
  WATCH_LIMIT_REACHED: (msg) => `Watch limit reached. ${msg}`,
  WATCH_HOST_LIMIT_REACHED: (msg) => msg,
  WATCH_INTERVAL_TOO_FAST: (msg) => `Check interval too fast for your plan. ${msg}`,
};

export function translateError(error: RendexRestError): string {
  const translator = ERROR_MESSAGES[error.code];
  if (translator) {
    return translator(error.message);
  }
  return error.message || "An unexpected error occurred.";
}

export function httpStatusToContext(status: number): string {
  switch (status) {
    case 401:
      return "Authentication failed";
    case 403:
      return "Access denied";
    case 408:
      return "Request timeout";
    case 429:
      return "Rate limit exceeded";
    case 500:
      return "Server error";
    default:
      return `HTTP ${status}`;
  }
}

// Codes whose message is already self-explanatory + actionable (upgrade walls,
// monthly quota, input errors). The status-derived prefix ("Access denied" /
// "Rate limit exceeded" / "Server error") would MISLABEL them for an agent — e.g.
// reading a monthly quota as a per-minute rate limit and retrying it for nothing.
// So we drop the prefix; retrying the same request won't help.
const NO_STATUS_PREFIX = new Set([
  "WATCH_LIMIT_REACHED",
  "WATCH_HOST_LIMIT_REACHED",
  "WATCH_INTERVAL_TOO_FAST",
  "PLAN_UPGRADE_REQUIRED",
  "USAGE_EXCEEDED",
  "VALIDATION_ERROR",
  "INVALID_URL",
  "INVALID_JSON",
  "UNSAFE_URL",
  "INVALID_WEBHOOK_URL",
  "BATCH_LIMIT_EXCEEDED",
  "GEO_FEATURE_UNAVAILABLE",
  "EXTRACTION_FAILED",
  "PAYLOAD_TOO_LARGE",
]);

// Genuinely transient — safe to retry after a SHORT backoff. We surface the
// server's Retry-After so the agent waits a concrete amount instead of hammering
// the tool until the host platform blocks it (the classic agent retry-storm).
const RETRYABLE_CODES = new Set(["RATE_LIMITED", "SERVICE_UNAVAILABLE"]);

// Compose the agent-readable error string from an HTTP status + REST error body
// (+ the response's Retry-After header, passed by the client). The single place
// that decides retry guidance, drops misleading status prefixes, and re-attaches
// the API's upgrade_url (which translateError drops).
export function formatApiError(
  status: number,
  error: RendexRestError,
  retryAfter?: string | null
): string {
  const message = translateError(error);
  const upgrade = error.upgrade_url ? ` Upgrade: ${error.upgrade_url}` : "";

  if (RETRYABLE_CODES.has(error.code) || status === 503) {
    const secs = retryAfter && /^\d+$/.test(retryAfter.trim()) ? retryAfter.trim() : null;
    const backoff = secs
      ? ` Retry after ${secs} seconds — do not retry before then.`
      : " This is transient — wait a few seconds before retrying.";
    return `${message}${backoff}${upgrade}`;
  }
  if (NO_STATUS_PREFIX.has(error.code)) {
    return `${message}${upgrade}`;
  }
  return `${httpStatusToContext(status)}: ${message}${upgrade}`;
}

// Clean message for a non-JSON upstream response (CF 502/1010/timeout HTML page),
// so the highest-traffic tools don't surface a cryptic "Unexpected token <".
export function nonJsonError(response: { status: number }): string {
  return `Rendex returned a non-JSON response (HTTP ${response.status}) — likely a transient gateway error. Wait a few seconds, then retry.`;
}
