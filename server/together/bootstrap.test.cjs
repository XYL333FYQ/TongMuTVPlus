'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const {
  initializeTogetherSecrets,
} = require('../../scripts/together/init.cjs');
test('isolated deployment secrets are durable, distinct and never overwrite existing credentials', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tongmu-secrets-'));
  try {
    initializeTogetherSecrets(directory);
    const first = fs.readFileSync(
      path.join(directory, 'synctv-bridge.env'),
      'utf8'
    );
    const postgres = fs.readFileSync(
      path.join(directory, 'synctv-postgres.env'),
      'utf8'
    );
    const upstream = fs.readFileSync(
      path.join(directory, 'synctv.env'),
      'utf8'
    );
    const root = fs
      .readFileSync(path.join(directory, 'synctv-root-password'), 'utf8')
      .trim();
    assert(first.includes('SYNCTV_ADMIN_PASSWORD=' + root));
    assert(!postgres.includes(root));
    assert(upstream.includes('SYNCTV_DATABASE_URL=postgresql://synctv:'));
    initializeTogetherSecrets(directory);
    assert.equal(
      fs.readFileSync(path.join(directory, 'synctv-bridge.env'), 'utf8'),
      first
    );
    fs.writeFileSync(path.join(directory, 'synctv-bridge.env'), 'changed');
    assert.throws(() => initializeTogetherSecrets(directory), /inconsistent/i);
  } finally {
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(os.tmpdir())
    );
    assert(path.basename(directory).startsWith('tongmu-secrets-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
