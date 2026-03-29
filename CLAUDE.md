# Rendex MCP Server

**Package**: `@copperline/rendex-mcp`
**Parent**: Copperline Labs LLC
**Product**: Rendex (rendex.dev)

## Overview

MCP server that wraps the Rendex REST API for AI agent consumption. Pure HTTP client — all auth, billing, and rate limiting happen at the API layer (api.rendex.dev).

## Architecture

- `src/server.ts` — McpServer factory, registers tools
- `src/stdio.ts` — Entry point for stdio transport (npx usage)
- `src/remote.ts` — Entry point for Cloudflare Workers deployment
- `src/tools/screenshot.ts` — `rendex_screenshot` tool definition and handler
- `src/lib/client.ts` — HTTP client calling api.rendex.dev
- `src/lib/errors.ts` — REST error → MCP error translation

## Testing in Claude Code

1. Ensure `.mcp.json` exists at project root with a valid `RENDEX_API_KEY`
2. Run `bun run build` in this package to compile latest changes
3. Restart Claude Code session (MCP config is read at startup)
4. Test: "Take a screenshot of https://example.com"

The MCP server runs via stdio transport (`dist/stdio.js`).

## Development

```bash
bun run typecheck    # Type-check
bun run build        # Compile to dist/
bun run dev          # Watch mode
```

## Deployment

- **npm**: `npm publish` (publishes @copperline/rendex-mcp)
- **Remote**: `wrangler deploy` (deploys to mcp.rendex.dev)

## Tool Schema

The `rendex_screenshot` tool schema MUST match the landing page `mcp-section.tsx` component. If updating parameters here, update the landing page too.
