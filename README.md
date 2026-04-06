# @copperline/rendex-mcp

[![npm version](https://img.shields.io/npm/v/@copperline/rendex-mcp)](https://www.npmjs.com/package/@copperline/rendex-mcp)
[![npm downloads](https://img.shields.io/npm/dw/@copperline/rendex-mcp)](https://www.npmjs.com/package/@copperline/rendex-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

MCP server for [Rendex](https://rendex.dev) — capture screenshots and PDFs of any webpage via AI agents using the Model Context Protocol.

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

Capture a screenshot or PDF of any webpage or raw HTML.

```
"Take a screenshot of https://example.com"
"Capture the full page of https://news.ycombinator.com in dark mode"
"Generate a PDF of https://github.com with A4 page size"
"Capture https://amazon.de as seen from Germany"
"Render this HTML invoice as a PDF"
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required* | Webpage URL to capture. Mutually exclusive with `html`. |
| `html` | string | — | Raw HTML to render. Mutually exclusive with `url`. |
| `format` | `"png"` \| `"jpeg"` \| `"webp"` \| `"pdf"` | `"png"` | Output format |
| `fullPage` | boolean | `false` | Capture full scrollable page |
| `darkMode` | boolean | `false` | Emulate dark color scheme |
| `width` | number | `1280` | Viewport width (320-3840) |
| `height` | number | `800` | Viewport height (240-2160) |
| `quality` | number | — | Image quality 1-100 (JPEG/WebP only) |
| `delay` | number | `0` | Wait ms before capture |
| `blockAds` | boolean | `true` | Block ads and trackers |
| `blockResourceTypes` | string[] | — | Block resource types: `font`, `image`, `media`, `stylesheet` |
| `deviceScaleFactor` | number | `1` | Device pixel ratio (1-3) |
| `timeout` | number | `30` | Max seconds to wait for page load (5-60) |
| `waitUntil` | string | `"networkidle2"` | Page readiness: `load`, `domcontentloaded`, `networkidle0`, `networkidle2` |
| `waitForSelector` | string | — | CSS selector to wait for before capture |
| `bestAttempt` | boolean | `true` | Return partial render on timeout instead of failing |
| `selector` | string | — | CSS selector of element to capture instead of full page |
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
