const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(
  path.join(__dirname, '../app/src/main/res/raw/content_export.js'),
  'utf8'
);
function host() {
  const calls = { begin: [], chunks: [], done: [], cancel: [] };
  let count = 0;
  const window = {
    TMShell: {
      beginContentExport(scope, raw) {
        const request = JSON.parse(raw);
        assert.equal(request.nonce, scope);
        calls.begin.push(request);
      },
      writeContentExport(nonce, id, sequence, base64) {
        const data = Buffer.from(base64, 'base64');
        calls.chunks.push({ nonce, id, sequence, data });
        count += data.length;
        return count;
      },
      completeContentExport(nonce, id) {
        calls.done.push({ nonce, id });
        return true;
      },
      cancelContentExport(nonce, id) {
        calls.cancel.push({ nonce, id });
      },
    },
  };
  window.top = window;
  class Reader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result =
          'data:application/octet-stream;base64,' +
          Buffer.from(buffer).toString('base64');
        this.onload();
      });
    }
    abort() {
      this.aborted = true;
    }
  }
  const context = vm.createContext({
    window,
    Blob,
    FileReader: Reader,
    Promise,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    Error,
  });
  const install = (nonce) =>
    vm.runInContext(
      '(' +
        script.trim().replace(/;$/, '') +
        ')(' +
        JSON.stringify(nonce) +
        ');',
      context
    );
  install('a'.repeat(64));
  return { window, calls, install };
}
test('no bytes before native consent; exact 64KiB ACKed chunks and one completion', async () => {
  const { window, calls } = host();
  const bytes = Buffer.alloc(65536 * 2 + 17);
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
  const saved = window.__tmContentExport.saveBlob(
    new Blob([bytes]),
    '书名.pdf'
  );
  saved.catch(() => undefined);
  assert.equal(calls.begin.length, 1);
  assert.equal(calls.chunks.length, 0);
  const request = calls.begin[0];
  assert.equal(request.bytes, bytes.length);
  assert.equal(request.name, '书名.pdf');
  window.__tmContentExport.reply(request.id, 'ready');
  window.__tmContentExport.reply(request.id, 'ready');
  assert.equal(await saved, 'queued');
  assert.deepEqual(
    calls.chunks.map((chunk) => chunk.sequence),
    [0, 1, 2]
  );
  assert.deepEqual(
    calls.chunks.map((chunk) => chunk.data.length),
    [65536, 65536, 17]
  );
  assert.deepEqual(
    Buffer.concat(calls.chunks.map((chunk) => chunk.data)),
    bytes
  );
  assert(
    calls.chunks.every(
      (chunk) => chunk.nonce === 'a'.repeat(64) && chunk.id === request.id
    )
  );
  assert.equal(calls.done.length, 1);
  assert.equal(calls.cancel.length, 0);
});
test('native cancellation settles without bytes or completion', async () => {
  const { window, calls } = host();
  const saved = window.__tmContentExport.saveBlob(
    new Blob(['private']),
    'book.pdf'
  );
  window.__tmContentExport.reply(calls.begin[0].id, 'cancelled');
  assert.equal(await saved, 'cancelled');
  assert.equal(calls.chunks.length, 0);
  assert.equal(calls.done.length, 0);
});
test('wrong request cannot authorize a transfer and a second pending transfer is rejected', async () => {
  const { window, calls } = host();
  const saved = window.__tmContentExport.saveBlob(
    new Blob(['private']),
    'book.pdf'
  );
  window.__tmContentExport.reply('foreign', 'ready');
  assert.equal(calls.chunks.length, 0);
  await assert.rejects(
    window.__tmContentExport.saveBlob(new Blob(['other']), 'other.pdf'),
    /busy/i
  );
  window.__tmContentExport.reply(calls.begin[0].id, 'cancelled');
  assert.equal(await saved, 'cancelled');
});
test('a missing byte ACK cancels and never publishes completion', async () => {
  const { window, calls } = host();
  window.TMShell.writeContentExport = () => -1;
  const saved = window.__tmContentExport.saveBlob(
    new Blob(['private']),
    'book.pdf'
  );
  window.__tmContentExport.reply(calls.begin[0].id, 'ready');
  await assert.rejects(saved, /export/i);
  assert.equal(calls.done.length, 0);
  assert.equal(calls.cancel.length, 1);
});
test('does not expose content export to another frame or an old host', () => {
  for (const window of [
    { TMShell: {}, top: null },
    { TMShell: { beginContentExport() {} }, top: {} },
  ]) {
    vm.runInNewContext(script, { window })('a'.repeat(64));
    assert.equal(window.__tmContentExport, undefined);
  }
});
