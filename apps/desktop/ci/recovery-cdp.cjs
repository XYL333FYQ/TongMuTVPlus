// CI-only loopback fixture and DevTools driver; never shipped in the client.
const http = require('node:http');
const https = require('node:https');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const action = process.argv[2];
  if (action === 'serve') {
    let failures = 0;
    let tlsRequests = 0;
    let hangingRequests = 0;
    let brokenRequests = 0;
    let externalRequests = 0;
    let externalReport = null;
    const handler = (req, res) => {
      if (req.url === '/external-report' && req.method === 'POST') {
        let text = '';
        req.on('data', (chunk) => {
          text += chunk;
          if (text.length > 1024) req.destroy();
        });
        req.on('end', () => {
          try {
            const report = JSON.parse(text);
            if (
              typeof report.webview !== 'boolean' ||
              typeof report.desktopBridge !== 'boolean'
            ) {
              throw new Error('Invalid browser report');
            }
            externalReport = {
              webview: report.webview === true,
              desktopBridge: report.desktopBridge === true,
            };
            res.end('ok');
          } catch {
            res.writeHead(400);
            res.end();
          }
        });
        return;
      }
      if (req.url === '/external') {
        externalRequests++;
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
        });
        res.end(
          '<title>ExternalBrowserFixture</title><h1>External browser fixture</h1><script>fetch("/external-report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({webview:!!(window.chrome&&window.chrome.webview),desktopBridge:!!window.__tmDesktopInit})})</script>'
        );
        return;
      }
      if (req.url === '/profile-check') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(
          JSON.stringify({
            retained: (req.headers.cookie || '')
              .split(';')
              .some((part) => part.trim() === 'tm_ci_session=retained'),
          })
        );
        return;
      }
      if (req.url === '/seed') {
        res.setHeader(
          'Set-Cookie',
          'tm_ci_session=retained; HttpOnly; Max-Age=3600; SameSite=Lax; Path=/'
        );
      }
      if (req.url === '/diagnostics') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            tlsRequests,
            hangingRequests,
            brokenRequests,
            externalRequests,
            externalReport,
          })
        );
        return;
      }
      if (req.url === '/hang') {
        hangingRequests++;
        return;
      }
      if (req.url === '/broken') {
        brokenRequests++;
        res.writeHead(200, {
          'Content-Length': '10000',
          'Content-Type': 'text/html',
        });
        res.write('<title>Broken transport fixture</title>');
        setTimeout(() => res.destroy(), 50);
        return;
      }
      if (req.url === '/download') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename="tm-client-audit.txt"',
        });
        res.end('TongMu native download fixture');
        return;
      }
      const fail = req.url === '/unavailable' && failures++ === 0;
      res.writeHead(fail ? 503 : 200, { 'Content-Type': 'text/html' });
      res.end(
        fail
          ? '<title>Unavailable</title>Controlled HTTP 503'
          : '<title>NativeRecoveryFixture</title><h1>Native recovery ready</h1><a id="fixture-download" href="/download">Download fixture</a><p><a id="fixture-external" href="/external" target="_blank" rel="noopener">Open external fixture</a></p>'
      );
    };
    http.createServer(handler).listen(8085, '127.0.0.1');
    if (process.argv[3] && process.argv[4]) {
      https
        .createServer(
          {
            cert: fs.readFileSync(process.argv[3]),
            key: fs.readFileSync(process.argv[4]),
          },
          (req, res) => {
            tlsRequests++;
            handler(req, res);
          }
        )
        .listen(8445, '127.0.0.1');
    }
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
  const downloadEvents = [];
  socket.addEventListener('message', ({ data }) => {
    const response = JSON.parse(data);
    if (
      (action === 'download' || action === 'download-native') &&
      /^(Browser|Page)\.download|^Network\.loadingFailed$/.test(
        response.method || ''
      ) &&
      downloadEvents.length < 30
    ) {
      const params = response.params || {};
      downloadEvents.push({
        method: response.method,
        state: params.state,
        receivedBytes: params.receivedBytes,
        totalBytes: params.totalBytes,
        errorText: params.errorText,
        canceled: params.canceled,
      });
    }
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
  async function click(selector) {
    const point = await command('Runtime.evaluate', {
      expression: `(()=>{const r=document.querySelector(${JSON.stringify(
        selector
      )}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      returnByValue: true,
    });
    if (!point.result.value) throw new Error('Fixture action target missing');
    for (const type of ['mousePressed', 'mouseReleased']) {
      await command('Input.dispatchMouseEvent', {
        type,
        ...point.result.value,
        button: 'left',
        clickCount: 1,
      });
    }
  }
  try {
    if (action === 'navigate') {
      await command('Page.navigate', { url: process.argv[3] });
    } else if (action === 'connect') {
      await command('Runtime.evaluate', {
        expression: `document.querySelector("#addr").value=${JSON.stringify(
          process.argv[3]
        )}`,
      });
      await click('#go');
    } else if (action === 'profile') {
      const result = await command('Runtime.evaluate', {
        expression:
          'fetch("/profile-check",{cache:"no-store"}).then(r=>r.json()).then(r=>r.retained && !document.cookie.includes("tm_ci_session"))',
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error('Persistent HttpOnly fixture cookie was not retained');
    } else if (action === 'close') {
      socket.send(
        JSON.stringify({
          id: ++serial,
          method: 'Runtime.evaluate',
          params: {
            expression:
              'document.querySelector("tm-shell-controls").shadowRoot.querySelector("[data-act=close]").click()',
          },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else if (action === 'external') {
      await command('Runtime.evaluate', {
        expression: 'window.__tmCiExternalOrigin=performance.timeOrigin',
      });
      await click('#fixture-external');
    } else if (action === 'external-ready') {
      const result = await command('Runtime.evaluate', {
        expression:
          'document.title === "NativeRecoveryFixture" && performance.timeOrigin === window.__tmCiExternalOrigin',
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error(
          'Opening external content replaced the client document'
        );
    } else if (action === 'hang') {
      // The navigation deliberately never commits. Schedule it from the page
      // so the driver can return while the native watchdog keeps waiting.
      await command('Runtime.evaluate', {
        expression: 'setTimeout(()=>location.assign("/hang"),0)',
      });
    } else if (action === 'download' || action === 'download-native') {
      await command('Runtime.evaluate', {
        expression: 'window.__tmCiDownloadOrigin = performance.timeOrigin',
      });
      // CI controls only the destination. The real WebView still receives an
      // attachment navigation and emits its ordinary native download events.
      if (action === 'download') {
        await command('Browser.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: path.resolve(process.argv[3]),
          eventsEnabled: true,
        });
      }
      await command('Page.enable');
      await command('Network.enable');
      let navigation = {};
      if (action === 'download-native') {
        await click('#fixture-download');
      } else {
        navigation = await command('Page.navigate', {
          url: 'http://127.0.0.1:8085/download',
        });
      }
      // Keep the CDP session alive while the asynchronous download starts.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fs.writeFileSync(
        action === 'download-native'
          ? path.join(
              path.resolve(process.argv[3]),
              'download-native-events.json'
            )
          : path.join(
              path.resolve(process.argv[3]),
              '..',
              'download-events.json'
            ),
        JSON.stringify(
          {
            navigation: {
              errorText: navigation.errorText,
              isDownload: navigation.isDownload,
            },
            events: downloadEvents,
          },
          null,
          2
        )
      );
    } else if (
      action === 'download-ready' ||
      action === 'download-native-ready'
    ) {
      if (action === 'download-ready') {
        await command('Browser.setDownloadBehavior', { behavior: 'default' });
      }
      const result = await command('Runtime.evaluate', {
        expression:
          'document.title === "NativeRecoveryFixture" && performance.timeOrigin === window.__tmCiDownloadOrigin',
        returnByValue: true,
      });
      if (result.result.value !== true) {
        throw new Error('Attachment navigation replaced the existing document');
      }
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
          (action === 'settings' ? ' && location.search === "?change=1"' : '') +
          (process.argv[3]
            ? ` && document.querySelector("#addr").value === ${JSON.stringify(
                process.argv[3]
              )}`
            : ''),
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
