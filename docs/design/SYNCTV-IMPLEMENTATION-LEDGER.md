# SyncTV implementation ledger

2026-11-11. Active workspace: C:/Users/ss/.codex/worktrees/synctv-rebuild/TongMuTVPlus (managed isolated worktree, detached HEAD).
Original workspace remains intact; only task design records copied. CLIENT-EXPERIENCE-STATUS.md was not copied or modified.
Authorization: implement all six batches continuously; archive old room data, fresh new rooms; migrate all associated activities; use existing site login; minimal protobuf dependencies approved.

Ruling: use existing Next 15.5 / TypeScript 5.6 package baseline rather than old AGENTS version prose. No framework changes.
Ruling: keep bridge identities and encrypted upstream sessions in a separate together database under the existing persistent data directory; do not alter the site's existing database path. Bind to account creation incarnation and revoke at account deletion so reused usernames cannot inherit identities.
Ruling: preserve legacy runtime as default until final retirement gates; no production changes.

Batch 1 in progress:

- Clean managed checkout dependencies installed from cached lockfile.
- protobufjs 7.6.6 added; protobufjs-cli 1.3.3 installation in progress.
- Added TogetherStore tests and implementation. Observed RED (missing implementation), then 4/4 Node tests GREEN: durable encrypted identities; recreated account isolation; independent device revocation; expired session/wrong-key rejection.
- No HTTP/WS bridge or product entry is connected yet.
- Store and tests are server/together/store.cjs and store.test.cjs.
- Native SQLite dependency verified on Node 24.
- Full batch verification and real upstream identity tests are still required before batch 2.

Next: finish protocol generation and upstream client/session service, site principal validation, per-device logout/account disable hooks, mode configuration, same-origin HTTP/WS routing and pinned Compose services.

Implementation update 2026-11-11:

- Both approved protobuf dependencies installed at exact versions.
- Generated 326 realtime message/enum types from fixed official sources; preserved OPAQUE WASM and license with SHA-256 manifest.
- Core Node tests now cover store, bridge, upstream client, protocol, mode configuration, principal revalidation, one-use room/browser ticket binding and persistent runtime.
- 25 Node tests passed; 3 Next route tests passed for safe identity DTO and ticket authentication/origin/room binding.
- Added encrypted retry queue for orphan upstream sessions when cleanup is offline.
- Added account-session revocation separately from deleting the identity; runtime closes matching tracked connections.
- Implemented /api/together/session and /api/together/tickets; not yet connected product UI.
- Outstanding batch 1: WS proxy, account/logout hooks, full API allowlist, mode exclusivity, Compose, integration and required whole-project checks.
  Ruling: password-only localstorage login cannot establish a distinct together identity; require signed durable site device sessions. Shared-password mode has no individual identity to safely bind.

## Batch 1 checkpoint: real site bridge, 2026-11-11

- Added explicit actor-only room HTTP mappings, authenticated session/ticket routes, native binary WS proxy, per-device and per-account lifecycle notification hooks.
- New mode disables legacy server and client connection configuration. TV remote Socket.IO remains separate. Default remains legacy.
- Runtime initialized after Next environment load and before accepting requests; lifecycle signals have no native imports and remain safe for Edge refresh verification.
- Added pinned Compose profile: SyncTV v1.0.14 index sha256:0f58fb9b5c91571ab4e3048679b12b4b69f68269ca4e62c3cacfaa83c5cc4934; PostgreSQL18.6-alpine3.24 index sha256:9ba53c7d41ea093baf5c1ba635ba5434c4f979880527d49bb7d9237d3193085b. Digests read from official registry responses.
- Added idempotent deployment-secret initializer; no services started by this initializer and no existing credentials overwritten.
- Native tests 32/32 passed. Includes actual local TCP binary proxy round trip/replay rejection, encrypted orphan cleanup, durable identity, principal/session invalidation and lossless uint64 permissions.
- Fixed protocol generator declaration emission: pbts needs pbjs JSDoc. Generated d.ts now has real typed exports; uses protobufjs.Long interface without another dependency. Wire 64-bit values remain lossless.
- Whole project at initial checkpoint: typecheck PASS, lint PASS (existing warnings retained), 189 Jest suites / 1252 tests PASS, format PASS, legacy room tests27/27 PASS. New throttle-specific tests pass separately; latest whole checks are being rerun before preview.
- Real site integration initially failed on second user's provisioning login. Traced to upstream HTTP429 (Retry-After11), not site authentication or encrypted identity. Two direct newly created diagnostic users reproduced it. The upstream default shares an auth5-per60seconds budget for all server-side bridge requests.
- Added bounded serialized login retry respecting Retry-After, refreshing the login challenge, maximum16 pending and65seconds deadline; non-auth writes are not retried. Session route preserves401/403/429 rather than hiding these as502.

