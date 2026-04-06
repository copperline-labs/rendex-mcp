// ─── rendex_screenshot Tool ──────────────────────────────────────────

import { z } from "zod";
import { RendexClient, RendexApiError } from "../lib/client.js";

export const TOOL_NAME = "rendex_screenshot";

export const TOOL_DESCRIPTION =
  "Capture a screenshot or PDF of any webpage or raw HTML. " +
  "Supports full-page capture, dark mode, ad blocking, custom viewports, " +
  "CSS/JS injection, cookie/header injection, PDF output, HTML rendering, " +
  "and progressive fallback for heavy sites. Returns partial renders on " +
  "timeout by default (bestAttempt mode).";

export const ScreenshotInputSchema = z.object({
  // Source — provide url OR html (not both)
  url: z
    .string()
    .url()
    .optional()
    .describe("The webpage URL to capture. Mutually exclusive with 'html'."),
  html: z
    .string()
    .max(5_242_880)
    .optional()
    .describe(
      "Raw HTML to render and capture. Mutually exclusive with 'url'. " +
      "Great for invoices, social cards, email templates, OG images."
    ),
  format: z
    .enum(["png", "jpeg", "webp", "pdf"])
    .default("png")
    .describe(
      "Output format — png (lossless), jpeg (smaller), webp (smallest), " +
      "or pdf (document). Use pdf for invoices, reports, archival."
    ),
  fullPage: z
    .boolean()
    .default(false)
    .describe("Capture the full scrollable page instead of just the viewport"),
  darkMode: z
    .boolean()
    .default(false)
    .describe("Emulate dark color scheme (prefers-color-scheme: dark)"),
  width: z
    .number()
    .int()
    .min(320)
    .max(3840)
    .default(1280)
    .describe("Viewport width in pixels (320-3840)"),
  height: z
    .number()
    .int()
    .min(240)
    .max(2160)
    .default(800)
    .describe("Viewport height in pixels (240-2160)"),
  quality: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Image quality 1-100 (JPEG/WebP only, ignored for PNG/PDF)"),
  delay: z
    .number()
    .int()
    .min(0)
    .max(10000)
    .default(0)
    .describe(
      "Milliseconds to wait after page load before capture (useful for JS-rendered content)"
    ),
  blockAds: z
    .boolean()
    .default(true)
    .describe("Block ads and trackers before capture"),
  blockResourceTypes: z
    .array(z.enum(["font", "image", "media", "stylesheet", "other"]))
    .optional()
    .describe(
      "Block specific resource types to speed up capture. " +
      "E.g. ['font', 'image'] for text-only screenshots."
    ),
  deviceScaleFactor: z
    .number()
    .min(1)
    .max(3)
    .default(1)
    .describe("Device pixel ratio (1 = standard, 2 = retina)"),
  timeout: z
    .number()
    .int()
    .min(5)
    .max(60)
    .default(30)
    .describe(
      "Maximum seconds to wait for page load (5-60). Cloudflare has a 60s hard cap."
    ),
  waitUntil: z
    .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
    .default("networkidle2")
    .describe(
      "Page readiness event. networkidle2 (default) is best for most sites. " +
      "Use domcontentloaded for speed, networkidle0 for completeness."
    ),
  waitForSelector: z
    .string()
    .max(500)
    .optional()
    .describe(
      "CSS selector to wait for before capture. Essential for SPAs " +
      "(e.g. '.main-content', '#app-loaded')"
    ),
  bestAttempt: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), capture whatever is rendered on timeout instead of " +
      "failing. Set to false to get a hard error on timeout."
    ),
  selector: z
    .string()
    .max(500)
    .optional()
    .describe(
      "CSS selector of a specific element to capture instead of the full page. " +
      "Useful for OG images, component extraction (e.g. '#hero', '.pricing-card')"
    ),

  // CSS/JS Injection
  css: z
    .string()
    .max(51_200)
    .optional()
    .describe(
      "Custom CSS to inject into the page before capture. " +
      "Hide cookie banners, add watermarks, override styles. Max 50KB."
    ),
  js: z
    .string()
    .max(51_200)
    .optional()
    .describe(
      "Custom JavaScript to execute in the page before capture. " +
      "Runs in the browser sandbox. Max 50KB."
    ),

  // Cookie/Header Injection
  cookies: z
    .array(
      z.object({
        name: z.string().describe("Cookie name"),
        value: z.string().describe("Cookie value"),
        domain: z.string().optional().describe("Cookie domain (must match target URL domain)"),
        path: z.string().optional().describe("Cookie path"),
        httpOnly: z.boolean().optional().describe("HTTP-only flag"),
        secure: z.boolean().optional().describe("Secure flag"),
        sameSite: z.enum(["Strict", "Lax", "None"]).optional().describe("SameSite attribute"),
        expires: z.number().optional().describe("Expiry as Unix timestamp"),
      })
    )
    .max(50)
    .optional()
    .describe(
      "Cookies to set before capture. Useful for authenticated pages. " +
      "Max 50 cookies."
    ),
  headers: z
    .record(z.string())
    .optional()
    .describe(
      "Custom HTTP headers to send with the page request. " +
      "Cannot override Host, Connection, Content-Length, or Transfer-Encoding."
    ),
  userAgent: z
    .string()
    .max(512)
    .optional()
    .describe("Override the browser user agent string."),

  // PDF-specific options
  pdfFormat: z
    .enum(["A4", "Letter", "Legal", "Tabloid", "A3"])
    .optional()
    .describe("PDF page size. Only used when format='pdf'. Default: A4"),
  pdfLandscape: z
    .boolean()
    .optional()
    .describe("PDF landscape orientation. Only used when format='pdf'."),
  pdfPrintBackground: z
    .boolean()
    .optional()
    .describe("Print background colors/images in PDF. Default: true"),
  pdfScale: z
    .number()
    .min(0.1)
    .max(2)
    .optional()
    .describe("PDF scale factor (0.1-2). Default: 1"),
  pdfMargin: z
    .object({
      top: z.string().optional().describe("Top margin (CSS value, e.g. '1cm', '20px')"),
      right: z.string().optional().describe("Right margin"),
      bottom: z.string().optional().describe("Bottom margin"),
      left: z.string().optional().describe("Left margin"),
    })
    .optional()
    .describe("PDF page margins. Only used when format='pdf'. Accepts CSS values."),

  // Async pipeline
  async: z
    .boolean()
    .optional()
    .describe(
      "Process capture asynchronously. Returns a jobId immediately instead of waiting. " +
      "Poll GET /v1/jobs/:jobId for status, or use webhookUrl for push notification."
    ),
  webhookUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "URL to receive a POST callback when async capture completes. " +
      "Payload is HMAC-SHA256 signed. Requires async=true."
    ),
  cacheTtl: z
    .number()
    .int()
    .min(3600)
    .max(2592000)
    .optional()
    .describe(
      "Seconds to cache the result in R2 storage (3600-2592000). " +
      "Returns a signed URL for retrieval. Requires async=true."
    ),

  // Geo-targeting (Pro/Enterprise only)
  geo: z
    .string()
    .length(2)
    .optional()
    .describe(
      "ISO 3166-1 alpha-2 country code for geo-targeted capture (e.g., 'US', 'DE', 'JP'). " +
      "Renders the page as seen from that country. Pro/Enterprise only. " +
      "Note: CSS/JS injection, cookies, element capture, dark mode, and some other " +
      "features are not available with geo-targeting."
    ),
  geoCity: z
    .string()
    .max(100)
    .optional()
    .describe("City for more precise geo-targeting (e.g., 'Berlin', 'New York'). Requires 'geo'."),
  geoState: z
    .string()
    .max(100)
    .optional()
    .describe("State or region for more precise geo-targeting (e.g., 'California'). Requires 'geo'."),
});

