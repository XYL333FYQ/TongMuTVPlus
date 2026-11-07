const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../app/src/main/res/raw/legacy_download.js'),
  'utf8'
);

function fixture() {
  let listener;
  const requests = [];
  const saved = [];
  const failures = [];
  const document = {
    addEventListener(type, fn) {
      if (type === 'click') listener = fn;
    },
    createElement() {
      return {
        set href(value) {
          const u = new URL(value, 'https://example.test/page');
          this.protocol = u.protocol;
          this.host = u.host;
          this.hrefValue = u.href;
        },
        get href() {
          return this.hrefValue;
        },
      };
    },
  };
  class XHR {
    constructor() {
      requests.push(this);
    }
    open(method, url) {
      this.method = method;
      this.url = url;
      this.responseURL = url;
    }
    send() {
      this.sent = true;
    }
    abort() {
      this.aborted = true;
    }
  }
  const window = {
    location: { protocol: 'https:', host: 'example.test' },
    __tmContentExport: {
      saveBlob(blob, name) {
        saved.push({ blob, name });
        return Promise.resolve('queued');
      },
    },
    TMShell: {
      legacyDownloadError(scope) {
        failures.push(scope);
      },
    },
  };
  window.top = window;
  vm.runInNewContext(source, {
    window,
    document,
    XMLHttpRequest: XHR,
    Promise,
    URL,
    Number,
    String,
  })('scope');
  function click(url, attrs = {}) {
    const anchor = {
      tagName: 'A',
      parentNode: null,
      href: url,
      hasAttribute: (key) => key === 'download' && attrs.download !== false,
      getAttribute: () => attrs.name || 'test.txt',
    };
    const event = {
      target: anchor,
      button: 0,
      isTrusted: true,
      preventDefault() {
        this.prevented = true;
      },
      ...attrs.event,
    };
    listener(event);
    return event;
  }
  return { requests, saved, failures, click };
}

test('same-origin user download uses authenticated WebView response and native save', async () => {
  const f = fixture();
  assert.equal(f.click('https://example.test/file').prevented, true);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].method, 'GET');
  assert.equal(f.requests[0].responseType, 'blob');
  f.requests[0].status = 200;
  f.requests[0].response = new Blob(['file']);
  f.requests[0].onload();
  await Promise.resolve();
  assert.equal(f.saved.length, 1);
  assert.equal(f.saved[0].name, 'test.txt');
});

test('leaves external links and non-user clicks alone', () => {
  const f = fixture();
  assert.equal(f.click('https://outside.test/file').prevented, undefined);
  assert.equal(
    f.click('https://example.test/file', { event: { isTrusted: false } })
      .prevented,
    undefined
  );
  assert.equal(f.requests.length, 0);
});

test('rejects failed and oversized responses without saving', () => {
  const f = fixture();
  f.click('https://example.test/file');
  f.requests[0].status = 401;
  f.requests[0].onload();
  f.click('https://example.test/file');
  f.requests[1].onprogress({ loaded: 67108865 });
  assert.equal(f.requests[1].aborted, true);
  assert.equal(f.failures.length, 2);
  assert.equal(f.saved.length, 0);
});

test('rejects an external redirect and does not start concurrent downloads', () => {
  const f = fixture();
  f.click('https://example.test/file');
  f.click('https://example.test/file');
  assert.equal(f.requests.length, 1);
  f.requests[0].status = 200;
  f.requests[0].response = new Blob(['file']);
  f.requests[0].responseURL = 'https://outside.test/file';
  f.requests[0].onload();
  assert.equal(f.saved.length, 0);
  assert.equal(f.failures.length, 2);
});
