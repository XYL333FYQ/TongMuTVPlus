// 给本机测试站准备数据：第二个测试账号 + 一个放着公开测试视频的房间。
//   node scripts/e2e/seed-test.mjs
// 房间号写进 .claude/test-room.txt（被 git 忽略），其他脚本用它打开房间页。

import { createRequire } from 'node:module';
import path from 'node:path';

import { BASE, readTestEnv, ROOT, writeRoomId } from './test-env.mjs';

const require = createRequire(path.join(ROOT, 'package.json'));
const { io } = require('socket.io-client');
const bs58 = require('bs58').default ?? require('bs58');

const env = readTestEnv();
export const TEST_VIDEO = 'https://media.w3.org/2010/05/bunny/movie.mp4';

async function login(username, password) {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) throw new Error(`${username} 登录失败 ${res.status}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

const adminCookie = await login(env.USERNAME, env.PASSWORD);

const add = await fetch(`${BASE}/api/admin/user`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie: adminCookie },
  body: JSON.stringify({
    action: 'add',
    targetUsername: env.TEST_MEMBER_USERNAME,
    targetPassword: env.TEST_MEMBER_PASSWORD,
  }),
});
console.log(
  '第二个账号：',
  add.status,
  add.status === 200 ? '已建' : await add.text()
);

const socket = io(BASE, {
  transports: ['websocket'],
  extraHeaders: { cookie: adminCookie },
});
const ack = (event, payload) =>
  new Promise((resolve) =>
    socket
      .timeout(10000)
      .emit(event, payload, (err, reply) =>
        resolve(err ? { error: String(err) } : reply)
      )
  );
await new Promise((resolve, reject) => {
  socket.once('connect', resolve);
  socket.once('connect_error', reject);
});

const created = await ack('room:create', {
  name: '测试房间',
  description: '',
  isPublic: true,
  roomType: 'sync',
  userName: env.USERNAME,
  settings: { chatEnabled: true, autoPlay: true },
});
if (!created?.success) throw new Error(`建房失败：${JSON.stringify(created)}`);
const roomId = created.room.id;
const videoId = bs58.encode(Buffer.from(TEST_VIDEO));
const changed = await ack('play:change', {
  type: 'play',
  url: '',
  source: 'directplay',
  videoId,
  videoName: 'Big Buck Bunny',
  episode: 1,
  currentTime: 0,
  isPlaying: false,
  playbackRate: 1,
  commandId: `seed-${Date.now()}`,
});
console.log('换片：', changed?.success ?? changed);
await ack('chat:message', {
  content: '测试消息',
  type: 'text',
  commandId: `seed-chat-${Date.now()}`,
});
writeRoomId(roomId);
console.log('房间：', roomId, '视频 id：', videoId);
socket.close();
