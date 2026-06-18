# @copperline/rendex-mcp

[![npm version](https://img.shields.io/npm/v/@copperline/rendex-mcp)](https://www.npmjs.com/package/@copperline/rendex-mcp)
[![npm downloads](https://img.shields.io/npm/dw/@copperline/rendex-mcp)](https://www.npmjs.com/package/@copperline/rendex-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Badge](https://lobehub.com/badge/mcp/copperline-labs-rendex-mcp)](https://lobehub.com/mcp/copperline-labs-rendex-mcp)

MCP server for [Rendex](https://rendex.dev) — render raw HTML, Markdown, or any URL to an image or PDF via AI agents using the Model Context Protocol.

## Quick Start

### Claude Desktop / Cursor / Windsurf (npx)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "rendex": {
      "command": "npx",
      "args": ["-y", "@copperline/rendex-mcp"],
      "env": {
        "RENDEX_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Where to add this:**

| Client | Config location |
|--------|----------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |
| Cursor | `.cursor/mcp.json` in project root, or Settings > MCP |
| Windsurf | Settings > MCP Servers |

### Claude Code (CLI)

Add a `.mcp.json` to your project root with the same config above. Then restart Claude Code.

> **Important**: Add `.mcp.json` to your `.gitignore` — it contains your API key.

### Remote (zero-install)

Connect directly — no installation needed (Claude Desktop only):

```json
{
  "mcpServers": {
    "rendex": {
      "url": "https://mcp.rendex.dev/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

## Tools

### `rendex_screenshot`

Render any webpage, raw HTML, or Markdown to an image or PDF.

```
"Take a screenshot of https://example.com"
"Capture the full page of https://news.ycombinator.com in dark mode"
"Generate a PDF of https://github.com with A4 page size"
"Capture https://amazon.de as seen from Germany"
"Render this HTML invoice as a PDF"
"Render this Markdown release note as a PDF"
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required* | Webpage URL to capture. Mutually exclusive with `html` and `markdown`. |
| `html` | string | — | Raw HTML to render. Mutually exclusive with `url` and `markdown`. |
| `markdown` | string | — | Markdown to render (server converts to HTML). Mutually exclusive with `url` and `html`. |
| `data` | object | — | Key-value data for Mustache templating. When set, the `html` or `markdown` string is rendered as a logic-less Mustache template before capture. Invalid with `url`. |
| `format` | `"png"` \| `"jpeg"` \| `"webp"` \| `"pdf"` | `"png"` | Output format |
| `fullPage` | boolean | `false` | Capture full scrollable page |
| `darkMode` | boolean | `false` | Emulate dark color scheme |
| `width` | number | `1280` | Viewport width (320-3840) |
| `height` | number | `800` | Viewport height (240-2160) |
| `resizeWidth` | number | — | Downscale output to this width in px (aspect ratio preserved if `resizeHeight` omitted). Ignored for PDF |
| `resizeHeight` | number | — | Downscale output to this height in px (aspect ratio preserved if `resizeWidth` omitted). Ignored for PDF |
| `quality` | number | `80` | Image quality 1-100 (JPEG/WebP only, default 80) |
| `delay` | number | `0` | Wait ms before capture |
| `blockAds` | boolean | `true` | Block ads and trackers |
| `blockCookieBanners` | boolean | — | Hide common cookie/consent banners (GDPR/CCPA) before capture |
| `blockResourceTypes` | string[] | — | Block resource types: `font`, `image`, `media`, `stylesheet`, `other` |
| `device` | string | — | Device preset: `desktop`, `iphone_15`, `iphone_se`, `pixel_8`, `ipad`, `ipad_pro` — sets viewport, scale, and user agent in one shot. Overrides `width`/`height`/`deviceScaleFactor`/`userAgent` |
| `deviceScaleFactor` | number | `2` | Device pixel ratio (1-3). 2× Retina by default |
| `timeout` | number | `30` | Max seconds to wait for page load (5-60) |
| `waitUntil` | string | `"networkidle2"` | Page readiness: `load`, `domcontentloaded`, `networkidle0`, `networkidle2` |
| `waitForSelector` | string | — | CSS selector to wait for before capture |
| `bestAttempt` | boolean | `true` | Return partial render on timeout instead of failing |
| `selector` | string | — | CSS selector of element to capture instead of full page |
| `hideSelectors` | string[] | — | CSS selectors to hide (`display:none`) before capture, e.g. `['.modal', '#newsletter-popup']`. Max 50 |
| `css` | string | — | Custom CSS to inject before capture (max 50KB) |
| `js` | string | — | Custom JavaScript to execute before capture (max 50KB) |
| `cookies` | array | — | Cookies to set for authenticated captures (max 50) |
| `headers` | object | — | Custom HTTP headers for the page request |
| `userAgent` | string | — | Override browser user agent string |
| `pdfFormat` | string | — | PDF page size: `A4`, `Letter`, `Legal`, `Tabloid`, `A3` |
| `pdfLandscape` | boolean | — | PDF landscape orientation |
| `pdfPrintBackground` | boolean | `true` | Print background in PDF |
| `pdfScale` | number | `1` | PDF scale factor (0.1-2) |
| `pdfMargin` | object | — | PDF margins: `{top, right, bottom, left}` as CSS values |
| `geo` | string | — | ISO country code for geo-targeted capture (Pro/Enterprise) |
| `geoCity` | string | — | City for geo-targeting (requires `geo`) |
| `geoState` | string | — | State for geo-targeting (requires `geo`) |
| `async` | boolean | — | Process asynchronously (returns job ID) |
| `webhookUrl` | string | — | URL to receive callback when async capture completes |
| `cacheTtl` | number | — | Seconds to cache result (3600-2592000) |

### `rendex_extract`

Extract clean reader-mode content from any webpage as Markdown, JSON, or HTML. Runs the same Chromium render pass as a screenshot, so it captures content **after JavaScript runs** — handling SPAs that fetch-only readers miss. Strips nav, ads, and boilerplate, returning the article body plus title, byline, and excerpt. Great for feeding page content to an LLM, summarization, or RAG ingestion.

```
"Extract the article text from https://example.com/post as Markdown"
"Pull the readable content from this SPA as JSON so I can summarize it"
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Webpage URL to extract readable content from |
| `extractFormat` | `"markdown"` \| `"json"` \| `"html"` | `"markdown"` | Output shape — `markdown` (LLM-friendly prose), `json` (structured: title/byline/excerpt/siteName/length), or `html` (cleaned reader-mode HTML) |
| `device` | string | — | Device preset (`desktop`, `iphone_15`, `iphone_se`, `pixel_8`, `ipad`, `ipad_pro`) — extract the mobile/tablet version of a page |
| `blockAds` | boolean | `true` | Block ads and trackers before extraction |
| `blockCookieBanners` | boolean | — | Hide common cookie/consent walls before extraction |
| `hideSelectors` | string[] | — | CSS selectors to hide before extraction, e.g. `['.modal', '#newsletter-popup']`. Max 50 |
| `waitUntil` | string | `"networkidle2"` | Page readiness: `load`, `domcontentloaded`, `networkidle0`, `networkidle2` |
| `timeout` | number | `30` | Max seconds to wait for page load (5-60) |

### Rendex Watch

Monitor a URL on a schedule and get notified when it changes — real-Chrome **visual diff** (with a highlighted overlay), an extracted-**text** diff, or **both**. Seven tools let an agent set up, inspect, and tear down watches on the shared Rendex platform (one `rdx_` key, one credit pool).

```
"Watch https://example.com/pricing for visual changes and alert my webhook"
"Before I save it, test whether you can capture #pricing on that page"
"Show me the last few runs of watch <id> — did anything change?"
```

| Tool | Purpose | Key inputs |
|------|---------|-----------|
| `watch_create` | Create a watch (active → captures its baseline now) | `url`, `name?`, `intervalMinutes?`, `diffMode?` (visual/text/both), `threshold?`, `renderParams?`, `webhookUrl?` (Starter+), `notifyEmail?`, `paused?` |
| `watch_test` | Dry-run a config first (creates nothing) | same as `watch_create` |
| `watch_list` | List your watches | `status?` (active/paused/all), `cursor?`, `limit?` |
| `watch_get` | Fetch one watch (+ baseline URL) | `id` |
| `watch_run` | Run a check now (1 credit) | `id` |
| `watch_runs` | Run history with signed before/after/overlay URLs | `id`, `cursor?`, `limit?` |
| `watch_delete` | Delete a watch + its runs | `id` |

`renderParams` carries the per-check capture knobs (`fullPage` defaults to **true**, `selector`, `device`, `geo` (Pro+), plus noise controls `ignoreRegions`/`ignoreText`/`minTextChars`/`suppressWhilePresent` and `uaMode`). Interval floors are per-plan (Free 1440 / Starter 180 / Pro 30 / Enterprise 5). Watch metadata + signed image URLs are returned as JSON text.

## Data templating

Turn one reusable template into many documents. Pass a `data` object alongside `html`
or `markdown`, and Rendex renders the string as a logic-less [Mustache](https://mustache.github.io/)
template before capture — `{{var}}` interpolation, `{{#items}}…{{/items}}` loops, and
nested `{{a.b}}` access. Great for invoices, reports, certificates, and OG cards.

```
"Render this HTML invoice template to a PDF, filling it with this data:
 <h1>Invoice {{number}}</h1><p>Total: {{total}}</p>
 data = { number: 'INV-014', total: '$2,400' }"
```

`data` is valid only with `html` or `markdown` — combining it with `url` returns a
validation error.

## Authentication

Get your API key at [rendex.dev](https://rendex.dev).

Set the `RENDEX_API_KEY` environment variable in your MCP client configuration.

## Pricing

| Plan | Calls/Month | Rate |
|------|------------|------|
| Free | 500 | 10/min |
| Starter | 10,000 | 60/min |
| Pro | 100,000 | 300/min |
| Enterprise | Custom | 1,000/min |

## License

MIT — [Copperline Labs LLC](https://copperlinelabs.com)
