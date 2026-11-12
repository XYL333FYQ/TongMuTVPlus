# Local SyncTV bridge setup

This implements the approved parallel rebuild. The default remains `legacy`.
Do not use this as a production cutover until every gate in
SYNCTV-REFACTOR-EXECUTION.md is passed.

Run `node scripts/together/init.cjs` once to create private secret files in
`.data`. It preserves existing values and refuses inconsistent files.
Back up the entire directory, including together-key and together.db. Losing the
key makes saved upstream credentials unreadable. No site password is copied.

For an isolated Compose checkout, use:

```sh
TOGETHER_BACKEND=synctv docker compose --profile together up --build
```

PowerShell: set `$env:TOGETHER_BACKEND='synctv'` before the Compose command.
This requires Docker Compose 2.24 or later for optional env files. The setup
script starts no services. Keep real site data out of the isolated checkout.

SyncTV v1.0.14 and PostgreSQL 18.6 are pinned by registry index digest.
The upstream Compose source was checked at
https://github.com/synctv-org/synctv/blob/v1.0.14/docker-compose.yml .
The official PostgreSQL image layout for version 18 uses
`/var/lib/postgresql`, not the old `/var/lib/postgresql/data` mount.

Only the site publishes a host port. PostgreSQL is on an internal network;
SyncTV has a private API network with outbound access for media providers.
There is no Redis. Data, uploads and PostgreSQL use separate persistent volumes.
Movie/media gateway and WebRTC activity acceptance are later rebuild gates.

`/api/together/session` resolves a signed, still-valid site device and binds it
to a dedicated ordinary upstream account. Shared-password localstorage mode
cannot provide independent account identity and is rejected.
`/api/together/tickets` requires a same-origin JSON POST and creates a one-use,
room-bound, cookie-bound ticket with at most 30 seconds to connect.
`/sync/ws/{roomId}?ticket=...` forwards only the upstream ticket. Browser cookies
and privileged credentials are not forwarded.

Lifecycle notifications are deliberately free of native imports because site
refresh-token verification is also used by Edge middleware. The custom Node
server initializes the bridge listener before accepting requests. Same-process
logout/account changes revoke tickets and tracked sockets immediately; live
device/account revalidation also runs every five seconds. Multiple site replicas
are not supported by this initial, non-Redis bridge; coordinated revocation
would be needed before running more than one replica.

Commands for bridge checks: `pnpm test:together`, `pnpm gen:synctv`.
These do not replace the project and browser acceptance gates.

Private bridge auth traffic shares a single source IP. The upstream default of
5 authentication requests per 60 seconds cannot bootstrap two new site users
(admin login plus each ordinary-user login uses two requests). This private
Compose service sets a bounded 120/minute budget, configurable with
SYNCTV_BRIDGE_AUTH_MAX_REQUESTS. Site login protections remain unchanged;
the bridge exposes neither upstream login nor admin routes. Login retry respects
upstream Retry-After and has a bounded queue/deadline. Do not publish SyncTV's
own API/login ports with this bridge-specific configuration.
