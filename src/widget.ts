// ─── ChatGPT Apps preview widget (bundled string) ───────────────────
// The render_artifact preview component, inlined as a string so it ships in the
// Worker bundle (a .html text-import would break the stdio/npm build, which
// shares server.ts). Mirrors widget/artifact-preview.html — keep them in sync.
//
// Registered as an MCP UI resource (mimeType "text/html+skybridge") and
// referenced from render_artifact's _meta["openai/outputTemplate"], so ChatGPT
// renders it inline after a render_artifact call. It reads
// window.openai.toolOutput = { pdfUrl?, pngUrl?, shareUrl, expiresAt } and shows
// the PNG preview + Download PDF/PNG + Open-share buttons (safe DOM, https-only
// sinks, no innerHTML).

export const WIDGET_URI = "ui://widget/artifact-preview.html";
export const WIDGET_MIME = "text/html+skybridge";

export const ARTIFACT_WIDGET_HTML = `<!DOCTYPE html>
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
  .rx-preview { display: block; width: 100%; height: auto; background: #f6f8fa; border-bottom: 1px solid #e5e7eb; }
  .rx-empty { padding: 28px; color: #6b7280; font-size: 14px; text-align: center; }
  .rx-actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px 16px; align-items: center; }
  .rx-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; text-decoration: none; border: 1px solid transparent; cursor: pointer; }
  .rx-btn-primary { background: var(--rx-accent); color: #fff; }
  .rx-btn-ghost { background: #fff; color: #1f2328; border-color: #d0d7de; }
  .rx-meta { margin-left: auto; font-size: 12px; color: #6b7280; }
  @media (prefers-color-scheme: dark) {
    body { color: #e6edf3; }
    .rx { background: #161b22; border-color: #30363d; }
    .rx-preview { background: #0d1117; border-bottom-color: #30363d; }
    .rx-btn-ghost { background: #161b22; color: #e6edf3; border-color: #30363d; }
  }
</style>
</head>
<body>
  <div class="rx">
    <div class="rx-bar"></div>
    <div id="rx-preview-slot"></div>
    <div class="rx-actions" id="rx-actions"></div>
  </div>
  <script>
    (function () {
      function safeUrl(u) {
        try { var p = new URL(u); return p.protocol === "https:" ? u : null; } catch (e) { return null; }
      }
      function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
      function linkButton(label, href, cls) {
        var a = document.createElement("a");
        a.className = "rx-btn " + cls;
        a.textContent = label;
        a.setAttribute("href", href);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
        return a;
      }
      function render() {
        var out = (window.openai && window.openai.toolOutput) || {};
        var png = safeUrl(out.pngUrl);
        var pdf = safeUrl(out.pdfUrl);
        var share = safeUrl(out.shareUrl);
        var slot = document.getElementById("rx-preview-slot");
        var actions = document.getElementById("rx-actions");
        clear(slot); clear(actions);
        if (png) {
          var img = document.createElement("img");
          img.className = "rx-preview";
          img.alt = "Rendered artifact";
          img.setAttribute("src", png);
          slot.appendChild(img);
        } else {
          var empty = document.createElement("div");
          empty.className = "rx-empty";
          empty.textContent = "Your artifact is ready. Use the buttons below to open or download it.";
          slot.appendChild(empty);
        }
        if (pdf) { var b1 = linkButton("Download PDF", pdf, "rx-btn-primary"); b1.setAttribute("download", ""); actions.appendChild(b1); }
        if (png) { var b2 = linkButton("Download PNG", png, "rx-btn-ghost"); b2.setAttribute("download", ""); actions.appendChild(b2); }
        if (share) { actions.appendChild(linkButton("Open share page", share, "rx-btn-ghost")); }
        if (out.expiresAt) {
          var when = new Date(out.expiresAt);
          var meta = document.createElement("span");
          meta.className = "rx-meta";
          meta.textContent = "Links expire " + (isNaN(when.getTime()) ? String(out.expiresAt) : when.toLocaleString());
          actions.appendChild(meta);
        }
        if (!actions.firstChild) {
          var none = document.createElement("span");
          none.className = "rx-meta";
          none.textContent = "No artifact links returned.";
          actions.appendChild(none);
        }
      }
      render();
      window.addEventListener("openai:set_globals", render);
    })();
  </script>
</body>
</html>`;
