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
let activePage;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const results = [],
    errors = [];
  try {
    for (const platform of ['app', 'desktop', 'web']) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        hasTouch: true,
        serviceWorkers: 'block',
      });
      await context.addInitScript((platform) => {
        if (platform === 'app')
          window.TMShell = { ready() {}, setSystemBars() {} };
        if (platform === 'desktop') window.__tmDesktopInit = true;
        sessionStorage.setItem('announcementShown', '1');
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
      const mutations = [];
      page.on('websocket', (socket) =>
        socket.on('framesent', (frame) => {
          // Keep event names only, never socket payloads, cookies or identifiers.
          const event = String(frame.payload).match(
            /"(room:(?:create|join|settings))"/
          );
          if (event) mutations.push(event[1]);
        })
      );
      await page.goto(base + '/watch-room', { waitUntil: 'domcontentloaded' });
      for (let i = 0; i < 4; i++) {
        const dismiss = page
          .getByRole('button', { name: '知道了', exact: true })
          .last();
        if (await dismiss.isVisible()) await dismiss.click();
        await page.waitForTimeout(150);
      }
      await page.setViewportSize({
        width: platform === 'desktop' ? 1280 : 390,
        height: 900,
      });
      const identity = await page.evaluate(() => performance.timeOrigin);
      await page.evaluate(() => {
        window.__formProbe = { invalid: 0, submit: 0 };
        document.addEventListener(
          'invalid',
          () => window.__formProbe.invalid++,
          true
        );
        document.addEventListener(
          'submit',
          () => window.__formProbe.submit++,
          true
        );
      });
      for (const kind of ['create', 'join']) {
        await page
          .getByRole('button', {
            name: kind === 'create' ? '创建房间' : '用邀请码加入',
            exact: true,
          })
          .first()
          .click();
        const dialog = page.getByRole('dialog', {
          name: kind === 'create' ? '创建房间' : '加入朋友的房间',
          exact: true,
        });
        await dialog.waitFor();
        const field = dialog.getByLabel(
          kind === 'create' ? '房间名称' : '房间号',
          { exact: true }
        );
        const submit = dialog.getByRole('button', {
          name: kind === 'create' ? '创建并进入' : '进入房间',
          exact: true,
        });
        await field.fill('仅验收不提交');
        // A disconnected service must not mask the empty-field behavior.
        await submit.waitFor();
        await page.waitForFunction(() => {
          const form = document.querySelector('dialog[open] form');
          return (
            form &&
            [...form.querySelectorAll('button')].some(
              (button) =>
                /创建并进入|进入房间/.test(button.textContent) &&
                !button.disabled
            )
          );
        });
        for (const blank of ['', '   ']) {
          await field.fill(blank);
          assert.equal(await submit.isDisabled(), true);
          await field.press('Enter');
          await page.waitForTimeout(200);
          assert.deepEqual(
            await page.evaluate(() => window.__formProbe),
            { invalid: 0, submit: 0 },
            'Empty field must not trigger native constraint UI or a submit'
          );
          assert.equal(await dialog.isVisible(), true);
        }
        await page.screenshot({
          path: `${out}/room-form-${platform}-${kind}.png`,
        });
        await field.fill('仅验收不提交');
        assert.equal(await submit.isEnabled(), true);
        if (platform === 'app') {
          assert.equal(await page.evaluate(() => window.__tmShellBack()), true);
        } else await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(
          await page.evaluate(() => performance.timeOrigin),
          identity
        );
        assert.equal(new URL(page.url()).pathname, '/watch-room');
        results.push({
          platform,
          kind,
          emptySubmitDisabled: true,
          nativeValidationEvents: 0,
          noSubmit: true,
          originalDocument: true,
          closeVia:
            platform === 'app'
              ? 'simulated-native-callback-real-react-dialog'
              : 'actual-escape',
        });
      }
      assert.deepEqual(
        mutations,
        [],
        'This audit must not create, join or change a room'
      );
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      out + '/room-forms-result.json',
      JSON.stringify(
        {
          source: process.env.UI_SOURCE_SHA,
          shellMarkerSimulated: true,
          workerBlocked: true,
          realRoomService: true,
          nativeDeviceTested: false,
          pickerTested: false,
          results,
          errors,
        },
        null,
        2
      )
    );
    console.log(
      'PASS: real create/join forms cannot show empty-field native bubbles through these controls, no mutation, actual dialog closure'
    );
  } catch (error) {
    if (activePage && !activePage.isClosed())
      await activePage
        .screenshot({ path: out + '/failure.png' })
        .catch(() => {});
    fs.writeFileSync(out + '/failure.txt', String(error));
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
