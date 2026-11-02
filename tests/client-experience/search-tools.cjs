const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Disposable CI only');
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
const sessions = new WeakMap();
let activePage;
async function pull(context, page) {
  await page.evaluate(() => {
    document.activeElement?.blur();
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(250);
  let cdp = sessions.get(page);
  if (!cdp) {
    cdp = await context.newCDPSession(page);
    sessions.set(page, cdp);
  }
  assert.equal(
    await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
    true
  );
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 12, y: 185 }],
  });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 12, y: 185 + i * 18 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}
async function dismiss(page) {
  for (let i = 0; i < 4; i++) {
    const button = page
      .getByRole('button', { name: '知道了', exact: true })
      .last();
    if (await button.isVisible()) await button.click();
    await page.waitForTimeout(150);
  }
}
function payload(label, kind) {
  return kind === 'pansou'
    ? {
        total: 1,
        merged_by_type: {
          others: [
            {
              note: label,
              url: 'https://example.invalid/file',
              password: '',
              datetime: '',
              source: 'audit',
            },
          ],
        },
      }
    : {
        total: 1,
        page: 1,
        items: [
          {
            title: label,
            guid: label,
            link: 'https://example.invalid/item',
            pubDate: '',
            torrentUrl: '',
            description: '',
            images: [],
          },
        ],
      };
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const results = [],
    errors = [];
  try {
    for (const platform of ['app', 'web', 'desktop']) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        hasTouch: true,
        serviceWorkers: 'block',
      });
      await context.addInitScript((platform) => {
        if (platform === 'app')
          window.TMShell = { ready() {}, setSystemBars() {}, haptic() {} };
        if (platform === 'desktop') window.__tmDesktopInit = true;
        let config = {};
        // Controlled feature flags enable the existing tabs; no real remote index.
        Object.defineProperty(window, 'RUNTIME_CONFIG', {
          configurable: true,
          get: () => ({
            ...config,
            NETDISK_SEARCH_ENABLED: true,
            MAGNET_SEARCH_ENABLED: true,
          }),
          set: (value) => {
            config = value || {};
          },
        });
        localStorage.setItem('acgSearchSource', 'mikan');
        sessionStorage.setItem('announcementShown', '1');
        window.__refreshErrors = [];
        addEventListener('globalError', (event) =>
          window.__refreshErrors.push(event.detail?.message)
        );
      }, platform);
      assert.equal(
        (
          await context.request.post(base + '/api/login', {
            data: { username: env.USERNAME, password: env.PASSWORD },
          })
        ).status(),
        200
      );
      const page = await context.newPage();
      activePage = page;
      page.on('pageerror', (error) => errors.push(error.message));
      const state = {
        mode: 'initial',
        label: '',
        requests: [],
        held: [],
        aborted: [],
      };
      page.on('requestfailed', (request) => {
        if (/\/api\/(pansou\/search|acg\/mikan)/.test(request.url()))
          state.aborted.push(request.failure()?.errorText);
      });
      await page.route(
        (url) =>
          ['/api/pansou/search', '/api/acg/mikan'].includes(url.pathname),
        async (route) => {
          const kind = new URL(route.request().url()).pathname.includes(
            'pansou'
          )
            ? 'pansou'
            : 'acg';
          const mode = state.mode,
            label = state.label;
          state.requests.push({ kind, body: route.request().postDataJSON() });
          if (mode === 'hold')
            await new Promise((resolve) => state.held.push(resolve));
          if (route.request().failure()) return;
          try {
            await route.fulfill(
              mode === 'fail'
                ? { status: 503, json: { error: '受控刷新失败' } }
                : { json: payload(label, kind) }
            );
          } catch (error) {
            if (!route.request().failure() && !page.isClosed()) throw error;
          }
        }
      );
      for (const theme of platform === 'app' ? ['dark', 'light'] : ['light']) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(base + '/my', { waitUntil: 'domcontentloaded' });
        await dismiss(page);
        await page
          .getByRole('radiogroup', { name: '外观' })
          .getByRole('radio', {
            name: theme === 'dark' ? '深色' : '浅色',
            exact: true,
          })
          .click();
        await page.waitForFunction(
          (dark) =>
            document.documentElement.classList.contains('dark') === dark,
          theme === 'dark'
        );
        for (const kind of ['pansou', 'acg']) {
          state.mode = 'initial';
          state.label = kind + '-初始-' + theme;
          await page.goto(
            base + '/search?q=' + encodeURIComponent('电影') + '&type=' + kind,
            { waitUntil: 'domcontentloaded' }
          );
          await dismiss(page);
          await page.getByText(state.label, { exact: true }).waitFor();
          await page.waitForTimeout(500);
          const identity = await page.evaluate(() => performance.timeOrigin);
          await page.setViewportSize({ width: 390, height: 900 });
          const before = state.requests.length;
          state.label = kind + '-更新-' + theme;
          await pull(context, page);
          if (platform !== 'app') {
            await page.waitForTimeout(500);
            assert.equal(
              state.requests.length,
              before,
              'Web/Windows must keep existing refresh behavior'
            );
            assert.equal(
              await page.evaluate(() => performance.timeOrigin),
              identity
            );
            results.push({ platform, kind, isolated: true });
            continue;
          }
          await page.getByText(state.label, { exact: true }).waitFor();
          await page.waitForFunction(
            () => document.querySelector('.tm-ptr')?.style.opacity === '0'
          );
          assert.equal(
            state.requests.length,
            before + 1,
            'One current-tab refresh request'
          );
          assert.equal(state.requests.at(-1).body.keyword, '电影');
          assert.equal(
            await page.evaluate(() => performance.timeOrigin),
            identity
          );
          for (const width of [390, 820, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(200);
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
              ),
              true
            );
            await page.screenshot({
              path: `${out}/search-tools-${kind}-${width}-${theme}.png`,
            });
          }
          await page.setViewportSize({ width: 390, height: 900 });
          state.mode = 'fail';
          await pull(context, page);
          const failure = page.getByText('暂时无法刷新，请稍后再试。', {
            exact: true,
          });
          await failure.waitFor();
          assert.equal(await failure.count(), 1);
          await page.getByText(state.label, { exact: true }).waitFor();
          assert.equal(
            await page.getByText('受控刷新失败', { exact: true }).count(),
            0
          );
          await failure.waitFor({ state: 'hidden' });
          const aborted = state.aborted.length;
          state.mode = 'hold';
          await pull(context, page);
          await page.waitForTimeout(300);
          assert.equal(
            state.held.length,
            1,
            'Current-tab request held for actual abort'
          );
          await page
            .locator('.tm-mobile-nav')
            .getByRole('link', { name: '我的', exact: true })
            .click();
          await page.waitForURL((url) => url.pathname === '/my');
          for (let i = 0; i < 40 && state.aborted.length === aborted; i++)
            await page.waitForTimeout(100);
          assert.equal(
            state.aborted.length,
            aborted + 1,
            'Leaving must abort the real transport'
          );
          assert.match(state.aborted.at(-1), /ABORTED/);
          state.held.splice(0).forEach((resolve) => resolve());
          await page.waitForTimeout(250);
          assert.equal(
            await page.evaluate(() => performance.timeOrigin),
            identity
          );
          assert.deepEqual(
            await page.evaluate(() => window.__refreshErrors),
            []
          );
          results.push({
            platform,
            kind,
            theme,
            refreshed: true,
            failedRetained: true,
            actualTransportCancelled: true,
            originalDocument: true,
          });
        }
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      out + '/search-tools-result.json',
      JSON.stringify(
        {
          source: process.env.UI_SOURCE_SHA,
          shellMarkerSimulated: true,
          controlledFeatureFlags: true,
          fixtureApis: true,
          workerBlocked: true,
          nativeDeviceTested: false,
          results,
          errors,
        },
        null,
        2
      )
    );
    console.log(
      'PASS: actual search tabs, touch refresh, failure retention, transport cancellation, platform isolation and twelve responsive screenshots'
    );
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await activePage
        .screenshot({ path: out + '/failure.png' })
        .catch(() => {});
      fs.writeFileSync(out + '/failure.txt', String(error));
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
