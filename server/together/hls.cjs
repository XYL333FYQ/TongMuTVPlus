'use strict';
function invalid() {
  return Object.assign(new Error('Invalid or unsupported HLS manifest'), {
    status: 502,
    code: 'INVALID_HLS',
  });
}
function attributes(line) {
  const result = Object.create(null),
    body = line.slice(line.indexOf(':') + 1);
  const pattern = /(?:^|,)\s*([A-Z0-9-]+)\s*=\s*(?:"([^"]*)"|([^,]*))/g;
  let match;
  while ((match = pattern.exec(body)))
    result[match[1]] = match[2] ?? match[3].trim();
  return result;
}
function rewritePlaylist(text, baseUrl, rewrite, parentVariables = {}) {
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024)
    throw invalid();
  text = text.replace(/^\uFEFF/, '');
  if (!/^\s*#EXTM3U(?:\s|$)/.test(text)) throw invalid();
  const base = new URL(baseUrl),
    variables = Object.assign(Object.create(null), parentVariables);
  if (!['https:', 'http:'].includes(base.protocol)) throw invalid();
  const expand = (value) => {
    for (let depth = 0; depth < 16; depth++) {
      let found = false;
      value = value.replace(/\{\$([A-Za-z0-9_-]+)\}/g, (_, name) => {
        found = true;
        if (
          !Object.hasOwn(variables, name) ||
          typeof variables[name] !== 'string'
        )
          throw invalid();
        return variables[name];
      });
      if (!found) return value;
    }
    throw invalid();
  };
  const lines = text.split(/\r?\n/);
  for (const line of lines)
    if (line.startsWith('#EXT-X-DEFINE:')) {
      const fields = attributes(line);
      if (fields.QUERYPARAM) {
        const value = base.searchParams.get(fields.QUERYPARAM);
        if (value === null) throw invalid();
        variables[fields.QUERYPARAM] = value;
      } else if (fields.IMPORT) {
        if (!Object.hasOwn(variables, fields.IMPORT)) throw invalid();
      } else if (fields.NAME && typeof fields.VALUE === 'string') {
        if (!/^[A-Za-z0-9_-]+$/.test(fields.NAME)) throw invalid();
        variables[fields.NAME] = expand(fields.VALUE);
      } else throw invalid();
    }
  let count = 0,
    nextPlaylist = false;
  const map = (raw, kind) => {
    if (++count > 50000) throw invalid();
    const expanded = expand(raw);
    let url;
    try {
      url = new URL(expanded, base);
    } catch {
      throw invalid();
    }
    const dataKey =
      kind === 'key' &&
      expanded.length <= 8192 &&
      /^data:(?:application\/octet-stream)?;base64,[A-Za-z0-9+/]+=*$/.test(
        expanded
      );
    if (
      (!['http:', 'https:'].includes(url.protocol) && !dataKey) ||
      url.username ||
      url.password
    )
      throw invalid();
    url.hash = '';
    const mapped = rewrite(url.href, {
      kind,
      selector: expanded.split(/[?#]/)[0],
      variables: { ...variables },
    });
    if (
      typeof mapped !== 'string' ||
      !/^\/(?!\/)/.test(mapped) ||
      /[\r\n"]/.test(mapped)
    )
      throw invalid();
    return mapped;
  };
  const output = [];
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#EXT-X-DEFINE:')) continue;
    if (line.startsWith('#')) {
      if (!line.startsWith('#EXT')) continue;
      // Steering JSON contains alternate authorities and query credentials. Fail explicitly
      // rather than forwarding an unprotected secondary manifest.
      if (line.startsWith('#EXT-X-CONTENT-STEERING:')) throw invalid();
      const kind = /^#EXT-X-(?:SESSION-)?KEY:/.test(line)
        ? 'key'
        : /^#EXT-X-(?:MEDIA|I-FRAME-STREAM-INF|RENDITION-REPORT):/.test(line)
        ? 'playlist'
        : 'media';
      line = line.replace(
        /\b([A-Z0-9-]*URI)\s*=\s*"([^"]*)"/g,
        (_, name, uri) => name + '="' + map(uri, kind) + '"'
      );
      if (/\b[A-Z0-9-]*URI\s*=\s*(?!")/.test(line)) {
        // Check attribute values without accepting unquoted source URIs.
        const attrs = attributes(line);
        for (const name of Object.keys(attrs))
          if (name.endsWith('URI') && !line.includes(name + '="'))
            throw invalid();
      }
      output.push(line);
      if (line.startsWith('#EXT-X-STREAM-INF:')) nextPlaylist = true;
    } else {
      output.push(map(line, nextPlaylist ? 'playlist' : 'media'));
      nextPlaylist = false;
    }
  }
  return output.join('\n') + '\n';
}
module.exports = { rewritePlaylist };
