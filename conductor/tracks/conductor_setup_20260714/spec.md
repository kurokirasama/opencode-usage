# Specification: Initialize Conductor Framework

## Overview
Set up the complete Conductor framework environment for the OpenCode Quota Tracker project. Current state has core files (product.md, tech-stack.md, workflow.md, product-guidelines.md, index.md) but is missing the tracks registry, tracks directory, GEMINI.md files, longterm memory initialization, and the post-archive memory protocol.

## Functional Requirements

### FR1: Tracks Registry & Directory
- Create `conductor/tracks.md` as a bulleted list registry (starting with `# Project Tracks`) — NOT a Markdown table
- Create `conductor/tracks/` directory for future track storage

### FR2: GEMINI.md Files
- Create `conductor/GEMINI.md` with Source Control & Privacy mandates: the `private` branch is strictly local, never push `private` to any remote
- Create/update root `GEMINI.md` with context-mode routing rules from the initialize-conductor reference template, replacing or appending the `# context-mode — MANDATORY routing rules` section

### FR3: Longterm Memory Initialization
- Create `AGENTS_MEMORY/opencode_quota/` directory in Obsidian vault
- Create initial episodic memory index note with project metadata (name, path, tech stack summary, key contacts)
- Ensure the note follows the longterm-memory-writer conventions

### FR4: Post-Archive Memory Protocol
- Append to `conductor/workflow.md` the mandatory longterm memory update protocol: after archiving a track, the agent must follow this ordered sequence:
  1. Archive track
  2. Run `git-sync` skill
  3. Trigger `longterm-memory-orchestrator` (which invokes `longterm-memory-writer`)
  4. Attempt `write-trajectory-log` to record track completion, key decisions, outcomes, lessons learned

### FR5: Context-Mode Routing Integration
- Root `GEMINI.md` must include the full context-mode routing rules (blocked commands, redirect rules, tool selection hierarchy, etc.)

## Acceptance Criteria
- [ ] `conductor/tracks.md` exists as a bulleted list (not a Markdown table)
- [ ] `conductor/tracks/` directory exists
- [ ] `conductor/GEMINI.md` exists with Source Control & Privacy sections
- [ ] Root `GEMINI.md` exists with context-mode routing rules
- [ ] `AGENTS_MEMORY/opencode_quota/` contains an initial index note
- [ ] `conductor/workflow.md` contains the post-archive memory protocol
- [ ] All files committed with proper commit messages

## Out of Scope
- Full migration of existing tracks (there are none)
- Integration of MATLAB protocols (no `.m` files detected)
- Creation of `howto.md` (not applicable to this initialization track)
