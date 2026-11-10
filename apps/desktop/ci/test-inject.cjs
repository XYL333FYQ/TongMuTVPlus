const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Stop after the bootstrap's public capability declaration. Native handoff is
// independently tested by actual user clicks in the Windows smoke workflow.
const stop = new Error('Bootstrap declaration captured');
const navigator = { userActivation: { isActive: false } };
const window = {
  addEventListener() {
    throw stop;
  },
};
try {
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../src-tauri/src/inject.js'), 'utf8'),
    { window, navigator }
  );
} catch (error) {
  if (error !== stop) throw error;
}
assert.equal(window.__tmDesktopInit, true);
assert.equal(window.TMDesktop.build, '__BUILD__');
assert.equal(window.TMDesktop.externalLinks, true);
async function testUpdate() {
  const calls = [];
  window.__TAURI_INTERNALS__ = {
    invoke(command, args) {
      calls.push([command, Object.keys(args)]);
      return Promise.reject(new Error('host rejected'));
    },
  };
  await assert.rejects(window.TMDesktop.installUpdate(), /需要点击/);
  assert.equal(calls.length, 0);
  navigator.userActivation.isActive = true;
  await assert.rejects(
    window.TMDesktop.installUpdate('https://untrusted.test/setup.exe'),
    /host rejected/
  );
  assert.deepEqual(calls, [['tm_client_update', []]]);
  console.log('PASS: external links and gesture-gated, argument-free update');
}
testUpdate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
