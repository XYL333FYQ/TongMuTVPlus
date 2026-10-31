"""冒烟测试用的假服务器：返回一个简单页面，并把每次请求的 User-Agent 打到日志里。"""
import sys
import ssl
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# Failure resources are opt-in so the shared TV smoke keeps its normal fixture.
RECOVERY_CONTROLS = """<button onclick='TMShell.setSystemBars(false)' style='display:block;min-height:48px;font-size:24px'>Light theme</button>
<a href='/unavailable' style='display:block;font-size:24px;line-height:56px'>HTTP failure test</a>
<a href='https://10.0.2.2:8443/tls' style='display:block;font-size:24px;line-height:56px'>TLS failure test</a>
<a href='/always-unavailable' style='display:block;font-size:24px;line-height:56px'>Back from failure test</a>
<a href='/update-test' style='position:fixed;bottom:8px;right:8px;background:white;font-size:16px;line-height:48px'>Update permission test</a>
<img src='/missing.png' width='1' height='1' alt=''>
<img src='https://10.0.2.2:8443/missing.png' width='1' height='1' alt=''>""".encode()

# 页面模拟「认识壳的新网站」：调用 TMShell 的各个方法，再把壳注入的结果报告回来
PAGE = """<!doctype html><meta charset=utf-8><title>SMOKE</title>
<body style='background:#fff;font-size:48px'>SMOKE OK
<input aria-label='Keyboard smoke input' placeholder='Keyboard smoke input'
 style='display:block;margin-top:32px;width:85%;height:64px;font-size:24px'>
__RECOVERY_CONTROLS__
</body>
<script>
var r = document.documentElement;
var lastIme = '';
new MutationObserver(function () {
  var ime = r.getAttribute('data-tm-keyboard');
  if (!ime || ime === lastIme) return;
  lastIme = ime;
  fetch('/ime-report', {method: 'POST', body: JSON.stringify({
    keyboard: ime, source: r.getAttribute('data-tm-ime-source')
  })});
}).observe(r, {attributes: true, attributeFilter: ['data-tm-keyboard']});
if (window.TMShell) {
  TMShell.ready();
  TMShell.setSystemBars(true);
  TMShell.haptic(5);
  TMShell.setPlaying(true);
}
setTimeout(function () {
  fetch('/report', {
    method: 'POST',
    body: JSON.stringify({
      bridge: !!window.TMShell,
      shell: r.getAttribute('data-tm-shell'),
      top: r.style.getPropertyValue('--tm-shell-top'),
      bottom: r.style.getPropertyValue('--tm-shell-bottom'),
      path: location.pathname
    })
  });
}, 3000);
</script>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        print("GET %s UA=%s" % (self.path, self.headers.get("User-Agent")), flush=True)
        if self.path == "/missing.png":
            self.send_error(404)
            return
        if self.path == "/always-unavailable":
            self.send_error(503)
            return
        if self.path == "/unavailable":
            self.server.failure_count = getattr(self.server, "failure_count", 0) + 1
            if self.server.failure_count == 1:
                self.send_error(503)
                return
        controls = RECOVERY_CONTROLS if getattr(self.server, "recovery_mode", False) else b""
        if self.path == "/update-test" and controls:
            controls = b"<button style='display:block;font-size:20px;min-height:48px' onclick=\"TMShell.installUpdate('https://example.com/TongMuTV-Plus-Android.apk')\">Update missing package test</button>"
        page = PAGE.replace(b"__RECOVERY_CONTROLS__", controls)
        if getattr(self.server, "playing_reported", False):
            page = page.replace(b"TMShell.setPlaying(true);", b"TMShell.setPlaying(false);")
        else:
            self.server.playing_reported = True
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.end_headers()
        self.wfile.write(page)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        label = "IME_REPORT" if self.path == "/ime-report" else "REPORT"
        print("%s %s" % (label, self.rfile.read(length).decode()), flush=True)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    recovery = len(sys.argv) > 4 and sys.argv[4] == "recovery"
    if len(sys.argv) >= 4:
        secure = HTTPServer(("0.0.0.0", 8443), Handler)
        secure.recovery_mode = recovery
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(sys.argv[2], sys.argv[3])
        secure.socket = context.wrap_socket(secure.socket, server_side=True)
        threading.Thread(target=secure.serve_forever, daemon=True).start()
    server = HTTPServer(("0.0.0.0", int(sys.argv[1])), Handler)
    server.recovery_mode = recovery
    server.serve_forever()
