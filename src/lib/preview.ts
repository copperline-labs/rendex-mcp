// ─── Normalized preview shape for the ChatGPT render-preview widget ──
// Every visual Rendex tool (screenshot, render_link, render_artifact, watch_test,
// watch_runs) maps its result into this shape and returns it as the tool result's
// `structuredContent`. ChatGPT exposes that to the widget as
// window.openai.toolOutput, and src/widget.ts renders the image(s) + actions.

export interface PreviewImage {
  label?: string;
  url: string;
}

export interface RenderPreview {
  title?: string;
  /** Multiple labeled images (e.g. Watch before / after / overlay). */
  images?: PreviewImage[];
  /** Single main preview image (used when `images` is absent). */
  imageUrl?: string;
  /** Downloadable PNG/image URL. */
  pngUrl?: string;
  /** Downloadable PDF URL. */
  pdfUrl?: string;
  /** Hosted share page (render_artifact). */
  shareUrl?: string;
  /** Generic "open the hosted result" URL. */
  openUrl?: string;
  expiresAt?: string;
  note?: string;
}

/** structuredContent must be a plain JSON object; cast through unknown. */
export function asStructured(p: RenderPreview): Record<string, unknown> {
  return p as unknown as Record<string, unknown>;
}

/** A single hosted, single-format render (screenshot or render_link). */
export function hostedRenderPreview(opts: {
  url: string;
  format?: string;
  expiresAt?: string;
  title?: string;
  note?: string;
}): RenderPreview {
  const isPdf = (opts.format ?? "").toLowerCase() === "pdf";
  return {
    title: opts.title,
    imageUrl: isPdf ? undefined : opts.url,
    pngUrl: isPdf ? undefined : opts.url,
    pdfUrl: isPdf ? opts.url : undefined,
    openUrl: opts.url,
    expiresAt: opts.expiresAt,
    note: opts.note,
  };
}
