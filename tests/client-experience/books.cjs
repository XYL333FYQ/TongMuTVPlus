const { chromium } = require('playwright');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
assert.equal(
  process.env.GITHUB_ACTIONS,
  'true',
  'Only run this isolated acceptance in CI'
);
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
const title = '隔离书籍验收',
  filename = title + '.pdf';
const book = {
  id: 'client-pdf',
  sourceId: 'client-audit',
  sourceName: '隔离夹具',
  title,
  author: 'Client audit',
  acquisitionLinks: [
    { href: 'https://fixture.invalid/client.pdf', type: 'application/pdf' },
  ],
};
// One valid page, fixed ASCII stream and exact xref offsets; no embedded links/scripts.
function pdf() {
  const stream = 'BT /F1 18 Tf 40 160 Td (TongMu PDF acceptance) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let text = '%PDF-1.4\n',
    offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(text));
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(text);
  text += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((value) => String(value).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(text);
}
const bytes = pdf();
let activePage;
async function dismiss(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const notice = page
      .getByRole('button', { name: '知道了', exact: true })
      .last();
    if (await notice.isVisible()) await notice.click();
    await page.waitForTimeout(150);
  }
}
async function download(page, context, action, expected, identity) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    action.click(),
  ]);
  assert.equal(file.suggestedFilename(), expected);
  assert.equal(await file.failure(), null);
  assert.deepEqual(fs.readFileSync(await file.path()), bytes);
  assert.equal(context.pages().length, 1, 'No Blob popup in the desktop host');
  assert.equal(
    await page.evaluate(() => performance.timeOrigin),
    identity,
    'Download must retain the document'
  );
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const results = [],
    errors = [];
  for (const platform of ['desktop', 'web', 'app']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
      serviceWorkers: 'block',
    });
    await context.addInitScript((platform) => {
      if (platform === 'desktop') window.__tmDesktopInit = true;
      if (platform === 'app')
        window.TMShell = { ready() {}, setSystemBars() {} };
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
    page.setDefaultTimeout(25000);
    page.on('pageerror', (error) => errors.push(error.message));
    let requests = 0;
    await page.route(
      (url) =>
        url.pathname === '/api/books/detail' ||
        url.pathname === '/api/books/read/manifest' ||
        url.pathname === '/api/books/file',
      async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        if (path === '/api/books/file') {
          requests++;
          assert.equal(request.method(), 'POST');
          const body = request.postDataJSON();
          assert.equal(body.sourceId, book.sourceId);
          assert.equal(body.bookId, book.id);
          assert.equal(body.format, 'pdf');
          assert.equal(body.href, book.acquisitionLinks[0].href);
          await route.fulfill({
            status: 200,
            headers: {
              'content-type': 'application/pdf',
              'content-length': String(bytes.length),
              'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
                filename
              )}`,
            },
            body: bytes,
          });
        } else
          await route.fulfill({
            json: path.endsWith('/manifest')
              ? {
                  book,
                  format: 'pdf',
                  acquisitionHref: book.acquisitionLinks[0].href,
                }
              : book,
          });
      }
    );
    for (const theme of platform === 'desktop'
      ? ['dark', 'light']
      : ['light']) {
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
        (dark) => document.documentElement.classList.contains('dark') === dark,
        theme === 'dark'
      );
      await page.goto(
        base + '/books/detail?sourceId=client-audit&bookId=client-pdf',
        { waitUntil: 'domcontentloaded' }
      );
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.dataset.tmPlatform),
        platform
      );
      const action = page.getByRole('button', {
        name: platform === 'desktop' ? '保存后阅读' : '打开',
        exact: true,
      });
      await action.waitFor();
      assert.equal(
        requests,
        0,
        'Opening details must not download the file automatically'
      );
      const identity = await page.evaluate(() => performance.timeOrigin);
      await download(
        page,
        context,
        platform === 'desktop'
          ? action
          : page.getByRole('button', { name: '下载文件', exact: true }),
        filename,
        identity
      );
      assert.equal(
        requests,
        1,
        'Exactly one authenticated-response request per action'
      );
      if (platform === 'desktop') {
        for (const width of [390, 820, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await action.scrollIntoViewIfNeeded();
          await page.waitForTimeout(400);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth
            ),
            false
          );
          await page.screenshot({
            path: `${out}/books-detail-${width}-${theme}.png`,
          });
        }
      }
      await page.goto(
        base + '/books/read?sourceId=client-audit&bookId=client-pdf',
        { waitUntil: 'domcontentloaded' }
      );
      const pdfLink = page.getByRole('link', {
        name: platform === 'desktop' ? '保存后阅读' : '下载 PDF',
        exact: true,
      });
      await pdfLink.waitFor();
      const readerIdentity = await page.evaluate(() => {
        window.__readerFrame = document.querySelector('iframe');
        return performance.timeOrigin;
      });
      const before = requests;
      await download(page, context, pdfLink, filename, readerIdentity);
      assert.equal(
        requests,
        before,
        'The reader exports its existing Blob without re-fetching'
      );
      assert.equal(
        await page.evaluate(
          () => window.__readerFrame === document.querySelector('iframe')
        ),
        true
      );
      if (platform === 'desktop')
        assert.equal(
          await page
            .getByRole('link', { name: '新窗口打开', exact: true })
            .count(),
          0
        );
      else
        await page
          .getByRole('link', { name: '新窗口打开', exact: true })
          .waitFor();
      results.push({
        platform,
        theme,
        detailDownloadBytes: true,
        oneDetailRequest: true,
        readerReusesBlob: true,
        sameDocuments: true,
        sameReaderFrame: true,
      });
      requests = 0;
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(out + '/book-fixture.pdf', bytes);
  fs.writeFileSync(
    out + '/books-result.json',
    JSON.stringify(
      {
        source: process.env.UI_SOURCE_SHA,
        fixtures: true,
        shellMarkerSimulated: true,
        workerBlocked: true,
        nativeOsReaderTested: false,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        results,
        errors,
      },
      null,
      2
    )
  );
  await browser.close();
  console.log(
    'PASS: actual books details/reader, PDF bytes, no duplicate request, unchanged documents and web/app actions'
  );
})().catch(async (error) => {
  if (activePage && !activePage.isClosed())
    await activePage
      .screenshot({ path: out + '/books-failure.png' })
      .catch(() => undefined);
  fs.writeFileSync(
    out + '/books-failure.json',
    JSON.stringify({ error: error.message }, null, 2)
  );
  console.error(error.stack);
  process.exit(1);
});
