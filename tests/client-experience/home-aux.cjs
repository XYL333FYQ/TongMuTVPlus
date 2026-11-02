const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
assert.equal(
  process.env.GITHUB_ACTIONS,
  'true',
  'Only run this isolated acceptance in CI'
);
let activePage;
const env = Object.fromEntries(
  fs
    .readFileSync('/audit/audit.env', 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    })
);
const base = 'http://127.0.0.1:3017',
  out = '/audit/artifacts';
const banner = (title) => ({
  id: 1,
  title,
  overview: '隔离验收资料',
  poster_path: '/logo.png',
  backdrop_path: null,
  genre_ids: [],
  vote_average: 7,
  release_date: '2026-01-01',
});
const movies = Array.from({ length: 20 }, (_, index) => ({
  id: String(index),
  title: '验收片目 ' + index,
  poster: '/logo.png',
  rate: '7.5',
  year: '2026',
}));
function seed(platform) {
  if (platform === 'app')
    window.TMShell = { ready() {}, setSystemBars() {}, haptic() {} };
  if (platform === 'desktop') window.__tmDesktopInit = true;
  localStorage.setItem('enableTrailers', 'false');
  localStorage.setItem('doubanDataSource', 'direct');
  localStorage.setItem('doubanDataSourceBackup', 'direct');
  localStorage.setItem(
    'homeModules',
    JSON.stringify([
      { id: 'hotMovies', name: '热门电影', enabled: true, order: 0 },
    ])
  );
  sessionStorage.setItem('announcementShown', '1');
  window.__refreshErrors = [];
  addEventListener('globalError', (event) =>
    window.__refreshErrors.push(event.detail?.message)
  );
}
async function until(check, label) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out: ' + label);
}
async function login(context) {
  assert.equal(
    (
      await context.request.post(base + '/api/login', {
        data: { username: env.USERNAME, password: env.PASSWORD },
      })
    ).status(),
    200
  );
}
async function attach(page) {
  const state = {
    mode: 'initial',
    label: '初始',
    bannerRequests: 0,
    roomRequests: 0,
    roomAt: 0,
    held: [],
    aborted: [],
  };
  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname;
    if (['/api/tmdb/trending', '/api/rooms'].includes(path))
      state.aborted.push({ path, error: request.failure()?.errorText });
  });
  await page.route(
    (url) =>
      url.pathname === '/api/tmdb/trending' ||
      (url.pathname === '/api/rooms' &&
        url.searchParams.get('mode') === 'mine'),
    async (route) => {
      const kind =
        new URL(route.request().url()).pathname === '/api/tmdb/trending'
          ? 'banner'
          : 'rooms';
      if (kind === 'banner') state.bannerRequests++;
      else {
        state.roomRequests++;
        state.roomAt = Date.now();
      }
      const mode = state.mode,
        label = state.label;
      if (mode === 'hold') {
        await new Promise((resolve) => state.held.push({ kind, resolve }));
        if (route.request().failure()) return;
      }
      try {
        await route.fulfill(
          mode === 'fail'
            ? { status: 503, json: { error: 'Controlled audit failure' } }
            : {
                json:
                  kind === 'banner'
                    ? {
                        code: 200,
                        source: 'TX',
                        list: [
                          banner(mode === 'hold' ? '迟到推荐' : '推荐' + label),
                        ],
                      }
                    : {
                        rooms: [
                          {
                            id: 'audit-summary',
                            name: mode === 'hold' ? '迟到摘要' : '房间' + label,
                            memberCount: 3,
                          },
                        ],
                      },
              }
        );
      } catch (error) {
        if (!route.request().failure()) throw error;
      }
    }
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/douban'),
    (route) => route.fulfill({ json: { code: 200, list: movies } })
  );
  await page.route(
    (url) => ['/calendar', '/api/bangumi/calendar'].includes(url.pathname),
    (route) => route.fulfill({ json: [] })
  );
  await page.route(
    (url) =>
      ['/api/tmdb/upcoming', '/api/duanju/recommends'].includes(url.pathname),
    (route) => route.fulfill({ json: { code: 200, data: [] } })
  );
  return state;
}
async function cachedBanner(page) {
  await page.evaluate(
    (item) =>
      localStorage.setItem(
        'banner_trending_cache_TX',
        JSON.stringify({ data: [item], timestamp: Date.now() })
      ),
    banner('推荐缓存')
  );
}
async function dismissNotices(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const notice = page
      .getByRole('button', { name: '知道了', exact: true })
      .last();
    if (await notice.isVisible()) await notice.click();
    await page.waitForTimeout(200);
  }
}
async function pull(context, page) {
  await page.evaluate(() => {
    document.activeElement?.blur();
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(250);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 12, y: 185 }],
  });
  for (let index = 1; index <= 10; index++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 12, y: 185 + index * 18 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await cdp.detach();
}
async function settled(page) {
  await page.waitForFunction(
    () => document.querySelector('.tm-ptr')?.style.opacity === '0'
  );
}
async function media(page, origin) {
  const value = await page.evaluate(() => ({
    same: window.__auditVideo === document.querySelector('video'),
    connected: window.__auditVideo?.isConnected,
    paused: window.__auditVideo?.paused,
    decoded: window.__auditVideo?.videoWidth > 0,
    origin: performance.timeOrigin,
    src: window.__auditVideo?.currentSrc,
    count: document.querySelectorAll('video').length,
    restarts: window.__auditRestarts,
    sameNav: window.__auditNav === document.querySelector('.tm-mobile-nav'),
  }));
  assert.equal(value.same, true);
  assert.equal(value.connected, true);
  assert.equal(value.paused, false);
  assert.equal(value.decoded, true);
  assert.equal(value.origin, origin.origin);
  assert.equal(value.src, origin.src);
  assert.equal(value.count, 1);
  assert.equal(value.restarts, 0);
  assert.equal(value.sameNav, true);
  return value;
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: true,
    serviceWorkers: 'block',
  });
  await context.addInitScript(seed, 'app');
  await login(context);
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  activePage = page;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = await attach(page);
  await page.goto(base + '/?open=directplay', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL((url) => !url.searchParams.has('open'));
  await page
    .getByPlaceholder('https://example.com/video.m3u8')
    .fill(base + '/__audit-flower.webm');
  await page
    .locator('[aria-labelledby="home-direct-play-title"]')
    .getByRole('button', { name: '播放', exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === '/play');
  await page.waitForFunction(
    () => document.querySelector('video')?.videoWidth > 0
  );
  const origin = await page.evaluate(async () => {
    const video = document.querySelector('video');
    video.muted = true;
    video.loop = true;
    await video.play();
    window.__auditVideo = video;
    window.__auditNav = document.querySelector('.tm-mobile-nav');
    window.__auditRestarts = 0;
    video.addEventListener('loadstart', () => window.__auditRestarts++);
    return { origin: performance.timeOrigin, src: video.currentSrc };
  });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 390, height: 900 });
  await dismissNotices(page);
  const cancel = page
    .locator('[aria-labelledby="home-direct-play-title"]')
    .getByRole('button', { name: '取消', exact: true });
  if (await cancel.isVisible()) await cancel.click();
  const nav = () => page.locator('.tm-mobile-nav');
  const results = [];
  for (const theme of ['dark', 'light']) {
    if (new URL(page.url()).pathname !== '/my') {
      await nav().getByRole('link', { name: '我的', exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/my');
    }
    await page
      .getByRole('radiogroup', { name: '外观' })
      .getByRole('radio', {
        name: theme === 'dark' ? '深色' : '浅色',
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (dark) => document.documentElement.classList.contains('dark') === dark,
      theme === 'dark'
    );
    await cachedBanner(page);
    state.mode = 'initial';
    state.label = '初始';
    await nav().getByRole('link', { name: '发现', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page
      .getByRole('heading', { name: '推荐缓存', exact: true })
      .waitFor();
    await page.getByText('房间初始', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.tmPlatform),
      'app'
    );
    const before = { banner: state.bannerRequests, rooms: state.roomRequests };
    state.mode = 'fresh';
    state.label = '更新' + theme;
    await pull(context, page);
    await settled(page);
    await page
      .getByRole('heading', { name: '推荐更新' + theme, exact: true })
      .waitFor();
    await page.getByText('房间更新' + theme, { exact: true }).waitFor();
    assert(
      state.bannerRequests > before.banner && state.roomRequests > before.rooms
    );
    await media(page, origin);
    for (const width of [390, 820, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(600);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        ),
        false
      );
      await media(page, origin);
      await page.screenshot({
        path: out + '/home-aux-' + width + '-' + theme + '.png',
      });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    state.mode = 'fail';
    await pull(context, page);
    await settled(page);
    const failure = page.getByText('暂时无法刷新，请稍后再试。', {
      exact: true,
    });
    await failure.waitFor();
    assert.equal(await failure.count(), 1);
    await page
      .getByRole('heading', { name: '推荐更新' + theme, exact: true })
      .waitFor();
    await page.getByText('房间更新' + theme, { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__refreshErrors), []);
    await media(page, origin);
    await page.screenshot({ path: out + '/home-aux-failed-' + theme + '.png' });
    await failure.waitFor({ state: 'hidden' });
    state.mode = 'hold';
    state.held.length = 0;
    const abortBefore = state.aborted.length;
    await pull(context, page);
    await until(
      () => new Set(state.held.map((value) => value.kind)).size === 2,
      'both actual auxiliary refresh requests'
    );
    await nav().getByRole('link', { name: '我的', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/my');
    await until(
      () =>
        new Set(
          state.aborted
            .slice(abortBefore)
            .filter((value) => /ABORTED/.test(value.error))
            .map((value) => value.path)
        ).size === 2,
      'both real transports aborted'
    );
    state.held.splice(0).forEach((value) => value.resolve());
    state.mode = 'initial';
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('banner_trending_cache_TX')).data[0]
            .title
      ),
      '推荐更新' + theme
    );
    await media(page, origin);
    assert.deepEqual(await page.evaluate(() => window.__refreshErrors), []);
    results.push({
      theme,
      freshAuxiliaryRequests: true,
      retainedOnFailure: true,
      singleFeedback: true,
      bothTransportsAborted: true,
      lateCacheWriteRejected: true,
      samePlayingMedia: true,
    });
  }
  await context.close();
  const isolation = [];
  for (const platform of ['web', 'desktop']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      hasTouch: true,
      serviceWorkers: 'block',
    });
    await context.addInitScript(seed, platform);
    await login(context);
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', (error) => errors.push(error.message));
    activePage = page;
    const state = await attach(page);
    await page.goto(base + '/my', { waitUntil: 'domcontentloaded' });
    await cachedBanner(page);
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await dismissNotices(page);
    await page
      .getByRole('heading', { name: '推荐缓存', exact: true })
      .waitFor();
    await page.getByText('房间初始', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.tmPlatform),
      platform
    );
    assert.equal(await page.locator('.tm-ptr').count(), 0);
    const before = { banner: state.bannerRequests, rooms: state.roomRequests };
    const origin = await page.evaluate(() => performance.timeOrigin);
    state.mode = 'fresh';
    state.label = '不应手动更新';
    await pull(context, page);
    await page.waitForTimeout(500);
    assert.equal(state.bannerRequests, before.banner);
    assert.equal(state.roomRequests, before.rooms);
    assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
    isolation.push({ platform, noAppRefresh: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + '/home-aux-result.json',
    JSON.stringify(
      {
        source: process.env.UI_SOURCE_SHA,
        fixtures: true,
        shellMarkerSimulated: true,
        workerBlocked: true,
        results,
        isolation,
        errors,
      },
      null,
      2
    )
  );
  await browser.close();
  console.log(
    'PASS: actual home pull, both data surfaces, failures, transport cancellation, playing singleton and six width/theme screenshots'
  );
})().catch(async (error) => {
  if (activePage && !activePage.isClosed()) {
    await activePage
      .screenshot({ path: out + '/failure.png' })
      .catch(() => undefined);
    await fs.promises
      .writeFile(
        out + '/failure.json',
        JSON.stringify(
          { error: error.message, path: new URL(activePage.url()).pathname },
          null,
          2
        )
      )
      .catch(() => undefined);
  }
  console.error(error.stack);
  process.exit(1);
});
