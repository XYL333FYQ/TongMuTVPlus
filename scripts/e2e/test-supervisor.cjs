'use strict';
// 测试站看门狗：本机 Node 会随机原生崩溃，崩了就自动重启 test-server.cjs，拍快照不用人盯。
const { spawn } = require('node:child_process');
const path = require('node:path');

let restarts = 0;
function start() {
  const child = spawn(
    process.execPath,
    [path.join(__dirname, 'test-server.cjs')],
    {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../..'),
    }
  );
  child.on('exit', (code, signal) => {
    restarts += 1;
    console.log(
      `[supervisor] test server exited (${
        code ?? signal
      }), restart #${restarts}`
    );
    setTimeout(start, 1500);
  });
  const stop = () => {
    child.removeAllListeners('exit');
    child.kill();
    process.exit(0);
  };
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
start();
