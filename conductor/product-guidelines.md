# Product Guidelines

## Tone & Voice
- **Concise & Technical:** Output is minimal and data-dense. No pleasantries, no filler. Each progress bar is labeled clearly with the metric name and percentage.

## Visual Style
- **Unicode-Rich Rendering:** Progress bars use Unicode block elements (e.g., `█`, `▌`, `▎`) for smooth, high-resolution fills rather than coarse ASCII. Box-drawing characters for borders where appropriate.
- **ANSI Color Thresholds:**
  - Green (`\x1b[32m`): ≤75% consumed
  - Yellow (`\x1b[33m`): 75–95% consumed
  - Red (`\x1b[31m`): >95% consumed
- **Fixed Width:** All progress bars rendered at a consistent width (30 chars) for clean alignment.

## UX Principles
- **Zero Configuration:** The plugin works immediately after being placed in the plugins directory. It auto-detects plans and API keys from the OpenCode config file.
- **Fail Gracefully:** Network errors, missing config, or unexpected API responses produce clear, short error messages. The plugin never crashes the OpenCode TUI.
- **Fast & Responsive:** The `/usage` command completes in under 2 seconds under normal network conditions. A timeout of 5 seconds prevents hangs.
- **Keyboard-Driven:** Triggered solely by typing `/usage` in the OpenCode prompt. No mouse interaction, no menus.

## Code Style
- **Self-Documenting Code:** Functions and variables use clear, descriptive names. Avoid redundant comments — the code should read like prose.
- **Inline Usage Hints:** If the user types `/usage --help` or `/usage -h`, display a short reference of available flags and expected output format.

## Naming Conventions
- TypeScript files use `camelCase` for variables/functions, `PascalCase` for types/interfaces.
- Plugin entry file: `usage.ts`
- Internal helper functions prefixed by context (e.g., `fetchUsageStats`, `renderProgressBar`).
