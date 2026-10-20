'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

// pnpm dev 的前置脚本（node -r 加载，先于 server.js 执行）。
//
// 问题：Windows 系统自带环境变量 USERNAME=当前登录名（如 ss）。
// Next 读取 .env 时不会覆盖已有变量，于是服务端把站长认成 Windows 登录名，
// 用 .env 里的 admin 登录后进不了管理面板。
//
// 做法：只在 Windows 上、且 USERNAME 恰好等于系统登录名（说明是系统自带的，
// 不是部署者刻意设置的）时，改用 .env 系列文件里的 USERNAME。
// 读取顺序与 scripts/start-local.cjs、Next 开发环境一致，后者覆盖前者。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseEnv } = require('node:util');

function readEnvFiles(root) {
  let values = {};
  for (const name of [
    '.env',
    '.env.development',
    '.env.local',
    '.env.development.local',
  ]) {
    const file = path.join(root, name);
    if (fs.existsSync(file))
      values = { ...values, ...parseEnv(fs.readFileSync(file, 'utf8')) };
  }
  return values;
}

function applyDevEnv(root = path.resolve(__dirname, '..')) {
  if (process.platform !== 'win32') return;
  let loginName = '';
  try {
    loginName = os.userInfo().username;
  } catch {
    return;
  }
  if (!process.env.USERNAME || process.env.USERNAME !== loginName) return;
  const fromFile = readEnvFiles(root).USERNAME;
  if (fromFile) process.env.USERNAME = fromFile;
}

applyDevEnv();

module.exports = { applyDevEnv };