Ruling: set the **private** SyncTV service auth budget to120 requests/minute, configurable through SYNCTV_BRIDGE_AUTH_MAX_REQUESTS. All users share one bridge IP; default5/minute cannot support the approved transparent two-account bootstrap (admin login2 + first user2 + second user2). Keep site login protections and upstream limiting enabled. Upstream has no public host port and arbitrary auth/admin routes are not exposed by the bridge. Cost if wrong: must size this private-service limit for expected simultaneous first logins; never publish the upstream login port with this bridge-specific budget. Verified upstream env override in pinned synctv/src/config_env.rs lines1205-1210.

Real test services:

- Site startup runner: output/synctv-implementation/start-site.cjs; private configuration site-test.env in that ignored directory. Site port18300. Last site process30908 STOPPED before checks.
- Upstream loopback18180, health18181, PostgreSQL25433, reused isolated /var/tmp/codex-synctv-20261110-okfSIt (not production). Startup runner output/synctv-implementation/start-upstream.sh. STOPPED before checkpoint, needs restart with the private bridge auth budget.
- Integration script output/synctv-implementation/bridge-integration.cjs currently fails on second identity because old service still used default budget. Must rerun against corrected private config, then test permissions, real protobuf sockets, logout, ban and same-name recreation.
- No full browser/media/UI acceptance yet. No old rooms archived, switched or removed.

### Proven live bridge checkpoint

Real site bridge integration passed all 8 checks through the same-origin proxy:
unauthenticated rejection; distinct ordinary identities for two site accounts;
private-room outsider ticket rejection; member cannot delete owner's room;
two actual protobuf WS heartbeat exchanges; logout closes the socket; disabling
closes all devices; deleting/recreating a username creates a different identity.
Evidence: output/synctv-implementation/bridge-integration-results.json.
A reviewable repeat runner is scripts/together/verify-bridge.cjs. It requires an
explicit TOGETHER_TEST_ISOLATED=true env file and loopback target, creates only
unique test actors and cleans those actors/room on success or failure.

Integration corrections, each with regression tests:

- Next custom server normalizes request.url to localhost. Validate browser
  Origin against incoming Host and existing secure-proxy handling instead.
- Empty DELETE requests can have an empty readable body. Do not mistake that
  for a non-JSON payload and return415 before upstream permission checking.
- ProtoJSON uint64 expiresInSecs is a string. Validate it losslessly and cap
  ticket lifetime to30seconds before arithmetic.
- SyncTV WebSocket defaults to JSON. Explicitly request format=protobuf on
  the upstream URL. A bare binary tunnel without this parameter opens but
  ignores binary messages; this was reproduced on direct upstream too.

Verification boundary: latest typecheck and lint PASS; rooms27/27 PASS; native
core tests currently33 total (new TTL test and format negotiation test pass).
Whole Jest previously189/1253 PASS before the final three boundary tests.
Latest Windows full Jest/formatter runs crash natively at varying places, no
failed Jest assertions. Preserve test-native-crash.log,
test-serial-native-crash.log, test-interpreter.log, test-bundled-node.log and
format-native-crash.log. Bundled Node24.22.1 and regexp interpreter did not
eliminate the native crash; jitless also crashed at startup. Root cause UNKNOWN.
Do not promote the old1253 pass to final verification. Full formatting passed
with pnpm format:check in WSL using the same Prettier2.8.8 and source files.
Now rerunning the exact Jest suite under official Linux Node24.18.0 and the
existing locked Next15.5.28 Linux SWC binary, downloaded with verified official
NodeSHA256 and packageSHA512 matching pnpm-lock.yaml. No dependencies, rules,
tests or tsconfig were changed for this runtime-only verification workaround.
Pending test log: output/synctv-implementation/test-linux-node24.log.

