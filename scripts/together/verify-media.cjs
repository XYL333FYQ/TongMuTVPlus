'use strict';
// Explicit loopback-only acceptance harness; never run against a production site.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const env = parseEnv(fs.readFileSync(process.argv[2], 'utf8'));
if (env.TOGETHER_TEST_ISOLATED !== 'true' || env.TOGETHER_BACKEND !== 'synctv')
  throw new Error('Isolated test environment required');
const base =
  env.TOGETHER_TEST_ORIGIN || 'http://127.0.0.1:' + (env.PORT || 18300);
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
  throw new Error('Loopback site required');
const fixtures = path.resolve('output/synctv-implementation/media-fixtures');
const suffix = Date.now() + crypto.randomBytes(3).toString('hex');
const source = 'media_accept_' + suffix,
  username = 'media_' + suffix;
const password = crypto.randomBytes(20).toString('hex');
let token = 1,
  fixtureOrigin,
  owner,
  member,
  room,
  addedSource = false,
  addedUser = false;
const results = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, fixtureOrigin);
  if (url.pathname === '/cms') {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        code: 1,
        list: [
          {
            vod_id: 'film',
            vod_name: 'Big Buck Bunny gateway acceptance',
            vod_pic: fixtureOrigin + '/poster.jpg?token=' + token,
            vod_play_url:
              'MP4$' +
              fixtureOrigin +
              '/BigBuckBunny_320x180.mp4?token=' +
              token +
              '#HLS$' +
              fixtureOrigin +
              '/hls/master.m3u8?token=' +
              token,
            vod_year: '2008',
            vod_content: 'Blender open movie',
          },
        ],
      })
    );
    return;
  }
  if (url.searchParams.get('token') !== String(token)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const relative = url.pathname.slice(1);
  if (
    !/^(BigBuckBunny_320x180.mp4|poster.jpg|subtitle.vtt|hls\/(master.m3u8|variant.m3u8|init.mp4|segment-\d+.m4s))$/.test(
      relative
    )
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  const file = path.join(fixtures, relative);
  if (relative.endsWith('.m3u8')) {
    const text = fs
      .readFileSync(file, 'utf8')
      .replace(/^(?!#)(\S+)$/gm, '$1?token=' + token)
      .replace(/URI="([^"]+)"/g, 'URI="$1?token=' + token + '"');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.end(text);
    return;
  }
  const length = fs.statSync(file).size;
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const start = range ? Number(range[1]) : 0,
    end =
      range && range[2] ? Math.min(Number(range[2]), length - 1) : length - 1;
  res.setHeader(
    'Content-Type',
    relative.endsWith('.jpg')
      ? 'image/jpeg'
      : relative.endsWith('.vtt')
      ? 'text/vtt'
      : 'video/mp4'
  );
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', end - start + 1);
  if (range) {
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${length}`);
  }
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file, { start, end }).pipe(res);
});
async function request(url, cookie, method = 'GET', body) {
  return fetch(base + url, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
}
async function ok(url, cookie, method, body) {
  const response = await request(url, cookie, method, body),
    data = await response.json();
  assert.equal(
    response.status,
    200,
    url + ': ' + response.status + ' ' + (data.code || data.error || '')
  );
  return data;
}
async function login(name, pass) {
  const response = await request('/api/login', null, 'POST', {
    username: name,
    password: pass,
  });
  assert.equal(response.status, 200);
  return response.headers
    .getSetCookie()
    .filter((item) => item.startsWith('auth='))
    .map((item) => item.split(';')[0])
    .join('; ');
}
async function mediaGet(url, cookie, range) {
  return fetch(base + url, {
    headers: { Cookie: cookie, ...(range ? { Range: range } : {}) },
    signal: AbortSignal.timeout(60000),
  });
}
async function browserPlayback(descriptors) {
  if (!process.env.TOGETHER_PLAYWRIGHT_MODULE) return;
  const { chromium } = require(process.env.TOGETHER_PLAYWRIGHT_MODULE);
  const browsers = [];
  try {
    for (const [index, cookie] of [owner, member].entries()) {
      const browser = await chromium.launch({
        channel: 'chrome',
        headless: false,
      });
      browsers.push(browser);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      await context.addCookies([
        { name: 'auth', value: cookie.slice('auth='.length), url: base },
      ]);
      const page = await context.newPage();
      // A disposable same-origin media fixture isolates the gateway from the future room UI.
      await page.route('**/__media-gateway-qa', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="en"><title>Isolated media gateway QA</title><body><video controls width="960" muted></video></body></html>',
        })
      );
      await page.goto(base + '/__media-gateway-qa');
      await page.addScriptTag({
        path: require.resolve('hls.js/dist/hls.min.js'),
      });
      for (const descriptor of descriptors) {
        await page.evaluate(
          ({ url, format }) => {
            const video = document.querySelector('video');
            if (window.qaHls) window.qaHls.destroy();
            if (format === 'hls') {
              window.qaHls = new window.Hls();
              window.qaHls.loadSource(url);
              window.qaHls.attachMedia(video);
            } else video.src = url;
          },
          { url: base + descriptor.streamPath, format: descriptor.format }
        );
        await page.waitForFunction(
          () => document.querySelector('video').readyState >= 2,
          { timeout: 30000 }
        );
        await page.locator('video').evaluate((video) => video.play());
        await page.waitForFunction(
          () => document.querySelector('video').currentTime > 2,
          { timeout: 15000 }
        );
        await page.locator('video').evaluate((video) => {
          video.pause();
          video.currentTime = 34;
          video.playbackRate = 1.5;
        });
        await page.waitForFunction(
          () =>
            !document.querySelector('video').seeking &&
            document.querySelector('video').currentTime >= 33.9
        );
        await page.locator('video').evaluate((video) => video.play());
        await page.waitForFunction(
          () => document.querySelector('video').currentTime > 35,
          { timeout: 15000 }
        );
        await page.screenshot({
          path:
            'output/synctv-implementation/media-browser-' +
            index +
            '-' +
            descriptor.format +
            '.png',
        });
      }
    }
    results.push(
      'two independent Chrome browsers decode real gateway MP4/HLS, advance time, pause, seek and resume at 1.5x (QA fixture; no room synchronization claimed)'
    );
  } finally {
    for (const browser of browsers) await browser.close();
  }
}
(async () => {
  await new Promise((resolve) => server.listen(18400, '127.0.0.1', resolve));
  fixtureOrigin = 'http://127.0.0.1:18400';
  owner = await login(env.USERNAME, env.PASSWORD);
  await ok('/api/admin/source', owner, 'POST', {
    action: 'add',
    key: source,
    name: 'Isolated media acceptance',
    api: fixtureOrigin + '/cms',
  });
  addedSource = true;
  await ok('/api/admin/user', owner, 'POST', {
    action: 'add',
    targetUsername: username,
    targetPassword: password,
  });
  addedUser = true;
  member = await login(username, password);
  room = await ok('/api/together/rooms', owner, 'POST', {
    name: 'Media gateway acceptance ' + suffix,
    isPublic: false,
  });
  const register = (index) =>
    ok('/api/together/rooms/' + room.id + '/media', owner, 'POST', {
      source,
      filmId: 'film',
      episodeIndex: index,
      kind: 'movie',
      requestId: 'episode-' + index,
    });
  const mp4 = await register(0);
  assert(mp4.upstreamMediaId?.startsWith('med_'));
  results.push('site MP4 registered with ordinary upstream identity');
  assert.equal((await mediaGet(mp4.streamPath, member)).status, 403);
  results.push('outsider media access denied');
  await ok('/api/together/rooms/' + room.id + '/membership', member, 'PUT', {});
  for (const cookie of [owner, member]) {
    const response = await mediaGet(mp4.streamPath, cookie, 'bytes=0-1023');
    assert.equal(response.status, 206);
    assert.equal((await response.arrayBuffer()).byteLength, 1024);
  }
  results.push('both site accounts receive real MP4 Range bytes');
  const hls = await register(1);
  assert.equal(hls.episodeIndex, 1);
  assert.equal(hls.format, 'hls');
  let response = await mediaGet(hls.streamPath, member);
  assert.equal(response.status, 200);
  const master = await response.text();
  assert(!master.includes('token='));
  const variantPath = master
    .split('\n')
    .find((line) => line.startsWith('/api/together/'));
  response = await mediaGet(variantPath, member);
  assert.equal(response.status, 200);
  const variant = await response.text();
  assert(!variant.includes('token='));
  const segmentPath = variant
    .split('\n')
    .find((line) => line.startsWith('/api/together/'));
  response = await mediaGet(segmentPath, member);
  assert.equal(response.status, 200);
  assert((await response.arrayBuffer()).byteLength > 1000);
  results.push(
    'nested HLS manifests and real segments contain only opaque gateway resources'
  );
  await browserPlayback([mp4, hls]);
  token++;
  response = await mediaGet(mp4.streamPath, member, 'bytes=1024-2047');
  assert.equal(response.status, 206);
  assert.equal((await response.arrayBuffer()).byteLength, 1024);
  response = await mediaGet(segmentPath, member);
  assert.equal(response.status, 200);
  assert((await response.arrayBuffer()).byteLength > 1000);
  results.push(
    'expired MP4 and nested HLS resources refresh without changing episode'
  );
  const repeated = await register(1);
  assert.equal(repeated.id, hls.id);
  assert.equal(repeated.upstreamMediaId, hls.upstreamMediaId);
  results.push('idempotent registration retains the same media and episode');
})()
  .catch((error) => {
    results.push('FAIL: ' + error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (room)
      await request('/api/together/rooms/' + room.id, owner, 'DELETE').catch(
        () => {}
      );
    if (addedUser)
      await request('/api/admin/user', owner, 'POST', {
        action: 'deleteUser',
        targetUsername: username,
      }).catch(() => {});
    if (addedSource)
      await request('/api/admin/source', owner, 'POST', {
        action: 'delete',
        key: source,
      }).catch(() => {});
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    const report = { results, passed: !process.exitCode };
    fs.writeFileSync(
      'output/synctv-implementation/media-integration-results.json',
      JSON.stringify(report, null, 2)
    );
    console.log(JSON.stringify(report, null, 2));
  });
