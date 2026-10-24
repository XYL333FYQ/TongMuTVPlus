# Compact Home Activity Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user approved the layout sketch and explicitly asked to implement it in the current preview checkout; no additional approval, Git changes, dependencies, or worktree migration.

**Goal:** Replace two sparse full-width homepage shelves with a compact personal activity area that collapses when empty.

**Architecture:** Keep ContinueWatching's existing record loading, subscription, full-history panel, and VideoCard activation. Add a presentation-only compact VideoCard mode. HomeRooms retains its GET request, polling, abort, current-room priority, and original destinations, while presenting one room. The existing tm-home-pair adapts to rendered child sections through scoped CSS; empty creation guidance appears only beside existing personal content.

**Tech Stack:** Next.js 14, React 18, existing lucide-react, CSS tokens; no new dependency.

**Spec:** User-approved in-conversation sketch compact-home-activity.html; docs/design/DESIGN.md current amendments.

## Global Constraints

- Current dirty checkout and accepted Hero changes are preserved. Batch backup/hash baseline: output/compact-home-20261021/.
- No protected source, API, storage key, Socket event, database, playback session, dependency, Git commit/push, or deployment changes.
- Colors use --tm-\* tokens, text at least 12px, touch targets at least 44px, focus-visible rings; honor reduced motion and no blur.
- One author; shut down the confirmed preview before checks and restart only after type/tests complete.

## Review Focus

- Multiple records: latest save_time is the only homepage item; full history remains reachable; deletion/subscription promotes the next record.
- Record progress: negative, over-complete, and unknown duration remain clamped; live entries are not described by invented progress.
- Current room appears before fetched memberships; other rooms remain reachable through management, with no duplicate current room.
- Loading, failed refresh, disabled service, and guest privacy are distinct from a successful empty response.
- Parent collapse, long names, keyboard activation, mobile stacking, themes, and first movie section spacing require actual browser checks.

### Task 1: Compact records and rooms

**Files:** ContinueWatching.tsx; VideoCard.tsx; catalog/HomeRooms.tsx; ContinueWatching.compact.test.tsx (includes the real VideoCard integration tests); ContinueWatching.progress.test.tsx; catalog/HomeRooms.test.tsx.

- [x] Add failing tests for recent-only homepage, update promotion/full-history access, compact card original activation, and rooms' empty/loading/failure/current priority.
- [x] Observe expected failures with targeted Jest, before production edits.
- [x] Add compact presentation and keep non-home record rendering unchanged; show latest record, current/first membership, and small empty-room creation shortcut.
- [x] Run targeted tests, then the full required validation batch. Final ordinary Jest hit native runtime crashes; the identical full suite passed using the interpreter runtime, as recorded in PROGRESS.md and acceptance.txt.

### Task 2: Responsive integration and acceptance

**Files:** src/styles/home.css; docs/design/DESIGN.md; docs/design/PROGRESS.md.

- [x] Adapt existing pair to desktop columns, stacked mobile rows, and zero height when both data sources are empty; use 24–32px Hero spacing, compact 16:9 thumbnail, inline metadata, 44px action indicator, small room avatar, and modest hover/press feedback.
- [x] Preserve full history / management entry points and render actual loading/error states without large placeholders.
- [x] Update design/progress and run pnpm typecheck, lint, test --runInBand, format:check, test:rooms; scoped format/lint/design/diff checks and backup-suffix audit.
- [x] Read-only independent final review against this batch's .bak files and hash baseline; resolve the three findings.
- [x] Start one project preview; verify real history/room links, real-card resume/keyboard destinations in integration tests, four content layouts (actual guest empty plus isolated DOM fixtures), 390/820/1280 dark/light plus 1440x900, keyboard focus, hover, reduced motion, no horizontal overflow, and console errors. No user records or rooms erased.
- [x] Save screenshots/logs/scope evidence; record limitations and final preview state in PROGRESS.md.

No commit step: the user has not requested one. The user's approved design and instruction to implement are the authorization to proceed inline.
