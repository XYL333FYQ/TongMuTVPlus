// 端到端脚本共用的环境：仓库根目录、测试站地址、Chrome 路径、测试账号、房间号、测试片。
//
// 账号密码只从被 git 忽略的文件读（默认 .claude/test.env，TM_TEST_ENV 可以换），绝不写进仓库。
// 房间号和测试片是本机生成的，也放在被 git 忽略的 .claude/ 里。

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const BASE = process.env.SNAP_BASE || 'http://localhost:3100';
export const CHROME =
  process.env.CHROME_PATH ??
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

export const TEST_ENV_FILE = path.resolve(
  ROOT,
  process.env.TM_TEST_ENV ?? '.claude/test.env'
);
const ROOM_FILE = path.join(ROOT, '.claude/test-room.txt');
const MEDIA_FILE = path.join(ROOT, '.claude/test-media/sync-test.wav');

/** 测试账号：USERNAME / PASSWORD（站长）、TEST_MEMBER_USERNAME / TEST_MEMBER_PASSWORD（第二个账号） */
export function readTestEnv() {
  if (!fs.existsSync(TEST_ENV_FILE)) {
    throw new Error(
      `没有测试账号文件 ${TEST_ENV_FILE}：照 scripts/e2e/test.env.example 建一个（不进 git）`
    );
  }
  return parseEnv(fs.readFileSync(TEST_ENV_FILE, 'utf8'));
}

/** seed-test.mjs 建好的测试房间号 */
export function readRoomId() {
  if (!fs.existsSync(ROOM_FILE)) {
    throw new Error('还没有测试房间：先运行 node scripts/e2e/seed-test.mjs');
  }
  return fs.readFileSync(ROOM_FILE, 'utf8').trim();
}

export function writeRoomId(roomId) {
  fs.mkdirSync(path.dirname(ROOM_FILE), { recursive: true });
  fs.writeFileSync(ROOM_FILE, roomId);
}

/** 200 秒、8 kHz、8 位单声道的方波 WAV：小（1.6 MB）、任何位置都能精确跳转。没有就现做一个 */
export function testMedia() {
  if (!fs.existsSync(MEDIA_FILE)) {
    const rate = 8000;
    const samples = rate * 200;
    const wav = Buffer.alloc(44 + samples);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + samples, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate, 28);
    wav.writeUInt16LE(1, 32);
    wav.writeUInt16LE(8, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(samples, 40);
    for (let i = 0; i < samples; i++) wav[44 + i] = (i >> 4) & 1 ? 160 : 96;
    fs.mkdirSync(path.dirname(MEDIA_FILE), { recursive: true });
    fs.writeFileSync(MEDIA_FILE, wav);
  }
  return fs.readFileSync(MEDIA_FILE);
}

/** 起一个支持 Range 的小服务器放测试片（任何路径都返回同一个文件） */
export async function serveTestMedia(port, host) {
  const body = testMedia();
  const server = http.createServer((req, res) => {
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    const headers = {
      'Content-Type': 'audio/wav',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    };
    if (!range) {
      res.writeHead(200, { ...headers, 'Content-Length': body.length });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    const start = range[1] ? Number(range[1]) : body.length - Number(range[2]);
    const end =
      range[1] && range[2]
        ? Math.min(Number(range[2]), body.length - 1)
        : body.length - 1;
    res.writeHead(206, {
      ...headers,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${body.length}`,
    });
    res.end(req.method === 'HEAD' ? undefined : body.subarray(start, end + 1));
  });
  await new Promise((resolve) => server.listen(port, host, resolve));
  return server;
}
