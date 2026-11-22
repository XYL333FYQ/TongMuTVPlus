'use strict';
// 本机测试站：先用测试账号文件（默认 .claude/test.env，TM_TEST_ENV 可以换，不进 git）
// 强制覆盖账号、签名密钥和数据库路径，再启动正常的 server.js。
// 不读、不改用户自己的 .env 里的这几项；数据写进测试账号文件指定的数据库。
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '../..');
const envFile = path.resolve(
  root,
  process.env.TM_TEST_ENV ?? '.claude/test.env'
);
const values = parseEnv(fs.readFileSync(envFile, 'utf8'));
for (const key of ['USERNAME', 'PASSWORD', 'AUTH_SECRET', 'SQLITE_DB_PATH']) {
  process.env[key] = values[key];
}
process.env.PORT = process.env.PORT || '3100';
process.chdir(root);
require(path.join(root, 'server.js'));