## Batch 1: complete, with explicit environment limitations

- Final typecheck PASS on Windows Node24.18.0. Lint PASS, existing warnings retained.
- Native together tests33/33 PASS; old room tests27/27 PASS.
- All190 Jest suites /1256 distinct test cases covered: Linux Node24.18.0 passed189 suites/1252 cases; the remaining migrate-branding suite was blocked by the Windows SQLite addon (invalidELFheader). That unchanged suite then passed all5 cases on Windows, including the4 native-dependent cases. This is composite coverage, NOT a clean single-process Windows/Linux full-suite pass. Logs: test-linux-node24.log and test-branding-windows.log.
- Full pnpm format:check PASS in WSL with the same Prettier2.8.8 and complete source tree. Native Windows formatter/Jest crashes remain unresolved and their raw logs retained. No test exclusions, tsconfig changes or source rollback used.
- Real site integration8/8 PASS via /api/together and /sync/ws. This is authentication/authorization/protobuf transport acceptance, not film playback acceptance.
- Official Docker Compose2.39.2 CLI (releaseSHA256 verified) validated both legacy mode WITHOUT generated SyncTV secrets and together profile AFTER idempotent initialization. Docker engine is absent, so actual container build/start was NOT tested.
- Reconfirmed running binary synctv1.0.14. Runtime test uses PostgreSQL18 from the previous isolated image extraction; Compose18.6 image has not been started.
- Full and Lite Dockerfiles now preserve vendor/synctv source/hash/license notices. App licenseApache2.0, server licenseMIT, both copied from fixed upstream tags.

Ruling: accept equivalent full assertion coverage across Linux Node24 and the Windows-only installed SQLite binding for this batch, because the sole Linux failure is a verified binary platform mismatch and the exact unchanged native suite passes on Windows. Keep the native Windows crash boundary visible; do not label a single full Windows run green. Subsequent gates may use the same runtime workaround while retaining all tests.

Next batch2: build immutable source/film/episode references and the member-authorized same-origin media gateway; reuse current source permissions, source detail adapters and guardedFetch. No root player/UI changes until its batch.
Prepared real media: official Blender BigBuckBunny fullMP4 (596.458333seconds,64.7MB), first120seconds remuxed as HLSfMP4, local VTT captions and two frame images. All in ignored output/synctv-implementation/media-fixtures. No binary .ts output (segments use .m4s) so tsc cannot scan media as TypeScript.
Site port18300 is STOPPED. Upstream18180/18181 and PostgreSQL25433 remain running via exec session31829; runner traps cleanup. Do not restart research or lose these private test files.

## Batch 2: media gateway implemented, real playback acceptance pending

