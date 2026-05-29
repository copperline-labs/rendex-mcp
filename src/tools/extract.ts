// ─── rendex_extract Tool ─────────────────────────────────────────────

import { z } from "zod";
import { RendexClient, RendexApiError } from "../lib/client.js";

export const EXTRACT_TOOL_NAME = "rendex_extract";

export const EXTRACT_TOOL_DESCRIPTION =
  "Extract clean reader-mode content from any webpage as Markdown, JSON, or HTML. " +
  "Runs the same Chromium render pass as a screenshot, so it captures content after " +
  "JavaScript runs — handles SPAs that fetch-only readers miss. Strips nav, ads, and " +
  "boilerplate, returning the article body plus title, byline, and excerpt. " +
  "Great for feeding page content to an LLM, summarization, or RAG ingestion.";

export const ExtractInputSchema = z.object({
  url: z
    .string()
    .url()
    .describe("The webpage URL to extract readable content from."),
  extractFormat: z
    .enum(["markdown", "json", "html"])
    .default("markdown")
    .describe(
      "Output shape — markdown (default, LLM-friendly prose), " +
      "json (structured fields: title/byline/excerpt/siteName/length), " +
      "or html (cleaned reader-mode HTML)."
    ),
  waitUntil: z
    .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
    .default("networkidle2")
    .describe(
      "Page readiness event. networkidle2 (default) is best for most sites. " +
      "Use domcontentloaded for speed, networkidle0 for completeness."
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
  device: z
    .enum(["desktop", "iphone_15", "iphone_se", "pixel_8", "ipad", "ipad_pro"])
    .optional()
    .describe(
      "Device preset that sets viewport, scale factor, and user agent in one shot. " +
      "E.g. 'iphone_15' to extract the mobile version of a page."
    ),
  blockAds: z
    .boolean()
    .default(true)
    .describe("Block ads and trackers before extraction"),
  blockCookieBanners: z
    .boolean()
    .optional()
    .describe(
      "Hide common cookie/consent walls (GDPR/CCPA banners) before extraction. " +
      "A curated selector list, lighter than custom hideSelectors."
    ),
  hideSelectors: z
    .array(z.string())
    .max(50)
    .optional()
    .describe(
      "CSS selectors to hide (display:none) before extraction. " +
      "E.g. ['.modal', '#newsletter-popup'] to remove overlays. Max 50 selectors."
    ),
});

export type ExtractInput = z.infer<typeof ExtractInputSchema>;

export async function handleExtract(
  client: RendexClient,
  params: ExtractInput
) {
  try {
    const result = await client.extract(params);

    const header = [result.title, result.siteName]
      .filter(Boolean)
      .join(" — ");

    const text = header ? `${header}\n\n${result.content}` : result.content;

    return {
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof RendexApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error extracting content";

    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
}
