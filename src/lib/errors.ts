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
  VALIDATION_ERROR: (msg) => `Invalid parameters: ${msg}`,
  INVALID_URL: (msg) => `Invalid URL: ${msg}`,
  INVALID_JSON: (msg) => msg,
  TIMEOUT: () =>
    "The page took too long to load. Try a different URL or increase the delay parameter.",
  CAPTURE_FAILED: (msg) => `Screenshot capture failed: ${msg}`,
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
