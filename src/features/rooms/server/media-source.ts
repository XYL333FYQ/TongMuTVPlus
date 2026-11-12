import 'server-only';

import { NextRequest } from 'next/server';

import { getAvailableApiSites, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { getDetailFromApiV2 } from '@/lib/downstream';
import type { FeaturePermissionKey } from '@/lib/feature-permissions';
import { hasFeaturePermission } from '@/lib/permissions';
import { hostsOf } from '@/lib/server/ssrf';
import { getSpecialSourceDetail } from '@/lib/special-sources-detail';
import {
  executeSavedSourceScript,
  normalizeScriptDetailResult,
  normalizeScriptSources,
  parseScriptSourceValue,
} from '@/lib/source-script';
import type { SearchResult } from '@/lib/types';

export interface RoomFilmReference {
  id: string;
  roomId: string;
  ownerIdentityId: string;
  ownerAccountId: string;
  ownerIncarnation: string;
  source: string;
  filmId: string;
  episodeIndex: number;
  kind: string;
}
const denied = () =>
  Object.assign(new Error('Media source permission denied'), {
    status: 403,
    code: 'MEDIA_SOURCE_FORBIDDEN',
  });
const unavailable = () =>
  Object.assign(new Error('Requested film or episode is unavailable'), {
    status: 404,
    code: 'MEDIA_EPISODE_NOT_FOUND',
  });
function feature(source: string): FeaturePermissionKey | null {
  if (source === 'emby' || source.startsWith('emby_')) return 'emby';
  if (source === 'openlist') return 'private_library';
  if (source === 'xiaoya') return 'xiaoya';
  return null;
}
export async function assertRoomSourceAccess(username: string, source: string) {
  const required = feature(source);
  if (required) {
    if (!(await hasFeaturePermission(username, required))) throw denied();
    return;
  }
  if (parseScriptSourceValue(source)) return; // enabled-script checks happen in the existing executor
  const [normal, special] = await Promise.all([
    getAvailableApiSites(username),
    getAvailableApiSites(username, true),
  ]);
  if (![...normal, ...special].some((item) => item.key === source))
    throw denied();
}
export async function assertRoomMediaOwner(reference: RoomFilmReference) {
  if (reference.ownerIncarnation.startsWith('configured-owner:')) {
    if (
      reference.ownerAccountId !== process.env.USERNAME ||
      reference.ownerIncarnation !== 'configured-owner:' + process.env.USERNAME
    )
      throw denied();
    return;
  }
  const owner = await db.getUserInfoV2(reference.ownerAccountId);
  if (
    !owner ||
    owner.banned ||
    reference.ownerIncarnation !== 'account:' + owner.created_at
  )
    throw denied();
}
function inferFormat(url: string, hint?: string) {
  if (/hls|m3u8|mpegurl/i.test(hint || '') || /\.m3u8?(?:$|[?#])/i.test(url))
    return 'hls';
  if (/flv/i.test(hint || '') || /\.flv(?:$|[?#])/i.test(url)) return 'flv';
  if (/^audio\//.test(hint || '') || /\.(mp3|aac|ogg|m4a)(?:$|[?#])/i.test(url))
    return 'audio';
  return /mp4/i.test(hint || '') || /\.(mp4|m4v)(?:$|[?#])/i.test(url)
    ? 'mp4'
    : 'unknown';
}
function privateAsset(url: string, headers: Record<string, string> = {}) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw unavailable();
  if (parsed.username || parsed.password) {
    headers = {
      ...headers,
      Authorization:
        'Basic ' +
        Buffer.from(
          decodeURIComponent(parsed.username) +
            ':' +
            decodeURIComponent(parsed.password)
        ).toString('base64'),
    };
    parsed.username = '';
    parsed.password = '';
  }
  return { url: parsed.href, headers };
}

/** Compatibility is isolated here; signed request credentials are never persisted or sent upstream. */
async function resolveExistingAsset(
  reference: RoomFilmReference,
  raw: string,
  request: NextRequest
) {
  if (/^https?:\/\//i.test(raw)) return privateAsset(raw);
  const local = new URL(raw, 'http://localhost');
  if (reference.source === 'emby' || reference.source.startsWith('emby_')) {
    const { embyManager } = await import('@/lib/emby-manager');
    const client = await embyManager.getClient(
      reference.source.startsWith('emby_')
        ? reference.source.slice(5)
        : undefined
    );
    const headers = { 'User-Agent': client.getUserAgent() };
    if (local.pathname.startsWith('/api/emby/play/')) {
      const id = local.searchParams.get('itemId');
      if (!id) throw unavailable();
      return privateAsset(await client.getStreamUrl(id, true, true), headers);
    }
    if (local.pathname.startsWith('/api/emby/image/'))
      return privateAsset(
        client.getImageUrl(
          local.pathname.split('/').at(-1) || reference.filmId,
          'Primary',
          undefined,
          undefined,
          true
        ),
        headers
      );
    if (local.pathname.startsWith('/api/emby/subtitle/')) {
      const item = local.searchParams.get('itemId'),
        media = local.searchParams.get('mediaSourceId'),
        index = Number(local.searchParams.get('streamIndex'));
      if (!item || !media || !Number.isSafeInteger(index) || index < 0)
        throw unavailable();
      return privateAsset(
        await client.getSubtitleStreamUrl(
          item,
          media,
          index,
          local.searchParams.get('format') || 'vtt',
          true
        ),
        headers
      );
    }
  }
  const cookieHeaders = new Headers();
  for (const name of ['cookie', 'authorization']) {
    const value = request.headers.get(name);
    if (value) cookieHeaders.set(name, value);
  }
  local.searchParams.set('format', 'json');
  let handler: ((req: NextRequest) => Promise<Response>) | undefined;
  if (
    reference.source === 'openlist' &&
    local.pathname === '/api/openlist/play'
  )
    handler = (await import('@/app/api/openlist/play/route')).GET;
  if (reference.source === 'xiaoya' && local.pathname === '/api/xiaoya/play')
    handler = (await import('@/app/api/xiaoya/play/route')).GET;
  if (
    parseScriptSourceValue(reference.source) &&
    local.pathname === '/api/source-script/play'
  )
    handler = (await import('@/app/api/source-script/play/route')).GET;
  if (handler) {
    const response = await handler(
      new NextRequest(local, { headers: cookieHeaders })
    );
    if (!response.ok) throw unavailable();
    const result = (await response.json()) as {
      url?: unknown;
      headers?: Record<string, string>;
      mediaType?: string;
    };
    if (typeof result.url !== 'string') throw unavailable();
    return {
      ...privateAsset(result.url, result.headers),
      format: inferFormat(result.url, result.mediaType),
    };
  }
  if (local.pathname.startsWith('/api/proxy') && local.searchParams.get('url'))
    return privateAsset(local.searchParams.get('url')!);
  throw Object.assign(new Error('Unsupported internal media resolver'), {
    status: 502,
    code: 'MEDIA_RESOLVER_UNSUPPORTED',
  });
}

export async function resolveSiteRoomMedia(
  reference: RoomFilmReference,
  actor: string,
  request: NextRequest
) {
  await assertRoomMediaOwner(reference);
  await Promise.all([
    assertRoomSourceAccess(actor, reference.source),
    assertRoomSourceAccess(reference.ownerAccountId, reference.source),
  ]);
  if (reference.kind !== 'movie')
    throw Object.assign(new Error('Activity source adapter is not available'), {
      status: 501,
    });
  const config = await getConfig();
  const provider = feature(reference.source),
    script = parseScriptSourceValue(reference.source);
  let detail: SearchResult | null,
    trusted: Array<string | undefined> = [];
  if (provider) {
    detail = await getSpecialSourceDetail(reference.source, reference.filmId);
    if (provider === 'emby')
      trusted = config.EmbyConfig?.Sources?.filter((item) => item.enabled).map(
        (item) => item.ServerURL
      ) || [config.EmbyConfig?.ServerURL];
    else
      trusted = [
        provider === 'xiaoya'
          ? config.XiaoyaConfig?.ServerURL
          : config.OpenListConfig?.URL,
      ];
  } else if (script) {
    const sources = await executeSavedSourceScript({
      key: script.scriptKey,
      hook: 'getSources',
      payload: {},
    });
    const source = normalizeScriptSources(sources.result).find(
      (item) => item.id === script.sourceId
    );
    if (!source) throw denied();
    const result = await executeSavedSourceScript({
      key: script.scriptKey,
      hook: 'detail',
      payload: { id: reference.filmId, sourceId: script.sourceId },
    });
    detail = normalizeScriptDetailResult({
      source: reference.source,
      scriptKey: script.scriptKey,
      scriptName: result.meta?.name || script.scriptKey,
      sourceId: script.sourceId,
      sourceName: source.name,
      detailId: reference.filmId,
      result: result.result,
    });
  } else {
    const [normal, special] = await Promise.all([
      getAvailableApiSites(actor),
      getAvailableApiSites(actor, true),
    ]);
    const site = [...normal, ...special].find(
      (item) => item.key === reference.source
    );
    if (!site) throw denied();
    trusted = [site.api];
    detail = await getDetailFromApiV2(site, reference.filmId, {
      requireExactId: true,
    });
  }
  if (
    !detail ||
    String(detail.id) !== reference.filmId ||
    !Number.isSafeInteger(reference.episodeIndex) ||
    reference.episodeIndex < 0 ||
    !detail.episodes[reference.episodeIndex]
  )
    throw unavailable();
  const media = await resolveExistingAsset(
    reference,
    detail.episodes[reference.episodeIndex],
    request
  );
  const subtitles = await Promise.all(
    (detail.subtitles?.[reference.episodeIndex] || []).map(async (item) => ({
      ...item,
      ...(await resolveExistingAsset(reference, item.url, request)),
      format: item.format || 'vtt',
    }))
  );
  return {
    ...media,
    source: reference.source,
    filmId: reference.filmId,
    episodeIndex: reference.episodeIndex,
    title: detail.title,
    episodeTitle:
      detail.episodes_titles?.[reference.episodeIndex] ||
      String(reference.episodeIndex + 1),
    format: 'format' in media ? media.format : inferFormat(media.url),
    poster: detail.poster
      ? await resolveExistingAsset(reference, detail.poster, request)
      : null,
    subtitles,
    trustedHosts: [...hostsOf(trusted)],
  };
}
