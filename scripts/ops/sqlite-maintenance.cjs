'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

function digest(filename) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filename, 'r');
  const buffer = Buffer.alloc(131072);
  try {
    let size;
    while ((size = fs.readSync(descriptor, buffer)) > 0)
      hash.update(buffer.subarray(0, size));
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}
function inspect(filename) {
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  try {
    const checks = db.pragma('quick_check');
    if (checks.length !== 1 || checks[0].quick_check !== 'ok')
      throw new Error('SQLite integrity check failed; no restore performed.');
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all()
      .map((row) => row.name)
      .sort();
    const counts = {};
    for (const table of [
      'users',
      'watch_rooms',
      'watch_room_memberships',
      'watch_room_messages',
      'watch_room_message_cursors',
    ]) {
      if (tables.includes(table))
        counts[table] = db
          .prepare(`SELECT COUNT(*) AS count FROM "${table}"`)
          .get().count;
    }
    return {
      integrity: 'ok',
      bytes: fs.statSync(filename).size,
      sha256: digest(filename),
      counts,
    };
  } finally {
    db.close();
  }
}
async function backup({ dbPath, output }) {
  const source = path.resolve(dbPath);
  const destination = path.resolve(output);
  if (
    source === destination ||
    fs.existsSync(destination) ||
    fs.existsSync(`${destination}.manifest.json`)
  )
    throw new Error(
      'Backup must use a new path different from the source database.'
    );
  if (!fs.existsSync(source))
    throw new Error('Source database does not exist.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const db = new Database(source, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 5000');
  try {
    // Includes committed WAL pages and gives a consistent snapshot while the application runs.
    await db.backup(destination);
    fs.chmodSync(destination, 0o600);
    const report = {
      format: 1,
      createdAt: new Date().toISOString(),
      ...inspect(destination),
    };
    fs.writeFileSync(
      `${destination}.manifest.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 }
    );
    return { backupPath: destination, ...report };
  } finally {
    db.close();
  }
}
function restore({
  backupPath,
  dbPath,
  replaceExisting = false,
  serviceStopped = false,
}) {
  const source = path.resolve(backupPath);
  const destination = path.resolve(dbPath);
  if (source === destination)
    throw new Error('Restore source and target must differ.');
  if (!/\.(db|sqlite|sqlite3)$/i.test(destination))
    throw new Error(
      'Restore target must be an explicit .db/.sqlite/.sqlite3 file.'
    );
  const verification = inspect(source);
  const manifestPath = `${source}.manifest.json`;
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.sha256 !== verification.sha256)
      throw new Error('Backup checksum does not match its manifest.');
  }
  const exists = fs.existsSync(destination);
  if (exists && (!replaceExisting || !serviceStopped))
    throw new Error(
      'Target exists. Stop the service and explicitly pass --replace-existing --service-stopped.'
    );
  const sidecars = ['-wal', '-shm'].map((suffix) => `${destination}${suffix}`);
  if (!exists && sidecars.some((filename) => fs.existsSync(filename)))
    throw new Error(
      'Target has leftover WAL/SHM files. Inspect them before restoring.'
    );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  // A maintenance container can run as root. Preserve the application's file owner.
  const owner = fs.statSync(exists ? destination : path.dirname(destination));
  const lockPath = `${destination}.restore.lock`;
  const lock = fs.openSync(lockPath, 'wx', 0o600);
  const staging = `${destination}.restore-${crypto.randomUUID()}`;
  const moved = [];
  let committed = false;
  let rollbackDirectory = null;
  try {
    fs.copyFileSync(source, staging, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(staging, 0o600);
    if (process.platform !== 'win32' && process.getuid?.() === 0)
      fs.chownSync(staging, owner.uid, owner.gid);
    inspect(staging);
    if (exists) {
      rollbackDirectory = path.join(
        path.dirname(destination),
        `restore-rollback-${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`
      );
      fs.mkdirSync(rollbackDirectory, { mode: 0o700 });
      for (const filename of [destination, ...sidecars])
        if (fs.existsSync(filename)) {
          const oldPath = path.join(rollbackDirectory, path.basename(filename));
          fs.renameSync(filename, oldPath);
          moved.push({ original: filename, oldPath });
        }
    }
    fs.renameSync(staging, destination);
    committed = true;
    const verified = inspect(destination);
    return { restoredPath: destination, rollbackDirectory, ...verified };
  } catch (error) {
    if (committed && fs.existsSync(destination)) fs.unlinkSync(destination);
    for (const item of moved.reverse())
      if (!fs.existsSync(item.original))
        fs.renameSync(item.oldPath, item.original);
    throw error;
  } finally {
    if (fs.existsSync(staging)) fs.unlinkSync(staging);
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}
function argumentsFor(args) {
  const values = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--replace-existing') values.replaceExisting = true;
    else if (args[i] === '--service-stopped') values.serviceStopped = true;
    else if (['--db', '--output', '--from'].includes(args[i])) {
      const key = {
        '--db': 'dbPath',
        '--output': 'output',
        '--from': 'backupPath',
      }[args[i]];
      if (!args[i + 1]) throw new Error(`Missing value for ${args[i]}`);
      values[key] = args[++i];
    } else throw new Error(`Unknown option: ${args[i]}`);
  }
  values.dbPath ||=
    process.env.SQLITE_DB_PATH ||
    path.join(process.cwd(), '.data', 'moontv.db');
  return values;
}

module.exports = { backup, restore, inspect, argumentsFor };
