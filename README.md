# OpenCode Usage Tracker Plugin

A standalone TypeScript plugin for OpenCode that adds a `/usage` command to display your API quota with ANSI-colored progress bars directly in the terminal.

## Features

- **Local SQLite Database** — reads usage directly from `~/.local/share/opencode/opencode.db` (no API calls, no scraping)
- **Rolling 5h bar** — current cost within the 5-hour window vs. $12 Go limit
- **Weekly bar** — weekly cost vs. $30 Go limit
- **Monthly bar** — monthly cost vs. $60 Go limit
- **Reset countdown** — time until oldest session in the rolling window expires
- **Color-coded** — green (≤75%), yellow (75-95%), red (>95%)

## Install

```bash
cp usage.ts usage-plugin.ts ~/.config/opencode/plugins/
```

Restart OpenCode. The plugin loads automatically.

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
| "OpenCode database not found" | Ensure OpenCode has been launched at least once (creates `opencode.db`) |
| All bars show $0.00 | Run some sessions with OpenCode Go — usage data comes from session history |

## Development

No dependencies, no build step.

- `usage.ts` — core logic (config parsing, API fetch, progress bar rendering). Zero external deps, fully testable outside OpenCode.
- `usage-plugin.ts` — thin plugin wrapper. Imports `@opencode-ai/plugin` (available via OpenCode's runtime) and registers the `usage` custom tool.

```bash
# Run tests
npx tsx usage.test.ts
```
