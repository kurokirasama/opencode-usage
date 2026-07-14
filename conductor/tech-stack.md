# Technology Stack

## Language
- **TypeScript** — Strongly typed superset of JavaScript. Provides type safety and better editor tooling.

## Runtime
- **Node.js 18+** — Chosen for its wide availability and built-in `fetch` API (no need for `node-fetch`). OpenCode plugins run in the Node.js-compatible environment provided by the OpenCode runtime.

## Framework & Libraries
- **Built-in Node.js APIs only** — `fs` for reading config files, `fetch` for API calls. No external npm dependencies.
- **@opencode-ai/plugin** — Consider importing the SDK types ONLY if they provide meaningful type safety for plugin hooks. Otherwise, use inline type declarations to keep the file fully self-contained.

## Package Manager
- **None** — The plugin is a single `.ts` file. No `package.json`, no `node_modules`. OpenCode handles TypeScript compilation on startup.

## Development Tooling
- **None required** — TypeScript compilation is handled by OpenCode's built-in plugin loader. No build step, no bundler, no linter configuration needed at this stage.
