const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Stop after the bootstrap's public capability declaration. Native handoff is
// independently tested by actual user clicks in the Windows smoke workflow.
const stop = new Error('Bootstrap declaration captured');
const window = {
  addEventListener() {
    throw stop;
  },
};
try {
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../src-tauri/src/inject.js'), 'utf8'),
    { window }
  );
} catch (error) {
  if (error !== stop) throw error;
}
assert.equal(window.__tmDesktopInit, true);
assert.equal(window.TMDesktop.build, '__BUILD__');
assert.equal(window.TMDesktop.externalLinks, true);
console.log(
  'PASS: existing desktop bootstrap advertises its HTTP(S) new-window handler'
);
