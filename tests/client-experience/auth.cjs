const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Disposable CI only');
const base = 'http://127.0.0.1:3017',
  out = '/audit/artifacts';
const target = base + '/__audit_telegram';
let activePage;
let currentCase;
const sessions = new WeakMap();
async function activationExpired(context, page) {
  let session = sessions.get(page);
  if (!session) {
    session = await context.newCDPSession(page);
    sessions.set(page, session);
  }
  // Playwright's function evaluation supplies userGesture:true. Observation
  // must not itself renew the activation whose expiry we are checking.
  const { result, exceptionDetails } = await session.send('Runtime.evaluate', {
    expression: 'navigator.userActivation.isActive === false',
    userGesture: false,
    returnByValue: true,
  });
  assert.equal(exceptionDetails, undefined);
  return result.value === true;
}
async function dismiss(page) {
  for (let i = 0; i < 4; i++) {
    const notice = page
      .getByRole('button', { name: '知道了', exact: true })
      .last();
    if (await notice.isVisible()) await notice.click();
    await page.waitForTimeout(100);
  }
}
async function until(check, label) {
  for (let i = 0; i < 60; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out: ' + label);
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const results = [],
    errors = [];
  try {
    for (const platform of [
      'app',
      'desktop',
      'old-app',
      'old-desktop',
      'web',
      'web-no-abort',
    ]) {
      const old = platform.startsWith('old-');
      const web = platform === 'web' || platform === 'web-no-abort';
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block',
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      await context.addInitScript((platform) => {
        if (platform === 'app' || platform === 'old-app')
          window.TMShell = {
            ready() {},
            setSystemBars() {},
            ...(platform === 'app'
              ? { supportsExternalLinks: () => true }
              : {}),
          };
        if (platform === 'desktop' || platform === 'old-desktop')
          window.__tmDesktopInit = true;
        if (platform === 'desktop') window.TMDesktop = { externalLinks: true };
        let config = {};
        Object.defineProperty(window, 'RUNTIME_CONFIG', {
          configurable: true,
          get: () => ({
            ...config,
            ENABLE_TELEGRAM_LOGIN: true,
            ENABLE_REGISTRATION: true,
          }),
          set: (value) => {
            config = value || {};
          },
        });
        sessionStorage.setItem('announcementShown', '1');
        window.__authOpenProof = [];
        const open = window.open;
        window.open = function (url, ...args) {
          // Observe real opening; do not stub the browsing context or record tokens.
          window.__authOpenProof.push({
            path: new URL(url, location.href).pathname,
            active: navigator.userActivation.isActive,
          });
          return open.call(this, url, ...args);
        };
      }, platform);
      const state = {
        mode: 'ok',
        status: 'pending',
        creates: 0,
        polls: 0,
        destinations: 0,
        held: [],
        aborted: [],
      };
      await context.route(
        (url) =>
          [
            '/api/telegram/login/create',
            '/api/telegram/login/status',
            '/__audit_telegram',
          ].includes(url.pathname),
        async (route) => {
          const path = new URL(route.request().url()).pathname;
          if (path === '/__audit_telegram') {
            state.destinations++;
            await route.fulfill({
              contentType: 'text/html',
              body: '<title>Controlled external authentication destination</title><h1>受控登录目标</h1>',
            });
            return;
          }
          const create = path.endsWith('/create'),
            mode = state.mode;
          if (create) state.creates++;
          else state.polls++;
          if (
            (create && mode === 'hold-create') ||
            (!create && mode === 'hold-status')
          )
            await new Promise((resolve) => state.held.push(resolve));
          if (route.request().failure()) return;
          try {
            await route.fulfill(
              create
                ? mode === 'fail'
                  ? { status: 503, json: { error: '受控登录请求失败' } }
                  : mode === 'malformed'
                  ? { json: { token: 'fixture-token' } }
                  : { json: { token: 'fixture-token', deepLink: target } }
                : { json: { status: state.status } }
            );
          } catch (error) {
            if (!route.request().failure()) throw error;
          }
        }
      );
      const page = await context.newPage();
      activePage = page;
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('requestfailed', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/telegram/login/'))
          state.aborted.push(request.failure()?.errorText);
      });
      const themes =
        platform === 'app' || platform === 'desktop'
          ? ['dark', 'light']
          : ['light'];
      for (const theme of themes) {
        currentCase = { platform, theme };
        state.mode = 'ok';
        state.status = 'pending';
        await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
        await dismiss(page);
        const dark = await page.evaluate(() =>
          document.documentElement.classList.contains('dark')
        );
        if (dark !== (theme === 'dark'))
          await page
            .getByRole('button', {
              name: theme === 'dark' ? '切换到深色' : '切换到浅色',
              exact: true,
            })
            .click();
        await page.waitForFunction(
          (dark) =>
            document.documentElement.classList.contains('dark') === dark,
          theme === 'dark'
        );
        if (platform === 'web-no-abort')
          await page.evaluate(() => {
            window.AbortController = undefined;
          });
        const identity = await page.evaluate(() => performance.timeOrigin),
          creates = state.creates;
        let popup;
        const automatic = web ? page.waitForEvent('popup') : null;
        await page
          .getByRole('button', { name: '使用 Telegram 登录', exact: true })
          .click();
        if (web) {
          popup = await automatic;
        } else {
          const action = page.getByRole('button', {
            name: old ? '复制 Telegram 登录链接' : '打开 Telegram',
            exact: true,
          });
          await action.waitFor();
          assert.deepEqual(
            await page.evaluate(() => window.__authOpenProof),
            []
          );
          if (old) {
            const sentinel = 'auth-audit-before-' + platform + '-' + theme;
            await page.evaluate(
              (text) => navigator.clipboard.writeText(text),
              sentinel
            );
            assert.equal(
              await page.evaluate(() => navigator.clipboard.readText()),
              sentinel
            );
          }
          await until(
            () => activationExpired(context, page),
            'old challenge-creation click expires without observation renewing it'
          );
          if (old) {
            await action.click();
            await until(
              async () =>
                (await page.evaluate(() => navigator.clipboard.readText())) ===
                target,
              'actual copied login link'
            );
            assert.deepEqual(
              await page.evaluate(() => window.__authOpenProof),
              []
            );
          } else {
            [popup] = await Promise.all([
              page.waitForEvent('popup'),
              action.click(),
            ]);
            const proof = await page.evaluate(() => window.__authOpenProof);
            assert.deepEqual(proof, [
              { path: '/__audit_telegram', active: true },
            ]);
          }
        }
        if (popup) {
          await popup.getByRole('heading', { name: '受控登录目标' }).waitFor();
          await popup.close();
        }
        assert.equal(
          state.creates,
          creates + 1,
          'Opening/copying must reuse the original challenge'
        );
        assert.equal(
          await page.evaluate(() => performance.timeOrigin),
          identity
        );
        if (platform === 'app' || platform === 'desktop')
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
              path: `${out}/auth-${platform}-${width}-${theme}.png`,
            });
          }
        else {
          const width = platform === 'old-desktop' ? 1280 : 390;
          await page.setViewportSize({ width, height: 900 });
          await page.waitForTimeout(200);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth
            ),
            true
          );
          await page.screenshot({
            path: `${out}/auth-${platform}-${width}-${theme}.png`,
          });
        }
        state.status = 'expired';
        await page.getByText('Telegram 登录已过期', { exact: true }).waitFor();
        assert.equal(
          await page
            .getByRole('button', { name: '打开 Telegram', exact: true })
            .count(),
          0
        );
        assert.equal(
          await page
            .getByRole('button', {
              name: '复制 Telegram 登录链接',
              exact: true,
            })
            .count(),
          0
        );
        assert.equal(
          await page
            .getByRole('button', { name: '使用 Telegram 登录', exact: true })
            .isEnabled(),
          true
        );
        for (const mode of ['fail', 'malformed']) {
          state.mode = mode;
          const polls = state.polls,
            opened = await page.evaluate(() => window.__authOpenProof.length);
          await page
            .getByRole('button', { name: '使用 Telegram 登录', exact: true })
            .click();
          await page
            .getByText(
              mode === 'fail'
                ? '受控登录请求失败（HTTP 503）'
                : 'Telegram 登录请求失败，请稍后重试',
              { exact: true }
            )
            .waitFor();
          assert.equal(
            await page
              .getByRole('button', { name: '使用 Telegram 登录', exact: true })
              .isEnabled(),
            true
          );
          await page.waitForTimeout(2200);
          assert.equal(state.polls, polls);
          assert.equal(
            await page.evaluate(() => window.__authOpenProof.length),
            opened
          );
        }
        results.push({
          platform,
          theme,
          originalDocument: true,
          explicitAction: !web,
          abortApiSimulatedUnavailable: platform === 'web-no-abort',
          realClipboard: old,
          realPopup: !old,
          expiredActionRemoved: true,
          failureRetry: true,
          malformedRejected: true,
        });
      }
      if (platform === 'app')
        for (const mode of ['hold-create', 'hold-status']) {
          currentCase = { platform, cancellation: mode };
          state.mode = mode;
          state.status = 'pending';
          await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
          await dismiss(page);
          await page
            .getByRole('button', { name: '使用 Telegram 登录', exact: true })
            .click();
          await until(
            () => state.held.length === 1,
            'one actual held authentication request'
          );
          const aborted = state.aborted.length;
          await page
            .getByRole('button', { name: '还没有账号？立即注册', exact: true })
            .click();
          await page.waitForURL((url) => url.pathname === '/register');
          await until(
            () => state.aborted.length === aborted + 1,
            'authentication transport aborted on leave'
          );
          assert.match(state.aborted.at(-1), /ABORTED/);
          const polls = state.polls;
          state.held.splice(0).forEach((resolve) => resolve());
          await page.waitForTimeout(2400);
          assert.equal(state.polls, polls);
          assert.deepEqual(
            await page.evaluate(() => window.__authOpenProof),
            []
          );
          results.push({
            platform,
            cancellation: mode,
            actualTransportAborted: true,
            lateReplyIgnored: true,
          });
        }
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      out + '/auth-result.json',
      JSON.stringify(
        {
          source: process.env.UI_SOURCE_SHA,
          shellMarkerSimulated: true,
          controlledAuthApis: true,
          controlledFeatureFlags: true,
          workerBlocked: true,
          realTelegramContacted: false,
          nativeOsAppTested: false,
          confirmationAndOidcNotTested: true,
          results,
          errors,
        },
        null,
        2
      )
    );
    console.log(
      'PASS: actual login page gestures, clipboard, popup, challenge lifetime, failure retry, HTTP cancellation and sixteen screenshots'
    );
  } catch (error) {
    if (activePage && !activePage.isClosed())
      await activePage
        .screenshot({ path: out + '/failure.png' })
        .catch(() => {});
    fs.writeFileSync(out + '/failure.txt', String(error));
    fs.writeFileSync(
      out + '/failure-case.json',
      JSON.stringify(currentCase || {}, null, 2)
    );
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
