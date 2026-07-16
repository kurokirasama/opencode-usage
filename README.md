# OpenCode Usage Tracker Plugin

A standalone TypeScript plugin for OpenCode that adds a `/usage` command to display your API quota with ANSI-colored progress bars directly in the terminal.

## Features

- **Dual-mode** — scraper (exact billing data from web dashboard) with automatic SQLite fallback
- **Rolling 5h bar** — current cost within the 5-hour window vs. $12 Go limit
- **Weekly bar** — weekly cost vs. $30 Go limit
- **Monthly bar** — monthly cost vs. $60 Go limit
- **Reset countdown** — time until next rolling window reset
- **Color-coded** — green (≤75%), yellow (75-95%), red (>95%)

## Install

```bash
cp usage.ts usage-plugin.ts ~/.config/opencode/plugins/ -f
```

### Credentials (Scraper Mode)

For exact billing data, set either:

**How to get your session cookie:**

1. Open https://opencode.ai/workspace/<your-workspace-id>/go in your browser
2. Open DevTools (F12) → Application tab → Cookies → `opencode.ai`
3. Copy the value of the `auth` cookie
4. Copy your workspace ID from the URL or from the `sans` body parameter (`wrk_...`)

**Option 1 — Environment variables:**
```bash
export OPENCODE_GO_WORKSPACE_ID="wrk_..."
export OPENCODE_GO_AUTH_COOKIE="your-session-cookie"
```

**Option 2 — Config file** (`~/.config/opencode/opencode.json`):
```json
{
  "opencode-go-quota": {
    "workspaceId": "wrk_...",
    "authCookie": "your-session-cookie"
  }
}
```

**Option 3 — Dedicated file** (`~/.config/opencode/opencode-quota/opencode-go.json`):
```json
{
  "workspaceId": "wrk_...",
  "authCookie": "your-session-cookie"
}
```

If no scraper credentials are found, the plugin falls back to the local SQLite database automatically.

## Usage

Type `/usage` in OpenCode, or ask the agent:

> "Show me my usage"

Example output:

```
OpenCode API Usage
──────────────────
Rolling 5h: [████████████░░░░░░░░░░] $6.84 / $12.00 (57%)
Weekly:     [████░░░░░░░░░░░░░░░░░░] $8.20 / $30.00 (27%)
Monthly:    [████░░░░░░░░░░░░░░░░░░] $8.20 / $60.00 (14%)
──────────────────
Resets in 3h 42m
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No workspace credentials found" | Scraper mode needs `workspaceId` + `authCookie` — see Install section. Falls back to SQLite. |
| "Scraper error 401" | Your session cookie expired. Get a fresh one from the browser. |
| "OpenCode local database not found" | Ensure OpenCode has been launched at least once (creates `opencode.db`). |
| All bars show $0.00 | No recent sessions in the DB, or no dashboard data available. |

## Development

No dependencies, no build step.

- `usage.ts` — core logic (scraper, SQLite fallback, config parsing, rendering). Zero external deps, uses `node:sqlite` or `bun:sqlite` for DB access.
- `usage-plugin.ts` — thin plugin wrapper. Imports `@opencode-ai/plugin` (available via OpenCode's runtime) and registers the `usage` custom tool.

```bash
# Run tests
npx tsx usage.test.ts
```
