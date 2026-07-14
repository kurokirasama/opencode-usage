# OpenCode Usage Tracker Plugin

A standalone TypeScript plugin for OpenCode that adds a `/usage` command to display your API quota with ANSI-colored progress bars directly in the terminal.

## Features

- **Plan Autodetection** — discovers API keys from `~/.local/share/opencode/auth.json` (via `/connect`), the `OPENCODE_API_KEY` env var, or `~/.config/opencode/opencode.json` provider config
- **Rolling 5h bar** — current usage in the 5-hour window vs. your plan limit
- **Weekly bar** — weekly consumption vs. plan limit
- **Monthly bar** — monthly consumption vs. plan limit
- **Reset countdown** — time remaining until the next rolling window reset
- **Color-coded** — green (≤75%), yellow (75-95%), red (>95%)

## Install

```bash
cp usage.ts ~/.config/opencode/plugins/usage.ts
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
| "OpenCode config not found" | Ensure `~/.config/opencode/opencode.json` exists |
| "No OpenCode API key found" | Run `opencode auth login` or `/connect` to store keys. Alternatively set `OPENCODE_API_KEY` env var.
| "Failed to reach OpenCode API" | Check your internet connection |

## Development

No dependencies, no build step. The plugin is a single TypeScript file. OpenCode compiles it on startup.

```bash
# Run tests
npx tsx usage.test.ts
```
