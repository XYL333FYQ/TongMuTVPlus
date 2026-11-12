'use strict';
const { rewritePlaylist } = require('./hls.cjs');
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Vary: 'Cookie, Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'",
};
const failure = (status, code, message = code) =>
  Object.assign(new Error(message), { status, code });
const discard = async (response) => {
  try {
    await response.body?.cancel();
  } catch {}
};

function headersForOrigin(input, credentialOrigin, url) {
  const headers = new Headers(input || {});
  for (const name of [
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'upgrade',
    'proxy-authorization',
    'te',
    'trailer',
  ])
    headers.delete(name);
  if (new URL(url).origin !== credentialOrigin) {
    for (const name of [...headers.keys()])
      if (
        ![
          'accept',
          'accept-language',
          'user-agent',
          'referer',
          'range',
          'if-range',
          'accept-encoding',
        ].includes(name)
      )
        headers.delete(name);
    const referer = headers.get('referer');
    if (referer) {
      try {
        headers.set('referer', new URL(referer).origin + '/');
      } catch {
        headers.delete('referer');
      }
    }
  }
  return headers;
}
function validateRange(value) {
  if (!value) return;
  const match = /^bytes=(\d{0,16})-(\d{0,16})$/.exec(value);
  if (!match || (!match[1] && !match[2])) throw failure(416, 'INVALID_RANGE');
  const start = match[1] ? Number(match[1]) : null,
    end = match[2] ? Number(match[2]) : null;
  if (
    (start !== null && !Number.isSafeInteger(start)) ||
    (end !== null && !Number.isSafeInteger(end)) ||
    (start !== null && end !== null && end < start) ||
    (start === null && end === 0)
  )
    throw failure(416, 'INVALID_RANGE');
}
function asset(value, defaults = {}) {
  if (typeof value === 'string') value = { url: value };
  if (
    !value ||
    typeof value.url !== 'string' ||
    value.url.length > 16384 ||
    /[\x00-\x1f]/.test(value.url)
  )
    throw failure(502, 'INVALID_MEDIA_SOURCE');
  const url = new URL(value.url);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw failure(502, 'INVALID_MEDIA_SOURCE');
  url.hash = '';
  return {
    ...value,
    url: url.href,
    headers: Object.fromEntries(
      new Headers(value.headers || defaults.headers || {})
    ),
    credentialOrigin: value.headers
      ? url.origin
      : defaults.credentialOrigin || url.origin,
  };
}

