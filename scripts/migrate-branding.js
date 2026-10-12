#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const fs = require('node:fs');
const path = require('node:path');
const { name: brandName } = require('../src/lib/brand.json');

// Exact upstream defaults only. A custom name containing one of these words is preserved.
const UPSTREAM_DEFAULT_NAMES = new Set(['MoonTV', 'MoonTVPlus', 'MoonTV Plus']);

function previewBranding(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('管理员配置必须是 JSON 对象。');
  }
  if (
    config.SiteConfig != null &&
    (typeof config.SiteConfig !== 'object' || Array.isArray(config.SiteConfig))
  ) {
    throw new Error('SiteConfig 格式无效，未作修改。');
  }
  const previous = config.SiteConfig?.SiteName;
  const isEmpty =
    previous == null || (typeof previous === 'string' && !previous.trim());
  const changed = isEmpty || UPSTREAM_DEFAULT_NAMES.has(previous);
  return {
    changed,
    previous: previous == null ? null : previous,
    next: changed ? brandName : previous,
    config: changed
      ? { ...config, SiteConfig: { ...config.SiteConfig, SiteName: brandName } }
      : config,
  };
}

async function migrateSqlite({ dbPath, apply = false, backupPath }) {
  const Database = require('better-sqlite3');
  const absolutePath = path.resolve(dbPath);
  if (!fs.existsSync(absolutePath))
    throw new Error('数据库不存在；此脚本不会创建新库。');
  const database = new Database(absolutePath, {
    readonly: !apply,
    fileMustExist: true,
  });
  database.pragma('busy_timeout = 5000');
  try {
    const row = database
      .prepare('SELECT config FROM admin_config WHERE id = 1')
      .get();
    if (!row)
      return {
        changed: false,
        applied: false,
        reason: '尚未保存管理员配置；新安装将使用新默认站名。',
      };
    const preview = previewBranding(JSON.parse(row.config));
    // Only site-name metadata is returned. Full configuration may contain private credentials.
    const report = {
      changed: preview.changed,
      applied: false,
      previous: preview.previous,
      next: preview.next,
    };
    if (!apply || !preview.changed) return report;

    const destination = path.resolve(
      backupPath || `${absolutePath}.brand-backup-${Date.now()}.sqlite`
    );
    if (destination === absolutePath || fs.existsSync(destination)) {
      throw new Error('备份路径必须指向尚不存在的文件，且不能覆盖原库。');
    }
    // SQLite online backup includes committed WAL data; copying only the .db file would not.
    await database.backup(destination);
    database.transaction(() => {
      const current = database
        .prepare('SELECT config FROM admin_config WHERE id = 1')
        .get();
      if (!current || current.config !== row.config) {
        throw new Error('备份期间配置已变化，取消迁移，请重新预览。');
      }
      database
        .prepare(
          'UPDATE admin_config SET config = ?, updated_at = ? WHERE id = 1'
        )
        .run(JSON.stringify(preview.config), Date.now());
    })();
    return { ...report, applied: true, backupPath: destination };
  } finally {
    database.close();
  }
}

function parseArguments(args) {
  const options = {
    dbPath:
      process.env.SQLITE_DB_PATH ||
      path.join(process.cwd(), '.data', 'moontv.db'),
    apply: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') options.apply = true;
    else if (args[i] === '--dry-run') options.apply = false;
    else if (args[i] === '--db' || args[i] === '--backup') {
      const key = args[i] === '--db' ? 'dbPath' : 'backupPath';
      if (!args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error(`${args[i]} 缺少路径。`);
      options[key] = args[++i];
    } else throw new Error(`未知参数：${args[i]}`);
  }
  return options;
}

if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log(
      'node scripts/migrate-branding.js [--db 路径] [--dry-run | --apply] [--backup 备份路径]\n默认仅预览；仅支持本地 SQLite。迁移后重启服务刷新配置缓存。'
    );
  } else {
    migrateSqlite(parseArguments(process.argv.slice(2)))
      .then((report) => console.log(JSON.stringify(report, null, 2)))
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  }
}

module.exports = { previewBranding, migrateSqlite, parseArguments };