- Added encrypted immutable room/source/film/episode references and opaque child resources in the separate together database. Added MP4 Range gateway, nested HLS URI/key/map rewriting, subtitle/poster paths, source refresh and strict episode matching. Cross-origin children and redirects strip private source headers. HTML is rejected; responses are private/no-store.
- Existing CMS, Emby, OpenList, Xiaoya and source-script resolution is reused through one server adapter with current owner/viewer permissions. CMS strict ID matching is opt-in so existing personal playback keeps its contract. Special-source integration is NOT yet exercised against real providers.
- Added authenticated POST /api/together/rooms/:roomId/media, GET/POST /api/together/media/:referenceId and GET/HEAD resource routes. Registration only adds media; it sends no playback command. Source URLs/headers remain encrypted server-side; SyncTV receives member-authorized gateway URLs.
- Removed an incorrect 15-second whole-response abort in the new adapter: a long movie must follow viewer cancellation/revocation rather than be truncated at 15 seconds. Regression test failed before this correction and passed after it.
- Typecheck PASS after one native 3221225477 crash and serial retry, with no preview running. Raw original log retained as typecheck-batch2-native-crash.log. Lint PASS (historical warnings); complete format:check PASS; git diff --check PASS.
- Full Jest run: 193/194 suites passed, 1267/1270 cases passed; remaining three failures were loopback EACCES in watch-room-socket. Re-running that complete suite with authorized local network access passed 19/19. Thus all194 suites/1270 distinct assertions covered across two runs, NOT one clean full run. Logs test-batch2.log and test-batch2-network.log.
- Core together tests45/45 and old room service27/27 PASS with local network access. Sandbox runs failed EACCES connecting 127.0.0.1; no source changes or skipped tests were used to resolve that environment issue. Focused media/source/SSRF/API Jest tests46/46 PASS.
- Explicit limits: HLS content steering is rejected; inline data keys are not yet supported end-to-end; unknown-format sniffing and richer subtitle metadata remain to verify. No browser playback, UI screenshot, source refresh integration or activity acceptance claimed.
- Next: isolated real CMS MP4/HLS fixture and two-account gateway integration, then actual browser playback before declaring batch2 complete. Batches3–6 have NOT begun.
- Runtime checkpoint: upstream restarted on loopback18180 via start-upstream.sh (exec48580); site18300 remains stopped. Previous exec31829 is stale.
- Subsequent checkpoint: site18300 started via start-site.cjs (exec32894). Real two-account identity/permissions/protobuf/revocation baseline8/8 PASS again (bridge-batch2.log). This does not count as film playback acceptance. Keep both isolated services for next media integration step; stop the site before any subsequent typecheck.

## 2026-11-12 continuation: real media acceptance and playback port

- Added reviewable loopback-only scripts/together/verify-media.cjs. Creates unique temporary source/user/private room, uses authenticated site admin routes, cleans all three in finally. Serves the previously prepared Blender MP4 and HLS assets, rotates source tokens to force expiration.
- Real integration PASS: ordinary-identity media registration, outsider403, both site accounts receive MP4 Range206/1024bytes, nested HLS manifests and actual segments, forced MP4 and nested-HLS expiration refresh retaining the selected episode, idempotent media registration.
- Optional TOGETHER_PLAYWRIGHT_MODULE enables two independent visible Chrome processes, each1440x900. Both decode MP4 AND HLS through the actual site gateway, advance past2seconds, pause, seek34seconds, resume at1.5x and advance past35seconds. All assertions PASS; screenshots media-browser-{0,1}-{mp4,hls}.png. Inspected member HLS screenshot. This is a disposable same-origin video fixture, NOT the site room UI or cross-client synchronization acceptance.
- First browser run failed because the bundled runtime path had changed. Located current runtime26.1111.10930 with the desktop dependency tool, reran PASS; no new project dependency. Local environment path supplied only via env, not hardcoded in the harness.
- Implemented inline HLS data keys end-to-end behind authorized opaque resources (regression RED then GREEN). No outbound fetch for data keys. Content steering remains explicitly unsupported.
- Batch3 initial PlaybackPort + DOM-free root PlaybackPortProvider added. Local/remote event origins, matching asynchronous seek events, failure cleanup, listener lifecycle and existing root behavior covered49/49 focused tests. No player element recreated by this provider. Old sync is still present and has NOT been declared retired. Root adapter and new realtime implementation remain to implement.
- Current typecheck PASS on serial retry; first run crashed inside TypeScript filter with TypeError (no TS diagnostic), raw log preserved typecheck-port-first-crash.log. Lint PASS; new together46/46 and old rooms27/27 PASS. Full suite and final format check must run again after remaining changes.
- Skills: Playwright and modern-web-guidance consulted. Search control-media-playback then list found no guide for synchronized media state; no unrelated guide applied. Existing site design retained; no product visual redesign.
- Fixed official upstream reference files cached as output/synctv-implementation/\*.dart.txt, all from appv1.1.32. Full path inventory upstream-all-paths.txt prevents repeating broad lookup. SyncedClock uses four timestamps with impossible-sample rejection; reconnect uses equal jitter1s..30s. room_playback_controller.dart only stores UI state; do not treat it as the synchronization algorithm.
- Runtime checkpoint: site18300 intentionally STOPPED (verified command line PID29072) before typecheck. SyncTV18180/Postgres25433 remain running. Next resume media or browser work by restarting start-site.cjs only after checks; no user confirmation needed.

