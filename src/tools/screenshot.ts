// ─── rendex_screenshot Tool ──────────────────────────────────────────

import { z } from "zod";
import { RendexClient, RendexApiError } from "../lib/client.js";

export const TOOL_NAME = "rendex_screenshot";

export const TOOL_DESCRIPTION =
  "Capture a screenshot of any webpage and return it as an image. " +
  "Supports full-page capture, dark mode, ad blocking, custom viewports, " +
  "and progressive fallback for heavy sites. Returns partial renders on " +
  "timeout by default (bestAttempt mode).";

export const ScreenshotInputSchema = z.object({
  url: z.string().url().describe("The webpage URL to capture"),
  format: z
    .enum(["png", "jpeg"])
    .default("png")
    .describe("Image format — png (lossless) or jpeg (smaller file size)"),
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
    .describe("Image quality 1-100 (JPEG only, ignored for PNG)"),
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
});

export type ScreenshotInput = z.infer<typeof ScreenshotInputSchema>;

export async function handleScreenshot(
  client: RendexClient,
  params: ScreenshotInput
) {
  try {
    const result = await client.screenshot(params);

    const mimeType =
      result.format === "jpeg" ? "image/jpeg" : "image/png";

    return {
      content: [
        {
          type: "image" as const,
          data: result.image,
          mimeType,
        },
        {
          type: "text" as const,
          text: JSON.stringify(
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
            },
            null,
            2
          ),
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
