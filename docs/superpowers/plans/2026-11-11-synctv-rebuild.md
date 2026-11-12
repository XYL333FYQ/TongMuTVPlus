# SyncTV room rebuild implementation plan

Goal: execute the user-approved six-batch plan, preserving site identity, solo playback, current design and routes.
Spec: user implementation request dated 2026-11-11; docs/design/SYNCTV-REFACTOR-EXECUTION.md; docs/superpowers/specs/2026-11-10-viewing-room-refactor-design.md.
The user explicitly authorizes changes to room backend, authentication bridges, playback logic and the minimal protobuf dependencies. This supersedes the older skin-only restrictions for this scope. No commits, pushes or deployment.

- [x] Batch 1: pinned services/protocol; encrypted per-account identities; per-site-device sessions; authenticated HTTP/WS bridge; default legacy mode.
- [ ] Batch 2: same-origin per-member media gateway; MP4 Range, HLS segments, subtitle and expired source resolution.
- [ ] Batch 3: PlaybackPort and SyncTV adapter; remove old room rules from solo playback while preserving global player lifecycle.
- [ ] Batch 4: site-style rooms, entry flows, permissions, queue, messages, covers (custom > current poster > placeholder), upstream browser features.
- [ ] Batch 5: migrate music/live/screen/voice; release resources and preserve media audio focus.
- [ ] Batch 6: archive old data without importing it; freeze old writes and retire old runtime only after all acceptance gates pass.

Each batch: focused failing behavioral tests, implementation, typecheck/lint/Jest/format/room tests; browser and real-media acceptance when behavior becomes reachable. Update ledger and PROGRESS. No old/new playback controllers active concurrently.