export type ScreenshotInput = z.infer<typeof ScreenshotInputSchema>;

export async function handleScreenshot(
  client: RendexClient,
  params: ScreenshotInput
) {
  try {
    const result = await client.screenshot(params);

    const isPdf = result.format === "pdf";

    const metadataText = JSON.stringify(
      {
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytesSize: result.bytesSize,
        capturedAt: result.capturedAt,
        quality: result.quality,
        waitStrategy: result.waitStrategy,
        loadTimeMs: result.loadTimeMs,
        ...(result.truncated ? { truncated: true } : {}),
        ...((result as any).renderingEngine ? { renderingEngine: (result as any).renderingEngine } : {}),
        ...((result as any).geoCountry ? { geoCountry: (result as any).geoCountry } : {}),
      },
      null,
      2
    );

    // PDF: return metadata only (can't embed PDF as image in MCP)
    if (isPdf) {
      return {
        content: [
          {
            type: "text" as const,
            text: `PDF captured successfully (${result.bytesSize} bytes).\n\n${metadataText}`,
          },
        ],
      };
    }

    // Image: return embedded image + metadata
    const mimeType =
      result.format === "jpeg"
        ? "image/jpeg"
        : result.format === "webp"
          ? "image/webp"
          : "image/png";

    return {
      content: [
        {
          type: "image" as const,
          data: result.image,
          mimeType,
        },
        {
          type: "text" as const,
          text: metadataText,
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof RendexApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error capturing screenshot";

    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
}