class RoomMediaGateway {
  constructor({ store, authorize, resolveSource, fetch }) {
    if (
      !store ||
      typeof authorize !== 'function' ||
      typeof resolveSource !== 'function' ||
      typeof fetch !== 'function'
    )
      throw new Error(
        'Authorized media source and safe HTTP adapters are required'
      );
    this.store = store;
    this.authorize = authorize;
    this.resolveSource = resolveSource;
    this.fetch = fetch;
    this.flights = new Map();
  }
  async once(key, action) {
    if (this.flights.has(key)) return this.flights.get(key);
    const pending = Promise.resolve().then(action);
    this.flights.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.flights.get(key) === pending) this.flights.delete(key);
    }
  }
  async resolve(reference, force = false) {
    if (!force) {
      const state = this.store.state(reference.id);
      if (state) return state;
    }
    return this.once('resolve:' + reference.id, async () => {
      if (!force) {
        const cached = this.store.state(reference.id);
        if (cached) return cached;
      }
      const descriptor = await this.resolveSource(reference);
      if (
        !descriptor ||
        descriptor.source !== reference.source ||
        descriptor.filmId !== reference.filmId ||
        descriptor.episodeIndex !== reference.episodeIndex
      )
        throw failure(
          502,
          'MEDIA_REFERENCE_MISMATCH',
          'Resolved film does not match immutable media reference'
        );
      const root = asset(descriptor),
        format = descriptor.format || 'unknown';
      if (!['mp4', 'hls', 'audio', 'flv', 'unknown'].includes(format))
        throw failure(502, 'INVALID_MEDIA_FORMAT');
      const subtitles = (descriptor.subtitles || []).map((item) =>
        asset(item, root)
      );
      const normalized = {
        ...descriptor,
        ...root,
        format,
        subtitles,
        poster: descriptor.poster ? asset(descriptor.poster, root) : null,
      };
      const metadata = {
        title: descriptor.title || '',
        episodeTitle: descriptor.episodeTitle || '',
        format,
        hasPoster: !!normalized.poster,
        subtitles: subtitles.map((item) => ({
          label: item.label || '',
          language: item.language || '',
          format: item.format || 'vtt',
        })),
      };
      if (Number.isFinite(descriptor.duration))
        metadata.duration = descriptor.duration;
      this.store.setMetadata(reference.id, metadata);
      return this.store.saveState(reference.id, normalized, 30000);
    });
  }
  path(reference, target) {
    return '/api/together/media/' + reference.id + '/' + target;
  }
  async describe(principal, id, { force = false } = {}) {
    const ref = this.store.require(id);
    await this.authorize(principal, ref);
    const state = await this.resolve(ref, force);
    await this.authorize(principal, ref);
    const current = this.store.require(id),
      metadata = current.metadata;
    return {
      id: ref.id,
      roomId: ref.roomId,
      source: ref.source,
      filmId: ref.filmId,
      episodeIndex: ref.episodeIndex,
      kind: ref.kind,
      upstreamMediaId: current.upstreamMediaId,
      ...metadata,
      generation: state.generation,
      streamPath: this.path(
        ref,
        'stream.' +
          (metadata.format === 'hls'
            ? 'm3u8'
            : metadata.format === 'audio'
            ? 'audio'
            : 'mp4')
      ),
      posterPath: metadata.hasPoster ? this.path(ref, 'poster') : null,
      subtitles: (metadata.subtitles || []).map((item, index) => ({
        ...item,
        url: this.path(ref, 'subtitle/' + index),
      })),
    };
  }
  pick(state, target) {
    if (target === 'stream') return { ...state.value, ancestry: [] };
    if (target === 'poster' && state.value.poster)
      return { ...state.value.poster, kind: 'poster' };
    if (/^subtitle\/\d{1,3}$/.test(target)) {
      const item = state.value.subtitles[Number(target.split('/')[1])];
      if (item) return { ...item, kind: 'subtitle' };
    }
    throw failure(404, 'MEDIA_RESOURCE_NOT_FOUND');
  }
  async readText(response) {
    if (!response.body) return '';
    const reader = response.body.getReader(),
      chunks = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2 * 1024 * 1024) {
        await reader.cancel();
        throw failure(502, 'HLS_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  async fetchAsset(ref, state, value, request = {}) {
    if (value.kind === 'key' && value.url.startsWith('data:')) {
      if (
        value.url.length > 8192 ||
        !/^data:(?:application\/octet-stream)?;base64,[A-Za-z0-9+/]+=*$/.test(
          value.url
        )
      )
        throw failure(502, 'INVALID_HLS_KEY');
      const bytes = Buffer.from(
        value.url.slice(value.url.indexOf(',') + 1),
        'base64'
      );
      if (!bytes.length) throw failure(502, 'INVALID_HLS_KEY');
      return new Response(request.method === 'HEAD' ? null : bytes, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(bytes.length),
        },
      });
    }
    const headers = headersForOrigin(
        value.headers,
        value.credentialOrigin,
        value.url
      ),
      incoming = new Headers(request.headers || {});
    headers.set('accept-encoding', 'identity');
    const range = incoming.get('range');
    if (range) headers.set('range', range);
    const ifRange = incoming.get('if-range');
    if (ifRange && ifRange.length <= 256) headers.set('if-range', ifRange);
    return this.fetch(
      value.url,
      {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers,
        signal: request.signal,
      },
      {
        trustedHosts: state.value.trustedHosts || [],
        credentialOrigin: value.credentialOrigin,
      }
    );
  }
  async recoverResource(ref, state, original, request) {
    if (!Array.isArray(original.ancestry) || !original.ancestry.length)
      throw failure(410, 'MEDIA_REFRESH_REQUIRED');
    let current = { ...state.value, ancestry: [] },
      variables = {};
    for (const step of original.ancestry) {
      const response = await this.fetchAsset(ref, state, current, {
        signal: request.signal,
      });
      if (!response.ok) {
        await discard(response);
        throw failure(410, 'MEDIA_REFRESH_REQUIRED');
      }
      const base = response.url || current.url,
        text = await this.readText(response),
        matches = [];
      rewritePlaylist(
        text,
        base,
        (url, context) => {
          if (context.selector === step.selector && context.kind === step.kind)
            matches.push({ url, ...context });
          return '/api/together/media/placeholder';
        },
        variables
      );
      if (
        !matches.length ||
        matches.some((item) => item.url !== matches[0].url)
      )
        throw failure(410, 'MEDIA_REFRESH_REQUIRED');
      const chosen = matches[0];
      variables = chosen.variables;
      current = {
        ...current,
        url: chosen.url,
        variables,
        kind: chosen.kind,
        ancestry: [...current.ancestry, step],
      };
    }
    return current;
  }
  async open(principal, id, target, request = {}) {
    const ref = this.store.require(id);
    await this.authorize(principal, ref);
    validateRange(new Headers(request.headers || {}).get('range'));
    if (request.method && !['GET', 'HEAD'].includes(request.method))
      throw failure(405, 'METHOD_NOT_ALLOWED');
    let state, value, resource;
    if (/^resource\/[A-Za-z0-9_]+$/.test(target)) {
      resource = this.store.resource(id, target.split('/')[1]);
      if (!resource) throw failure(404, 'MEDIA_RESOURCE_NOT_FOUND');
      value = resource.value;
    }
    state = await this.resolve(ref);
    if (!resource) value = this.pick(state, target);
    await this.authorize(principal, ref);
    let response = await this.fetchAsset(ref, state, value, request);
    if ([401, 403, 404, 410].includes(response.status)) {
      await discard(response);
      if (!resource || resource.generation === state.generation)
        state = await this.resolve(ref, true);
      value = resource
        ? await this.once(
            'recover:' + resource.id + ':' + state.generation,
            () => this.recoverResource(ref, state, value, request)
          )
        : this.pick(state, target);
      await this.authorize(principal, ref);
      response = await this.fetchAsset(ref, state, value, request);
    }
    try {
      await this.authorize(principal, ref);
    } catch (error) {
      await discard(response);
      throw error;
    }
    const headers = new Headers({
      ...PRIVATE_HEADERS,
      'X-Tongmu-Media-Generation': String(state.generation),
    });
    if (response.status === 416) {
      headers.set(
        'Content-Range',
        response.headers.get('content-range') || 'bytes */*'
      );
      await discard(response);
      return new Response(null, { status: 416, headers });
    }
    if (!response.ok) {
      await discard(response);
      throw failure(502, 'MEDIA_SOURCE_UNAVAILABLE');
    }
    const mime = (
      response.headers.get('content-type') || 'application/octet-stream'
    )
      .split(';')[0]
      .toLowerCase();
    if (mime === 'text/html' || mime === 'application/xhtml+xml') {
      await discard(response);
      throw failure(502, 'INVALID_MEDIA_CONTENT');
    }
    const playlist =
      value.kind === 'playlist' ||
      mime.includes('mpegurl') ||
      (target === 'stream' && state.value.format === 'hls');
    if (playlist) {
      headers.set('Content-Type', 'application/vnd.apple.mpegurl');
      if (request.method === 'HEAD') {
        await discard(response);
        return new Response(null, { headers });
      }
      const base = response.url || value.url,
        text = await this.readText(response);
      const rewritten = this.store.db.transaction(() =>
        rewritePlaylist(
          text,
          base,
          (url, context) => {
            const entry = this.store.createResource(id, state.generation, {
              url,
              headers: value.headers,
              credentialOrigin: value.credentialOrigin,
              kind: context.kind,
              variables: context.variables,
              ancestry: [
                ...(value.ancestry || []),
                { selector: context.selector, kind: context.kind },
              ],
            });
            return this.path(ref, 'resource/' + entry.id);
          },
          value.variables || {}
        )
      )();
      this.store.prune();
      return new Response(rewritten, { headers });
    }
    let contentType = 'application/octet-stream';
    if (value.kind === 'subtitle')
      contentType =
        value.format === 'srt'
          ? 'application/x-subrip; charset=utf-8'
          : value.format === 'ass'
          ? 'text/x-ssa; charset=utf-8'
          : 'text/vtt; charset=utf-8';
    else if (value.kind === 'poster' && mime.startsWith('image/'))
      contentType = mime;
    else if (
      /^(video|audio)\//.test(mime) ||
      [
        'application/octet-stream',
        'application/mp4',
        'binary/octet-stream',
      ].includes(mime)
    )
      contentType = mime;
    headers.set('Content-Type', contentType);
    const encoded = response.headers.get('content-encoding');
    if (response.status === 206 && encoded && encoded !== 'identity') {
      await discard(response);
      throw failure(502, 'ENCODED_RANGE_UNSUPPORTED');
    }
    for (const name of [
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
      'content-length',
    ]) {
      const value = response.headers.get(name);
      if (
        value &&
        !(name === 'content-length' && encoded && encoded !== 'identity')
      )
        headers.set(name, value);
    }
    if (request.method === 'HEAD') {
      await discard(response);
      return new Response(null, { status: response.status, headers });
    }
    return new Response(response.body, { status: response.status, headers });
  }
}
module.exports = { RoomMediaGateway, headersForOrigin, validateRange };
