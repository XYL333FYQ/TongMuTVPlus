"""冒烟测试用的假服务器：返回一个简单页面，并把每次请求的 User-Agent 打到日志里。"""
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

# 页面模拟「认识壳的新网站」：调用 TMShell 的各个方法，再把壳注入的结果报告回来
PAGE = """<!doctype html><meta charset=utf-8><title>SMOKE</title>
<body style='background:#fff;font-size:48px'>SMOKE OK</body>
<script>
var r = document.documentElement;
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
      bottom: r.style.getPropertyValue('--tm-shell-bottom')
    })
  });
}, 3000);
</script>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        print("GET %s UA=%s" % (self.path, self.headers.get("User-Agent")), flush=True)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(PAGE)))
        self.end_headers()
        self.wfile.write(PAGE)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        print("REPORT %s" % self.rfile.read(length).decode(), flush=True)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", int(sys.argv[1])), Handler).serve_forever()
