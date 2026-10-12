/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const Database = require('better-sqlite3');
const {
  previewBranding,
  migrateSqlite,
  parseArguments,
} = require('./migrate-branding');

function fixture(t, name = 'MoonTVPlus') {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tongmutv-brand-test-')
  );
  t.after(() => {
    const absolute = path.resolve(directory);
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
    assert.ok(path.basename(absolute).startsWith('tongmutv-brand-test-'));
    fs.rmSync(absolute, { recursive: true, force: true });
  });
  const dbPath = path.join(directory, 'original.sqlite');
  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.exec(
    'CREATE TABLE admin_config (id INTEGER PRIMARY KEY, config TEXT, updated_at INTEGER); CREATE TABLE preserved (value TEXT);'
  );
  database.prepare('INSERT INTO admin_config VALUES (1, ?, 123)').run(
    JSON.stringify({
      SiteConfig: { SiteName: name, Announcement: 'keep me' },
      MusicConfig: { Token: 'fixture-private-token' },
    })
  );
  database.prepare('INSERT INTO preserved VALUES (?)').run('committed-in-wal');
  return { directory, dbPath, database };
}

test('exact defaults and empty values migrate; custom names are never substring-replaced', () => {
  for (const SiteName of [
    'MoonTV',
    'MoonTVPlus',
    'MoonTV Plus',
    '',
    '  ',
    null,
    undefined,
  ]) {
    assert.equal(
      previewBranding({ SiteConfig: { SiteName } }).next,
      'TongMuTV Plus'
    );
  }
  for (const SiteName of [
    'My MoonTVPlus Room',
    ' MoonTVPlus ',
    '私人影视站',
    'TongMuTV Plus',
  ]) {
    assert.equal(previewBranding({ SiteConfig: { SiteName } }).changed, false);
  }
});

test('default mode previews without mutating data, creating a backup, or exposing credentials', async (t) => {
  const { directory, dbPath, database } = fixture(t);
  try {
    const result = await migrateSqlite({ dbPath });
    assert.equal(result.changed, true);
    assert.equal(result.applied, false);
    assert.ok(!JSON.stringify(result).includes('fixture-private-token'));
    assert.equal(
      JSON.parse(
        database.prepare('SELECT config FROM admin_config').get().config
      ).SiteConfig.SiteName,
      'MoonTVPlus'
    );
    assert.equal(
      fs.readdirSync(directory).some((name) => name.includes('brand-backup')),
      false
    );
  } finally {
    database.close();
  }
});

test('apply creates a complete WAL-aware backup and preserves all unrelated configuration', async (t) => {
  const { directory, dbPath, database } = fixture(t);
  const backupPath = path.join(directory, 'before.sqlite');
  try {
    const result = await migrateSqlite({ dbPath, apply: true, backupPath });
    assert.equal(result.applied, true);
    const saved = JSON.parse(
      database.prepare('SELECT config FROM admin_config').get().config
    );
    assert.equal(saved.SiteConfig.SiteName, 'TongMuTV Plus');
    assert.equal(saved.SiteConfig.Announcement, 'keep me');
    assert.equal(saved.MusicConfig.Token, 'fixture-private-token');
    const backup = new Database(backupPath, { readonly: true });
    try {
      assert.equal(
        JSON.parse(
          backup.prepare('SELECT config FROM admin_config').get().config
        ).SiteConfig.SiteName,
        'MoonTVPlus'
      );
      assert.equal(
        backup.prepare('SELECT value FROM preserved').get().value,
        'committed-in-wal'
      );
    } finally {
      backup.close();
    }
    const repeated = await migrateSqlite({ dbPath, apply: true });
    assert.equal(repeated.changed, false);
    assert.equal(repeated.applied, false);
    assert.equal(
      fs.readdirSync(directory).filter((name) => name.includes('brand-backup'))
        .length,
      0
    );
  } finally {
    database.close();
  }
});

test('existing backup paths and invalid configuration cancel without modifying the original', async (t) => {
  const { directory, dbPath, database } = fixture(t);
  try {
    const backupPath = path.join(directory, 'do-not-overwrite.sqlite');
    fs.writeFileSync(backupPath, 'keep this backup');
    await assert.rejects(
      migrateSqlite({ dbPath, apply: true, backupPath }),
      /备份路径/
    );
    assert.equal(
      JSON.parse(
        database.prepare('SELECT config FROM admin_config').get().config
      ).SiteConfig.SiteName,
      'MoonTVPlus'
    );
    database.prepare('UPDATE admin_config SET config = ?').run('bad json');
    await assert.rejects(migrateSqlite({ dbPath, apply: true }));
    assert.equal(
      database.prepare('SELECT config FROM admin_config').get().config,
      'bad json'
    );
    assert.equal(fs.readFileSync(backupPath, 'utf8'), 'keep this backup');
  } finally {
    database.close();
  }
});

test('custom site names cause no writes or backups; missing database is not created', async (t) => {
  const { directory, dbPath, database } = fixture(t, 'My MoonTVPlus Room');
  try {
    assert.equal((await migrateSqlite({ dbPath, apply: true })).changed, false);
    assert.equal(
      database.prepare('SELECT updated_at FROM admin_config').get().updated_at,
      123
    );
    const missing = path.join(directory, 'missing.sqlite');
    await assert.rejects(
      migrateSqlite({ dbPath: missing, apply: true }),
      /数据库不存在/
    );
    assert.equal(fs.existsSync(missing), false);
    assert.equal(parseArguments([]).apply, false);
    assert.throws(() => parseArguments(['--db']), /缺少路径/);
  } finally {
    database.close();
  }
});
