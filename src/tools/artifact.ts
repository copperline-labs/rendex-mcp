// ─── render_artifact Tool ────────────────────────────────────────────
// The agent-native headline: turn Markdown or HTML + a small branding theme
// into a branded PDF + PNG + a hosted share page in ONE call. Returns hosted
// URLs (not bytes), so an agent can hand the user a downloadable artifact and
// a shareable link without any storage of its own.

import { z } from "zod";
import { RendexClient, RendexApiError } from "../lib/client.js";

export const ARTIFACT_NAME = "render_artifact";

export const ARTIFACT_DESCRIPTION =
  "Turn Markdown or HTML into a branded, downloadable artifact — a PDF, a PNG, and a hosted share page — in one call. " +
  "Ideal for agent outputs: reports, invoices, summaries, release notes, dashboards. " +
  "Apply a logo, accent color, font, header, and footer; choose PDF page size/orientation/margins. " +
  "Returns hosted URLs { pdfUrl, pngUrl, shareUrl, expiresAt } — no storage needed on your side. " +
  "Each requested format costs 1 render credit.";

const BrandingSchema = z
  .object({
    logo: z.string().url().max(2048).optional().describe("Absolute http(s) URL of a logo image shown in the header."),
    accentColor: z.string().max(64).optional().describe("CSS color for the accent bar, links, and headings (e.g. '#EA580C')."),
    font: z.string().max(120).optional().describe("CSS font-family stack for the body (e.g. 'Georgia, serif')."),
    header: z.string().max(2000).optional().describe("Plain-text header line shown beside the logo."),
    footer: z.string().max(2000).optional().describe("Plain-text footer line shown at the bottom."),
  })
  .describe("Optional branding theme applied to the artifact.");

const PageSetupSchema = z
  .object({
    size: z.enum(["A4", "Letter", "Legal", "Tabloid", "A3"]).optional().describe("PDF paper size. Default A4."),
    orientation: z.enum(["portrait", "landscape"]).optional().describe("PDF orientation. Default portrait."),
    margin: z
      .object({
        top: z.string().max(16).optional(),
        right: z.string().max(16).optional(),
        bottom: z.string().max(16).optional(),
        left: z.string().max(16).optional(),
      })
      .optional()
      .describe("PDF margins as CSS values (e.g. '1cm')."),
    scale: z.number().min(0.1).max(2).optional().describe("PDF render scale (0.1-2). Default 1."),
    width: z.number().int().min(320).max(3840).optional().describe("PNG viewport width in px. Default 1280."),
    height: z.number().int().min(240).max(2160).optional().describe("PNG viewport height in px. Default 800."),
    fullPage: z.boolean().optional().describe("Capture the full scrollable page for the PNG. Default true."),
  })
  .describe("Optional paper/viewport setup.");

export const ArtifactInputSchema = z.object({
  content: z.string().min(1).max(4_000_000).describe("The Markdown or HTML body to render (up to ~4MB)."),
  inputFormat: z
    .enum(["markdown", "html"])
    .default("markdown")
    .describe("How to interpret content. 'markdown' is converted to styled HTML; 'html' is used as a body fragment."),
  formats: z
    .array(z.enum(["pdf", "png"]))
    .min(1)
    .max(2)
    .default(["pdf", "png"])
    .describe("Which formats to produce. Each costs 1 credit. Default both."),
  branding: BrandingSchema.optional(),
  pageSetup: PageSetupSchema.optional(),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional Mustache data. When present, content is rendered as a logic-less Mustache template " +
      "(plus the branding fields as {{logo}}/{{header}}/...) before conversion."
    ),
  expiresIn: z
    .number()
    .int()
    .min(3600)
    .max(2_592_000)
    .optional()
    .describe("Seconds until the hosted URLs expire (3600-2592000). Default 86400 (24h)."),
});

export type ArtifactInput = z.infer<typeof ArtifactInputSchema>;

export async function handleArtifact(client: RendexClient, params: ArtifactInput) {
  try {
    const result = await client.artifact(params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      // ChatGPT Apps populates the preview widget's window.openai.toolOutput from
      // structuredContent (NOT the text block). Without this the artifact-preview
      // widget renders its frame but shows "No artifact links returned".
      structuredContent: result as unknown as Record<string, unknown>,
    };
  } catch (err) {
    const message =
      err instanceof RendexApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error rendering artifact";

    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
}
