# Implementation Plan: Initialize Conductor Framework

## Phase 1: Discovery & Context Loading

- [ ] Task: Activate required skills (conductor-core-protocols, obsidian-memory-expert, context-expert, longterm-memory-orchestrator)
- [ ] Task: Retrieve Conductor-related guidelines and best practices from Obsidian Knowledge Graph
    - [ ] Search for Conductor best practices, initialization patterns, and framework guidelines
    - [ ] Search for any prior opencode_quota project memories
- [ ] Task: Audit current workspace state
    - [ ] Verify all existing conductor files (product.md, tech-stack.md, workflow.md, product-guidelines.md, index.md)
    - [ ] Verify git branch and remote status
    - [ ] Confirm Obsidian vault path for AGENTS_MEMORY
- [ ] Task: Conductor - User Manual Verification 'Discovery & Context Loading' (Protocol in workflow.md)

## Phase 2: Core File Creation & Update

- [ ] Task: Create tracks registry and directory
    - [ ] Create `conductor/tracks/` directory
    - [ ] Create `conductor/tracks.md` as a bulleted list (starting with `# Project Tracks`), NOT a Markdown table
- [ ] Task: Create `conductor/GEMINI.md` with Source Control & Privacy mandates
    - [ ] Document branch isolation: `private` branch is strictly local
    - [ ] Document no-push rule: never push `private` to any remote
    - [ ] Document synchronization rules for `git-sync` protocol
- [ ] Task: Create/update root `GEMINI.md` with context-mode routing rules
    - [ ] Read context-mode-rules.md reference template
    - [ ] Check if root `GEMINI.md` already exists
    - [ ] If exists: replace the `# context-mode` section; if not: append the full rules
- [ ] Task: Initialize longterm memory in Obsidian
    - [ ] Create `AGENTS_MEMORY/opencode_quota/` directory
    - [ ] Create initial episodic memory index note with project metadata
- [ ] Task: Update `conductor/workflow.md` with post-archive memory protocol
    - [ ] Append the ordered protocol: archive → git-sync → longterm-memory-orchestrator → longterm-memory-writer → trajectory-log
- [ ] Task: Conductor - User Manual Verification 'Core File Creation & Update' (Protocol in workflow.md)

## Phase 3: Synchronization & Finalization

- [ ] Task: Verify all created files against acceptance criteria
    - [ ] Confirm `conductor/tracks.md` is bulleted list format
    - [ ] Confirm `conductor/GEMINI.md` has Source Control & Privacy sections
    - [ ] Confirm root `GEMINI.md` has context-mode routing rules
    - [ ] Confirm `AGENTS_MEMORY/opencode_quota/` has index note
    - [ ] Confirm `conductor/workflow.md` has post-archive memory protocol
- [ ] Task: Register this track in `conductor/tracks.md`
- [ ] Task: Commit all changes with proper commit messages
- [ ] Task: Conductor - User Manual Verification 'Synchronization & Finalization' (Protocol in workflow.md)
