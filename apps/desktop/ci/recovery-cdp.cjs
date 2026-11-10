// CI-only loopback fixture and DevTools driver; never shipped in the client.
const http = require('node:http');
const https = require('node:https');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
// The same 596-byte one-page PDF used by the actual book-page audit.
const pdfFixture = Buffer.from(
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzNjAgMjQwXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggNTIgPj4Kc3RyZWFtCkJUIC9GMSAxOCBUZiA0MCAxNjAgVGQgKFRvbmdNdSBQREYgYWNjZXB0YW5jZSkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMxMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQxMwolJUVPRgo=',
  'base64'
);
if (
  require('node:crypto')
    .createHash('sha256')
    .update(pdfFixture)
    .digest('hex') !==
  '97444fdbfea671938c8cf7415766427714637cc2ad49401350b3c1e09c332d03'
)
  throw new Error('PDF fixture identity changed');

async function main() {
  const action = process.argv[2];
  if (action === 'serve') {
    let failures = 0;
    let tlsRequests = 0;
    let hangingRequests = 0;
    let brokenRequests = 0;
    let externalRequests = 0;
    let automaticRequests = 0;
    let externalReport = null;
    let authenticatedFileRequests = 0;
    let slowRequests = 0;
    let slowCanceled = 0;
    let slowCompleted = 0;
    const handler = (req, res) => {
      if (req.url === '/external-auto') {
        automaticRequests++;
        res.end('Unexpected automatic popup');
        return;
      }
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
            automaticRequests,
            externalReport,
            authenticatedFileRequests,
            slowRequests,
            slowCanceled,
            slowCompleted,
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
      if (req.url === '/download-pdf') {
        if (!(req.headers.cookie || '').includes('tm_ci_session=retained')) {
          res.writeHead(401);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': String(pdfFixture.length),
          'Content-Disposition':
            'attachment; filename="tm-client-pdf-audit.pdf"',
        });
        res.end(pdfFixture);
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
      if (req.url === '/slow-download') {
        if (!(req.headers.cookie || '').includes('tm_ci_session=retained')) {
          res.writeHead(401);
          res.end();
          return;
        }
        slowRequests++;
        const total = 16 * 1024 * 1024;
        const chunk = Buffer.alloc(16 * 1024, 90);
        let sent = 0;
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(total),
          'Content-Disposition':
            'attachment; filename="tm-client-slow-audit.txt"',
        });
        const timer = setInterval(() => {
          sent += chunk.length;
          res.write(chunk);
          if (sent === total) {
            clearInterval(timer);
            slowCompleted++;
            res.end();
          }
        }, 100);
        res.on('close', () => {
          clearInterval(timer);
          if (sent < total) slowCanceled++;
        });
        return;
      }
      if (req.url === '/post-file') {
        const authenticated = (req.headers.cookie || '')
          .split(';')
          .some((part) => part.trim() === 'tm_ci_session=retained');
        if (req.method !== 'POST' || !authenticated) {
          res.writeHead(401);
          res.end();
          return;
        }
        authenticatedFileRequests++;
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(Buffer.from('TongMu authenticated Blob\0文件\n', 'utf8'));
        return;
      }
      const fail = req.url === '/unavailable' && failures++ === 0;
      res.writeHead(fail ? 503 : 200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      res.end(
        fail
          ? '<title>Unavailable</title>Controlled HTTP 503'
          : `<title>NativeRecoveryFixture</title><h1>Native recovery ready</h1>
<a id="fixture-download" href="/download">Download fixture</a>
<p><a id="fixture-pdf" href="/download-pdf">Download PDF fixture</a></p>
<p><button id="fixture-blob">Save generated Blob</button></p>
<p><button id="fixture-post-blob">Save authenticated POST response</button></p>
<p><a id="fixture-slow" href="/slow-download">Download slow fixture</a></p>
<p><button id="fixture-interact">Keep browsing</button></p>
<p><a id="fixture-external" href="/external" target="_blank" rel="noopener">Open external fixture</a></p>
<script>
function saveFixtureBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function recordDownloadInput(event){
  window.__tmCiDownloadTrusted=event.isTrusted;
  window.__tmCiDownloadActive=!!(navigator.userActivation&&navigator.userActivation.isActive);
}
document.querySelector('#fixture-download').onclick=recordDownloadInput;
document.querySelector('#fixture-pdf').onclick=recordDownloadInput;
document.querySelector('#fixture-slow').onclick=recordDownloadInput;
document.querySelector('#fixture-interact').onclick=event=>{
  recordDownloadInput(event);
  window.__tmCiBackgroundClicks=(window.__tmCiBackgroundClicks||0)+1;
};
document.querySelector('#fixture-blob').onclick=event=>{
  recordDownloadInput(event);
  saveFixtureBlob(new Blob(['TongMu generated Blob\\0文件\\n']),'tm-client-blob-audit.bin');
};
document.querySelector('#fixture-post-blob').onclick=async event=>{
  recordDownloadInput(event);
  try {
    const response=await fetch('/post-file',{method:'POST',credentials:'same-origin'});
    if(!response.ok)throw new Error('Authenticated file request failed');
    saveFixtureBlob(await response.blob(),'tm-client-post-blob-audit.bin');
  }catch(error){window.__tmCiBlobError=String(error);}
};
</script>`
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
      /^(download|download-native|download-blob|download-post-blob)$/.test(
        action
      ) &&
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
  async function click(selector, root = 'document') {
    const point = await command('Runtime.evaluate', {
      expression: `(()=>{const r=${root}.querySelector(${JSON.stringify(
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
    } else if (action === 'window-start') {
      const result = await command('Runtime.evaluate', {
        expression:
          'window.__tmCiWindowDocument=document;window.__tmCiWindowOrigin=performance.timeOrigin;window.TMDesktop?.externalLinks===true',
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error(
          'Native HTTP(S) external-link capability was not advertised'
        );
    } else if (action === 'client-update-supported') {
      const result = await command('Runtime.evaluate', {
        expression: 'typeof window.TMDesktop?.installUpdate === "function"',
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error('Native update bridge unavailable');
    } else if (action === 'client-update-click') {
      await command('Runtime.evaluate', {
        expression: `(() => {
          const button = document.createElement('button');
          button.id = 'native-client-update';
          button.textContent = 'Update fixture';
          button.style.cssText = 'position:fixed;top:70px;left:20px;z-index:9999';
          button.onclick = () => {
            button.remove();
            window.TMDesktop.installUpdate().catch(error => {
              window.__tmUpdateBridgeError = String(error);
            });
          };
          document.body.appendChild(button);
        })()`,
      });
      await click('#native-client-update');
    } else if (action === 'window-stable') {
      const result = await command('Runtime.evaluate', {
        expression:
          'window.__tmCiWindowDocument===document && window.__tmCiWindowOrigin===performance.timeOrigin',
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error('Native window action recreated the document');
    } else if (action === 'window-maximize' || action === 'window-minimize') {
      await click(
        action === 'window-minimize'
          ? '[data-act=minimize]'
          : '[data-act=toggle-maximize]',
        'document.querySelector("tm-shell-controls").shadowRoot'
      );
    } else if (action === 'window-fullscreen') {
      for (const type of ['keyDown', 'keyUp']) {
        await command('Input.dispatchKeyEvent', {
          type,
          key: 'F11',
          code: 'F11',
          windowsVirtualKeyCode: 122,
          nativeVirtualKeyCode: 122,
        });
      }
    } else if (action === 'download-mark') {
      // This session closes before the OS accessibility input starts. No Page /
      // Network domains or DevTools download handlers are enabled in this probe.
      await command('Runtime.evaluate', {
        expression:
          'window.__tmCiDownloadOrigin = performance.timeOrigin; window.__tmCiDownloadTrusted = false; window.__tmCiDownloadActive = null',
      });
    } else if (action === 'download-activation-idle') {
      const result = await command('Runtime.evaluate', {
        expression:
          '!!navigator.userActivation && !navigator.userActivation.isActive',
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error('Transient user activation is still active');
    } else if (action === 'download-interaction-ready') {
      const result = await command('Runtime.evaluate', {
        expression:
          'document.title === "NativeRecoveryFixture" && performance.timeOrigin === window.__tmCiDownloadOrigin && window.__tmCiBackgroundClicks === 1 && window.__tmCiDownloadTrusted === true',
        returnByValue: true,
      });
      if (result.result.value !== true)
        throw new Error(
          'Main content did not handle physical input during download'
        );
    } else if (
      action === 'window-fullscreen-on' ||
      action === 'window-fullscreen-off'
    ) {
      const result = await command('Runtime.evaluate', {
        expression: 'Boolean(document.fullscreenElement)',
        returnByValue: true,
      });
      if (result.result.value !== (action === 'window-fullscreen-on'))
        throw new Error('Unexpected actual document fullscreen state');
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
    } else if (action === 'popup') {
      const activation = await command('Runtime.evaluate', {
        expression: 'navigator.userActivation.isActive',
        returnByValue: true,
      });
      if (activation.result.value !== false)
        throw new Error(
          'Automatic popup probe inherited a real preceding gesture'
        );
      await command('Runtime.evaluate', {
        expression: 'setTimeout(()=>window.open("/external-auto","_blank"),0)',
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else if (action === 'no-user-activation') {
      const activation = await command('Runtime.evaluate', {
        expression: 'navigator.userActivation.isActive === false',
        returnByValue: true,
      });
      if (activation.result.value !== true)
        throw new Error(
          'Real preceding gesture still has transient activation'
        );
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
    } else if (
      /^(download|download-native|download-blob|download-post-blob)$/.test(
        action
      )
    ) {
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
      if (action !== 'download') {
        await click(
          action === 'download-native'
            ? '#fixture-download'
            : action === 'download-blob'
            ? '#fixture-blob'
            : '#fixture-post-blob'
        );
      } else {
        navigation = await command('Page.navigate', {
          url: 'http://127.0.0.1:8085/download',
        });
      }
      // Keep the CDP session alive while the asynchronous download starts.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fs.writeFileSync(
        action !== 'download'
          ? path.join(path.resolve(process.argv[3]), `${action}-events.json`)
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
      action === 'download-native-ready' ||
      action === 'download-physical-ready' ||
      action === 'download-assistive-ready'
    ) {
      if (action === 'download-ready') {
        await command('Browser.setDownloadBehavior', { behavior: 'default' });
      }
      const result = await command('Runtime.evaluate', {
        expression:
          'document.title === "NativeRecoveryFixture" && performance.timeOrigin === window.__tmCiDownloadOrigin && !window.__tmCiBlobError && window.__tmCiDownloadTrusted === true' +
          (action === 'download-physical-ready'
            ? ' && window.__tmCiDownloadActive === true'
            : ''),
        returnByValue: true,
      });
      if (result.result.value !== true) {
        const evidence = await command('Runtime.evaluate', {
          expression:
            'JSON.stringify({title:document.title,sameDocument:performance.timeOrigin===window.__tmCiDownloadOrigin,blobError:window.__tmCiBlobError||null,trusted:window.__tmCiDownloadTrusted,activeAtClick:window.__tmCiDownloadActive})',
          returnByValue: true,
        });
        throw new Error(
          `Download invariant failed (${action}): ${evidence.result.value}`
        );
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
