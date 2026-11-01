// CI-only loopback fixture and DevTools driver; never shipped in the client.
const http = require('node:http');
const { once } = require('node:events');

async function main() {
  const action = process.argv[2];
  if (action === 'serve') {
    let failures = 0;
    http
      .createServer((req, res) => {
        const fail = req.url === '/unavailable' && failures++ === 0;
        res.writeHead(fail ? 503 : 200, { 'Content-Type': 'text/html' });
        res.end(
          fail
            ? '<title>Unavailable</title>Controlled HTTP 503'
            : '<title>NativeRecoveryFixture</title><h1>Native recovery ready</h1>'
        );
      })
      .listen(8085, '127.0.0.1');
    return;
  }
  const targets = await fetch('http://127.0.0.1:9222/json/list').then((r) =>
    r.json()
  );
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw new Error('No client page target');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, 'open');
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const response = JSON.parse(data);
    const waiter = pending.get(response.id);
    if (!waiter) return;
    pending.delete(response.id);
    if (response.error)
      waiter.reject(new Error(JSON.stringify(response.error)));
    else waiter.resolve(response.result);
  });
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  try {
    if (action === 'navigate') {
      await command('Page.navigate', { url: process.argv[3] });
    } else if (action === 'ready') {
      const result = await command('Runtime.evaluate', {
        expression: 'document.title',
        returnByValue: true,
      });
      if (result.result.value !== 'NativeRecoveryFixture') {
        throw new Error(`Unexpected title: ${result.result.value}`);
      }
    } else if (action === 'settings' || action === 'local') {
      const result = await command('Runtime.evaluate', {
        expression:
          'location.hostname === "tauri.localhost" && !!document.querySelector("#addr")' +
          (action === 'settings' ? ' && location.search === "?change=1"' : ''),
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error('Not the local settings');
    } else if (action === 'crash') {
      // A renderer crash cannot reply. Sending the actual protocol command is
      // followed by independent native UI / host PID assertions in PowerShell.
      socket.send(JSON.stringify({ id: ++serial, method: 'Page.crash' }));
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } finally {
    socket.close();
  }
}

const timeout = setTimeout(() => {
  console.error('CDP command timed out');
  process.exit(1);
}, 12000);
main().then(
  () => clearTimeout(timeout),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
