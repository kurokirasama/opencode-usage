# Conductor Source Control & Privacy

## Branch Isolation

- **`private` branch is strictly local.** It contains project tracking data, design drafts, and user-specific memory.
- **MANDATORY: NEVER push the `private` branch to any remote** (`origin`, `upstream`, etc.).

## Synchronization Rules

- The `git-sync` protocol MUST only be applied to public/shared branches (e.g., `master`, `main`).
- If working on the `private` branch, perform commits but **HALT before any push command**.
- After archiving or deleting a track, run `git-sync` only on public branches.

## Private Conductor Directory

- The `conductor/` directory contains internal planning, specifications, and metadata.
- In public repositories, ensure `conductor/` is in `.gitignore` and NEVER force-stage it.
- Changes to `conductor/` should remain local-only or be managed in a dedicated private branch.
