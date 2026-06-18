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
  RATE_LIMITED: () =>
    "Rate limit exceeded. Wait a moment and try again, or upgrade your plan at https://rendex.dev/pricing",
  USAGE_EXCEEDED: () =>
    "Monthly usage limit reached. Upgrade your plan at https://rendex.dev/dashboard/billing",
  VALIDATION_ERROR: (msg) => `Invalid parameters: ${msg}`,
  INVALID_URL: (msg) => `Invalid URL: ${msg}`,
  INVALID_JSON: (msg) => msg,
  TIMEOUT: () =>
    "The page took too long to load. Try a different URL or increase the delay parameter.",
  CAPTURE_FAILED: (msg) => `Screenshot capture failed: ${msg}`,
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

// Plan/limit walls that the API returns as 403 (Watch caps, paid-feature gates).
// These are conversion moments, NOT auth failures — prefixing them with the
// status-derived "Access denied" makes an agent read a quota as a bad key. For
// these codes we drop the prefix (the message already names the limit) and lean
// on the appended upgrade_url. Genuine auth-forbidden (FORBIDDEN /
// INSUFFICIENT_PERMISSIONS) and every other status keep the status context.
const UPGRADE_LIMIT_CODES = new Set([
  "WATCH_LIMIT_REACHED",
  "WATCH_HOST_LIMIT_REACHED",
  "WATCH_INTERVAL_TOO_FAST",
  "PLAN_UPGRADE_REQUIRED",
]);

// Compose the agent-readable error string from an HTTP status + the REST error
// body. The single place that decides whether the "Access denied"/status prefix
// applies and that re-attaches the API's upgrade_url (which translateError drops).
export function formatApiError(status: number, error: RendexRestError): string {
  const message = translateError(error);
  const withUpgrade = (base: string) =>
    error.upgrade_url ? `${base} Upgrade: ${error.upgrade_url}` : base;
  if (UPGRADE_LIMIT_CODES.has(error.code)) {
    return withUpgrade(message);
  }
  return withUpgrade(`${httpStatusToContext(status)}: ${message}`);
}
