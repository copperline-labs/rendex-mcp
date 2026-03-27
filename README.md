# @copperline/rendex-mcp

MCP server for [Rendex](https://rendex.dev) — capture screenshots of any webpage via AI agents using the Model Context Protocol.

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

Capture a screenshot of any webpage and return it as an image.

```
"Take a screenshot of https://example.com"
"Capture the full page of https://news.ycombinator.com in dark mode"
"Screenshot https://github.com at 1920x1080 in JPEG format"
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | Webpage URL to capture |
| `format` | `"png"` \| `"jpeg"` | `"png"` | Image format |
| `fullPage` | boolean | `false` | Capture full scrollable page |
| `darkMode` | boolean | `false` | Emulate dark color scheme |
| `width` | number | `1280` | Viewport width (320-3840) |
| `height` | number | `800` | Viewport height (240-2160) |
| `quality` | number | — | Image quality 1-100 (JPEG only) |
| `delay` | number | `0` | Wait ms before capture |
| `blockAds` | boolean | `true` | Block ads and trackers |
| `deviceScaleFactor` | number | `1` | Device pixel ratio (1-3) |

## Authentication

Get your API key at [rendex.dev](https://rendex.dev).

Set the `RENDEX_API_KEY` environment variable in your MCP client configuration.

## Pricing

| Plan | Calls/Month | Rate |
|------|------------|------|
| Free | 500 | 10/min |
| Starter | 10,000 | 60/min |
| Pro | 100,000 | 300/min |

## License

MIT — [Copperline Labs LLC](https://copperlinelabs.com)
