"""冒烟测试用的假服务器：返回一个简单页面，并把每次请求的 User-Agent 打到日志里。"""
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PAGE = "<!doctype html><meta charset=utf-8><title>SMOKE</title><body style='background:#fff;font-size:48px'>SMOKE OK</body>".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        print("GET %s UA=%s" % (self.path, self.headers.get("User-Agent")), flush=True)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(PAGE)))
        self.end_headers()
        self.wfile.write(PAGE)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", int(sys.argv[1])), Handler).serve_forever()
