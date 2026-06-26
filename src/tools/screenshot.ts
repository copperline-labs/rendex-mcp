// ─── rendex_screenshot Tool ──────────────────────────────────────────

import { z } from "zod";
import { RendexClient, RendexApiError, type ScreenshotParams } from "../lib/client.js";
import { asStructured, hostedRenderPreview } from "../lib/preview.js";

export const TOOL_NAME = "rendex_screenshot";

export const TOOL_DESCRIPTION =
  "Capture a screenshot or PDF of any webpage, raw HTML, or Markdown. " +
  "Supports full-page capture, dark mode, ad blocking, custom viewports, " +
  "CSS/JS injection, cookie/header injection, PDF output, HTML and Markdown rendering, " +
  "and progressive fallback for heavy sites. Returns partial renders on " +
  "timeout by default (bestAttempt mode). " +
  "Costs 1 render credit per call. Cookie/header injection requires Starter+; " +
  "geo-targeting requires Pro+.";

export const ScreenshotInputSchema = z.object({
  // Source — provide exactly one of url, html, or markdown
  url: z
    .string()
    .url()
    .optional()
    .describe("The webpage URL to capture. Mutually exclusive with 'html' and 'markdown'."),
  html: z
    .string()
    .max(5_242_880)
    .optional()
    .describe(
      "Raw HTML to render and capture. Mutually exclusive with 'url' and 'markdown'. " +
      "Great for invoices, social cards, email templates, OG images."
    ),
  markdown: z
    .string()
    .max(5_242_880)
    .optional()
    .describe(
      "Markdown to render to an image or PDF. Mutually exclusive with 'url' and 'html'. " +
      "The server converts it to HTML before rendering. " +
      "Great for reports, release notes, README snapshots, documentation cards."
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
    .default(2)
    .describe("Device pixel ratio (1 = standard, 2 = retina). Defaults to 2× Retina."),
  device: z
    .enum(["desktop", "iphone_15", "iphone_se", "pixel_8", "ipad", "ipad_pro"])
    .optional()
    .describe(
      "Device preset that sets viewport, scale factor, and user agent in one shot. " +
      "E.g. 'iphone_15' for a mobile screenshot. Overrides width/height/deviceScaleFactor/userAgent."
    ),
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
  hideSelectors: z
    .array(z.string())
    .max(50)
    .optional()
    .describe(
      "CSS selectors to hide (display:none) before capture. " +
      "E.g. ['.modal', '#newsletter-popup'] to remove overlays. Max 50 selectors."
    ),
  blockCookieBanners: z
    .boolean()
    .optional()
    .describe(
      "Hide common cookie/consent walls (GDPR/CCPA banners) before capture. " +
      "A curated selector list, lighter than custom hideSelectors."
    ),
  resizeWidth: z
    .number()
    .int()
    .min(16)
    .max(3840)
    .optional()
    .describe(
      "Downscale the captured image to this width in pixels (16-3840). " +
      "Aspect ratio is preserved if resizeHeight is omitted. Ignored for PDF."
    ),
  resizeHeight: z
    .number()
    .int()
    .min(16)
    .max(2160)
    .optional()
    .describe(
      "Downscale the captured image to this height in pixels (16-2160). " +
      "Aspect ratio is preserved if resizeWidth is omitted. Ignored for PDF."
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

  // NOTE: async / webhookUrl / cacheTtl are intentionally NOT exposed over MCP.
  // There is no job-polling MCP tool, so async:true would return a jobId the
  // agent can't use (the client would mis-read the queued envelope as an empty
  // image). MCP capture is synchronous; use rendex_render_link for a hosted URL.

  // Mustache data templating
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Key-value data object for Mustache templating. When provided, the 'html' or 'markdown' " +
      "string is rendered as a logic-less Mustache template before capture — " +
      "{{var}} inserts HTML-escaped, {{{var}}} inserts raw, " +
      "{{#items}}...{{/items}} iterates arrays, {{a.b}} accesses nested fields. " +
      "Not valid with 'url'. Max 256KB serialized."
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
  params: ScreenshotInput,
  preview = false
) {
  try {
    if (preview) {
      // ChatGPT/remote: return a HOSTED render URL + structuredContent so the
      // render-preview widget shows the capture inline with download/open actions
      // (ChatGPT Apps doesn't inline-render the raw image bytes stdio clients use).
      const link = await client.renderLink(params as unknown as ScreenshotParams);
      const target = params.url ?? "your content";
      return {
        content: [
          {
            type: "text" as const,
            text: `Captured a ${link.format} of ${target}. Preview + download are shown above. Hosted link (expires ${link.expiresAt}): ${link.url}`,
          },
        ],
        structuredContent: asStructured(
          hostedRenderPreview({
            url: link.url,
            format: link.format,
            expiresAt: link.expiresAt,
            title: `Screenshot${params.url ? " of " + params.url : ""}`,
          })
        ),
      };
    }
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

// ─── rendex_render_link Tool ─────────────────────────────────────────
// Mint a signed, hosted, edge-cached render URL instead of returning bytes —
// drop it straight into <meta property="og:image"> or an <img> tag.

export const RENDER_LINK_NAME = "rendex_render_link";

export const RENDER_LINK_DESCRIPTION =
  "Render a URL, raw HTML, or Markdown and get back a signed, hosted, edge-cached image URL " +
  "instead of the bytes — ideal for dynamic OG images: drop the URL into " +
  '<meta property="og:image"> or an <img> tag and Rendex serves a cached copy on every share. ' +
  "Takes the same options as rendex_screenshot, plus an optional expiresIn. Returns " +
  "{ url, expiresAt, format, cacheTtl } as JSON. " +
  "Costs 1 render credit per fresh render; cached repeat hits don't re-charge.";

export const RenderLinkInputSchema = ScreenshotInputSchema.extend({
  expiresIn: z
    .number()
    .int()
    .min(60)
    .max(2_592_000)
    .optional()
    .describe("Seconds until the signed URL expires (60–2592000). Defaults to the server's TTL."),
});

export type RenderLinkInput = z.infer<typeof RenderLinkInputSchema>;

export async function handleRenderLink(
  client: RendexClient,
  params: RenderLinkInput,
  preview = false
) {
  try {
    const result = await client.renderLink(params);
    const text = {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
    if (!preview) return text;
    return {
      ...text,
      structuredContent: asStructured(
        hostedRenderPreview({
          url: result.url,
          format: result.format,
          expiresAt: result.expiresAt,
          title: `Render link${params.url ? " · " + params.url : ""}`,
          note: "Hosted, edge-cached — drop this URL into an <img> tag or og:image.",
        })
      ),
    };
  } catch (err) {
    const message =
      err instanceof RendexApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error minting render link";

    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
}
