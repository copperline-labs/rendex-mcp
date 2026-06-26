// ─── ChatGPT Apps render-preview widget (bundled string) ─────────────
// A single shared preview component for every visual Rendex tool — screenshots,
// hosted render links, branded artifacts, and Watch run captures. Inlined as a
// string so it ships in the Worker bundle (a .html text-import would break the
// stdio/npm build, which shares server.ts).
//
// Registered as an MCP UI resource (mimeType "text/html+skybridge") and
// referenced from each visual tool's _meta["openai/outputTemplate"], so ChatGPT
// renders it inline after the call. It reads window.openai.toolOutput, a
// normalized shape (see src/lib/preview.ts → RenderPreview):
//   { title?, images?: [{label?,url}], imageUrl?, pngUrl?, pdfUrl?, shareUrl?,
//     openUrl?, expiresAt?, note? }
// and shows the image(s) + Download PDF/PNG + Open buttons (safe DOM, https-only
// sinks, no innerHTML).

export const WIDGET_URI = "ui://widget/render-preview.html";
export const WIDGET_MIME = "text/html+skybridge";

export const RENDER_PREVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --rx-accent: #EA580C; --rx-cyan: #06B6D4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2328; }
  .rx { border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background: #fff; }
  .rx-bar { height: 4px; background: linear-gradient(90deg, var(--rx-accent), var(--rx-cyan)); }
  .rx-title { padding: 12px 16px 0; font-size: 14px; font-weight: 600; }
  .rx-figure { padding: 12px 16px 0; }
  .rx-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  .rx-preview { display: block; width: 100%; height: auto; max-height: 70vh; object-fit: contain; border-radius: 8px; background: #f6f8fa; border: 1px solid #e5e7eb; }
  .rx-empty { margin: 12px 16px 0; padding: 22px; color: #6b7280; font-size: 14px; text-align: center; background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 8px; }
  .rx-note { padding: 10px 16px 0; font-size: 13px; color: #4b5563; }
  .rx-actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px 16px; align-items: center; }
  .rx-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; border: 1px solid transparent; cursor: pointer; }
  .rx-btn-primary { background: var(--rx-accent); color: #fff; }
  .rx-btn-ghost { background: #fff; color: #1f2328; border-color: #d0d7de; }
  .rx-meta { margin-left: auto; font-size: 12px; color: #6b7280; }
  @media (prefers-color-scheme: dark) {
    body { color: #e6edf3; }
    .rx { background: #161b22; border-color: #30363d; }
    .rx-preview { background: #0d1117; border-color: #30363d; }
    .rx-empty { background: #0d1117; border-color: #30363d; }
    .rx-btn-ghost { background: #161b22; color: #e6edf3; border-color: #30363d; }
  }
</style>
</head>
<body>
  <div class="rx">
    <div class="rx-bar"></div>
    <div id="rx-title-slot"></div>
    <div id="rx-figure-slot"></div>
    <div id="rx-note-slot"></div>
    <div class="rx-actions" id="rx-actions"></div>
  </div>
  <script>
    (function () {
      function safeUrl(u) {
        try { var p = new URL(u); return p.protocol === "https:" ? u : null; } catch (e) { return null; }
      }
      function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
      function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
      }
      function linkButton(label, href, cls, download) {
        var a = document.createElement("a");
        a.className = "rx-btn " + cls;
        a.textContent = label;
        a.setAttribute("href", href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
        if (download) a.setAttribute("download", "");
        return a;
      }
      function figure(url, label) {
        var wrap = el("div", "rx-figure");
        if (label) wrap.appendChild(el("div", "rx-label", label));
        var img = el("img", "rx-preview");
        img.alt = label || "Rendex render";
        img.onerror = function () {
          wrap.replaceWith(el("div", "rx-empty", "Preview unavailable — the link may have expired. Use the buttons below to open or download."));
        };
        img.setAttribute("src", url);
        wrap.appendChild(img);
        return wrap;
      }
      function render() {
        var out = (window.openai && window.openai.toolOutput) || {};
        var titleSlot = document.getElementById("rx-title-slot");
        var figSlot = document.getElementById("rx-figure-slot");
        var noteSlot = document.getElementById("rx-note-slot");
        var actions = document.getElementById("rx-actions");
        clear(titleSlot); clear(figSlot); clear(noteSlot); clear(actions);

        if (out.title) titleSlot.appendChild(el("div", "rx-title", String(out.title)));

        // Collect images: an explicit labeled set, else a single preview image.
        var imgs = [];
        if (Array.isArray(out.images)) {
          for (var i = 0; i < out.images.length; i++) {
            var it = out.images[i] || {};
            var u = safeUrl(it.url);
            if (u) imgs.push({ url: u, label: it.label ? String(it.label) : null });
          }
        }
        if (!imgs.length) {
          var single = safeUrl(out.imageUrl) || safeUrl(out.pngUrl);
          if (single) imgs.push({ url: single, label: null });
        }
        if (imgs.length) {
          for (var j = 0; j < imgs.length; j++) figSlot.appendChild(figure(imgs[j].url, imgs[j].label));
        } else {
          // No image. If we already have action links it's a real result (e.g.
          // pdf-only) → say it's ready. If we have NOTHING yet, the tool is still
          // running — the widget renders before toolOutput arrives, so don't claim
          // "ready" mid-call (it re-renders via openai:set_globals when done).
          var hasLinks = safeUrl(out.pdfUrl) || safeUrl(out.pngUrl) || safeUrl(out.shareUrl) || safeUrl(out.openUrl);
          figSlot.appendChild(
            el(
              "div",
              "rx-empty",
              hasLinks
                ? "Your render is ready. Use the buttons below to open or download it."
                : "Rendering… this usually takes a few seconds."
            )
          );
        }

        if (out.note) noteSlot.appendChild(el("div", "rx-note", String(out.note)));

        var pdf = safeUrl(out.pdfUrl);
        var png = safeUrl(out.pngUrl);
        var open = safeUrl(out.shareUrl) || safeUrl(out.openUrl);
        if (pdf) actions.appendChild(linkButton("Download PDF", pdf, "rx-btn-primary", true));
        if (png) actions.appendChild(linkButton("Download PNG", png, pdf ? "rx-btn-ghost" : "rx-btn-primary", true));
        if (open) actions.appendChild(linkButton(out.shareUrl ? "Open share page" : "Open", open, "rx-btn-ghost", false));

        if (out.expiresAt) {
          var when = new Date(out.expiresAt);
          actions.appendChild(el("span", "rx-meta", "Links expire " + (isNaN(when.getTime()) ? String(out.expiresAt) : when.toLocaleString())));
        }
        if (!actions.firstChild && imgs.length) {
          actions.appendChild(el("span", "rx-meta", "Rendered by Rendex"));
        }
      }
      render();
      window.addEventListener("openai:set_globals", render);
    })();
  </script>
</body>
</html>`;
