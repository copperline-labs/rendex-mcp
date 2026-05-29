// ─── REST API Error → MCP Error Translation ─────────────────────────

export interface RendexRestError {
  code: string;
  message: string;
  details?: unknown;
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
    "Access denied. Check your API key permissions.",
  GEO_FEATURE_UNAVAILABLE: (msg) => `Geo-targeting issue: ${msg}`,
  PLAN_UPGRADE_REQUIRED: (msg) => `Plan upgrade required: ${msg}`,
  CONFIGURATION_ERROR: () =>
    "A server configuration issue occurred. Please try again later.",
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