### Batch3 continuing; do not stop at this checkpoint

- User explicitly objected to stopping after partial progress. Continue autonomously through the approved six batches; no routine confirmation. No commit/push/deployment.
- Added SyncedClock, equal-jitter reconnect policy, PlaybackOperations and native protobuf RoomRealtimeClient, based directly on the fixed upstream .dart.txt references. Three tests each for clock, operation ordering and realtime lifecycle pass (nine total). Reconnect obtains fresh tickets, replays observations/cursors without converting64bit toNumber, supports expired-cursor reset, stops permanently on server termination, cancels late ticket acquisition. Heartbeat25s/connect timeout10s follow upstream.
- Added RoomPlaybackAdapter: five tests pass for server-clock target/rate, remote-event suppression, follow isolation, source guards, older snapshot rejection, live-no-seek, cancellation of pending selection and clearing shared playback. Default drift thresholds1.2s automatic/0.2s explicit match upstream playback_mode_config.dart. selectMedia receives AbortSignal; its implementation MUST honor it and wait until the target player is ready.
- Important fixed-upstream detail: the official guarded command builder omits optimistic version locks (it sends source guards instead). Removed our extra outgoing version field after a RED test; received state versions still reject older snapshots. This avoids rejecting rapid successive player controls against the same acknowledged version.
- Added same-origin TogetherApi with signed site cookies only, safe stable errors, cancelable tickets and four-timestamp clock sync. Three focused tests pass. Added GET clock -> /api/public/time mapping with strict decimal clientSentAtNanos; policy test RED->GREEN. New GET media/lookup maps room+upstreamMediaId to an authorized descriptor; endpoint regression PASS.
- Extended generic PlaybackPort.load with optional resolved SearchResult detail. PlaybackPortProvider supplies it through a DOM-free context only while matching mediaRef/source/id remains selected; personal browsing cannot inherit another film's override (test RED->GREEN). Generic LegacyPlaybackSurface consumes this supplied detail before source/cache lookup and disables its initial autoplay for supplied media; the room adapter will control play after readiness. No room/protobuf import was added to that generic player. This new path still needs actual site player browser acceptance.
- playbackIdentity includes mediaRef only when present. Different rooms' references for the same film/episode therefore trigger an actual media selection, while ordinary personal identities keep the old key format. Regression RED->GREEN; session/provider tests54/54 pass after this update.
- Current pipeline is NOT yet wired into an actual new room provider/UI. The old sync hooks are still in the player/provider and must be extracted/retired before claiming batch3 done. Do not label new utility tests as actual site synchronization acceptance.
- Verification checkpoint before final media-detail extension: typecheck PASS (typecheck-current.log); lint PASS (lint-realtime.log). Full Windows Jest crashed in V8 (test-realtime.log). Equivalent Linux Node24 run covered199/200 suites1285/1289 cases, with only the same Windows SQLite addon mismatch in migrate-branding. That entire suite and latest focused edits passed in Windows10 suites77/77 cases (test-realtime-focused.log). Files changed after that run require focused reruns/new final gates. No native crash root cause claimed; a PowerShell CLR native crash also occurred once, retry with login:false worked.
- Current services: site18300 remains STOPPED, upstream18180/Postgres25433 running. Existing actual browser media test screenshots are QA fixtures, not product UI screenshots.
- Next implementation boundary: resolve room playback through media/lookup and give the personal player authorized gateway detail via PlaybackPort.load. Preserve original source/film/episode in that detail. Do not fall back to source URLs for a joined room. Ensure selected episode controls and next/previous use room media registration before shared source updates, rather than silently operating only one episode. Existing plain CMS returns no subtitles; real-site subtitle/provider acceptance still pending.
