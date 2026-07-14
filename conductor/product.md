# Initial Concept
OpenCode Usage Tracker Plugin — a standalone, local TypeScript plugin for the OpenCode AI agent that implements a custom `/usage` command to fetch and display the user's API quota (rolling 5h, weekly, monthly) with ANSI-colored ASCII progress bars in the terminal.

---

## Target Users
Individual OpenCode users who want to monitor their API quota consumption without leaving the terminal or visiting the web dashboard.

## Goals
- **Quota Awareness:** Display remaining quota at a glance via a simple `/usage` command.

## Key Features
1. **Plan Autodetection:** Scans `~/.config/opencode/opencode.json` to detect active `opencode-go` or `opencode-zen` providers and extracts their API keys automatically.
2. **Rolling 5-Hour Usage Bar:** Shows current usage within the 5-hour window vs. the limit (e.g., $12 for Go).
3. **Weekly Usage Bar:** Shows weekly consumption vs. the plan limit (e.g., $30 for Go).
4. **Monthly Usage Bar:** Shows monthly consumption vs. the plan limit (e.g., $60 for Go).
5. **Reset Countdown:** Displays the time remaining until the next rolling window reset.

## Constraints & Non-Functional Requirements
1. **Single File Deployment:** Must be a single `.ts` file dropped into `~/.config/opencode/plugins/usage.ts`.
2. **Zero External Dependencies:** Uses only Node.js built-ins (`fs`, `fetch`). No npm packages required beyond the OpenCode plugin SDK.
3. **ANSI Color Support:** Progress bars use green (≤75%), yellow (75-95%), and red (>95%) with standard ANSI escape codes.
4. **Graceful Error Handling:** Handles missing config files, network failures, and unknown API response schemas without crashing.

## Architecture
- **Framework:** `@opencode-ai/plugin`
- **Language:** TypeScript
- **Runtime:** Bun/Node.js (via OpenCode's plugin loader)
- **API:** Internal OpenCode workspace usage endpoint (`https://opencode.ai/api/workspace/<workspace_id>/usage`)
