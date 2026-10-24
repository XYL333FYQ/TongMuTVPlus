<div align="center">

<img src="public/logo.png" alt="TongMuTV Plus" width="96">

# TongMuTV Plus

**A private streaming site for watching movies with friends.** Watch on your own, or open a room where everyone stays in sync and chats while watching.

English | [简体中文](README_zh.md)

![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9-3178c6?logo=typescript)
![Socket.IO](https://img.shields.io/badge/Socket.IO-rooms-010101?logo=socketdotio)
![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker)
![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey)

</div>

![Room page (dark)](docs/images/room-dark.jpg)

## What it is

TongMuTV Plus is a customized project built on [MoonTVPlus](https://github.com/mtvpls/MoonTVPlus), with its own product identity, room experience and interface. It is designed for **small, invite-only communities**: one owner deploys an instance and invites friends with an invite code.

Two equal core features:

- **Watch alone**: search titles, browse Douban charts, play with episodes and danmaku comments, and pick up where you left off from "Continue watching".
- **Watch together**: create a room, share the link, build a shared playlist. Play, pause and seek stay in sync for everyone, with chat alongside.

What you can watch depends on the video sources the site owner configures. This project does not provide any content.

## Features

### Core (tested end to end)

| Feature          | Details                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Library          | Aggregates owner-configured sources: search, details, episodes, Douban charts and recommendations                |
| Playback         | HLS / MP4, danmaku, watch history, "Continue watching" on the home page                                          |
| Site-wide player | Playback survives page navigation; shrink to a draggable mini player that snaps to corners, or collapse it       |
| Watch rooms      | Public / private rooms, room passwords, invite links; shared playlist; real-time play, pause and seek sync; chat |
| Host handover    | 30-second reconnect grace for the host, then handover to a pre-authorized member; "watch alone" mode             |
| Persistent rooms | Auto-pause and sleep when empty; archived after 30 idle days (owner can disable)                                 |
| Direct links     | Add `.mp4` / `.m3u8` URLs straight into a room                                                                   |
| Accounts         | Invite-code registration, QR login for TV, OIDC single sign-on; owner / admin / member roles                     |
| Admin panel      | Sources, users, site settings, announcements, online backup and restore                                          |
| UI               | Dark / light / system theme, mobile portrait layout, reduced-motion support                                      |

### Extras (inherited from upstream; usable but not individually audited)

IPTV (m3u + EPG), web live streams (Bilibili / Huya / Douyin live rooms), short dramas, music, manga, e-books (Legado book sources), private media library, movie requests, AI-assisted search, plus in-room synced music, synced live TV, screen sharing and voice.

> A room's "direct link" only accepts video file URLs. It does **not** parse web pages such as Bilibili or Tencent Video.

## Deploy on a VPS (Docker)

### Requirements

- A Linux VPS: 2 vCPU / 2 GB RAM or more recommended (building the image on the server needs about 2 GB; pulling the prebuilt image works with 1 GB)
- Docker with the Compose plugin
- A domain with an A record pointing to the VPS (rooms use WebSocket; HTTPS is recommended)

### 1. Get the code and configure

```bash
git clone https://github.com/XYL333FYQ/TongMuTVPlus.git
cd TongMuTVPlus
cp .env.example .env
nano .env
```

At minimum, set these in `.env`:

| Variable               | Description                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PASSWORD`             | **Required.** Owner password. Use a strong one you don't use anywhere else                                                |
| `USERNAME`             | Owner username, defaults to `admin`                                                                                       |
| `TONGMU_IMAGE`         | Leave empty to build on the server; set `ghcr.io/xyl333fyq/tongmutvplus:latest` to pull the image built by GitHub Actions |
| `AUTH_SECRET`          | Login signing secret. If empty, generated on first start and saved to `.data/auth-secret`                                 |
| `ROOM_ALLOWED_ORIGINS` | If your reverse proxy rewrites Host, set your public origin, e.g. `https://tv.example.com`                                |

Other room settings (member limits, sleep, archiving) are documented in [.env.example](.env.example).

### 2. Start

```bash
# Option A: build on the server (TONGMU_IMAGE empty)
docker compose up -d --build

# Option B: pull the prebuilt image (TONGMU_IMAGE set)
docker compose pull && docker compose up -d
```

Check readiness:

```bash
docker compose ps
curl http://127.0.0.1:3000/health/ready
```

By default the service only listens on `127.0.0.1:3000`; expose it through a reverse proxy.

### 3. HTTPS reverse proxy

Pick one:

- **Caddy** (recommended, automatic certificates): see [deploy/Caddyfile.example](deploy/Caddyfile.example)
- **Nginx**: see [deploy/nginx.conf.example](deploy/nginx.conf.example), with certificates from certbot

Either way, forward WebSocket upgrades for `/socket.io/` and keep the idle timeout above 60 seconds, or rooms will keep disconnecting.

### 4. After going live

1. Log in as the owner and add video sources in the **admin panel** (search returns nothing without sources).
2. To let friends sign up, enable registration and set an invite code in the admin panel.
3. Play a title yourself, then create a room and test syncing with a friend.
4. Export a backup and keep it somewhere safe.

### Updating

```bash
git pull
docker compose up -d --build                  # Option A
docker compose pull && docker compose up -d   # Option B
```

Back up before updating. Never use commands that delete volumes, such as `docker compose down -v`.

### Data and backups

| Host path   | Contents                                                           |
| ----------- | ------------------------------------------------------------------ |
| `./.data`   | SQLite database `moontv.db` and login signing secret `auth-secret` |
| `./data`    | Offline download directory                                         |
| `./backups` | Backup files                                                       |

Online backup (no downtime):

```bash
docker compose exec --user 0 tongmutvplus node scripts/ops/sqlite-backup.cjs --output /backups/$(date +%Y%m%d-%H%M%S).sqlite
```

Restore steps are in [docs/operations.md](docs/operations.md) (Chinese). The admin panel can also export / import all site data.

## Local development

Requires Node 24 and pnpm.

```bash
pnpm install
cp .env.example .env    # set PASSWORD
pnpm dev                # http://localhost:3000
```

Checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rooms
```

`pnpm build` on Windows may fail with EPERM on standalone symlinks; Linux / Docker builds are unaffected.

## Docs

- [Operations, backup and restore](docs/operations.md)
- [Architecture](docs/architecture.md)
- [Product scope and acceptance rules](docs/requirements.md)
- [Original MoonTVPlus README](docs/upstream-moontvplus-README.md) (more configuration options and other deployment targets)

## Disclaimer

- For learning and personal use only. This project provides no content and is not responsible for what any video source serves.
- Use a strong password, keep public registration off (the default), use it within a small circle, and don't publish your instance URL.
- Follow the laws where you live; users bear all legal responsibility for their use of this project.

## License and credits

Licensed under [CC BY-NC-SA 4.0](LICENSE), inherited from upstream: you may modify and share it with attribution, **no commercial use**, and derivatives must use the same license.

Thanks to [MoonTVPlus](https://github.com/mtvpls/MoonTVPlus), [MoonTV / LunaTV](https://github.com/MoonTechLab/LunaTV), [LibreTV](https://github.com/LibreSpark/LibreTV), [ArtPlayer](https://github.com/zhw2590582/ArtPlayer), [HLS.js](https://github.com/video-dev/hls.js) and all contributors.
