"""冒烟测试用的假服务器：返回一个简单页面，并把每次请求的 User-Agent 打到日志里。"""
import sys
import ssl
import threading
import io
import math
import struct
import wave
import time
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer


class SecureFixtureServer(ThreadingHTTPServer):
    """Do not serialize WebView speculative TLS handshakes in accept()."""
    def __init__(self, address, handler, context):
        self.context = context
        super().__init__(address, handler)

    def process_request_thread(self, request, client_address):
        try:
            request.settimeout(5)
            secure = self.context.wrap_socket(request, server_side=True)
        except OSError as error:
            print('TLS handshake rejected: ' + type(error).__name__, flush=True)
            request.close()
            return
        super().process_request_thread(secure, client_address)

# Failure resources are opt-in so the shared TV smoke keeps its normal fixture.
RECOVERY_CONTROLS = """<button onclick='TMShell.setSystemBars(false)' style='display:block;min-height:48px;font-size:24px'>Light theme</button>
<a href='/unavailable' style='display:block;font-size:24px;line-height:56px'>HTTP failure test</a>
<a href='https://10.0.2.2:8443/tls' style='display:block;font-size:24px;line-height:56px'>TLS failure test</a>
<a href='/always-unavailable' style='display:block;font-size:24px;line-height:56px'>Back from failure test</a>
<a href='/native-media-test' style='display:block;font-size:20px;line-height:48px'>Native media permission test</a>
<a href='/native-session-test' style='display:block;font-size:20px;line-height:48px'>Native session test</a>
<a href='/native-pip-test' style='display:block;font-size:20px;line-height:48px'>Native PiP test</a>
<a href='/native-content-export' style='position:fixed;bottom:64px;left:4px;background:white;font-size:14px;line-height:44px'>Native content export</a>
<a href='/native-external-test' style='position:fixed;bottom:8px;left:4px;background:white;font-size:14px;line-height:48px'>Native external test</a>
<a href='/update-test' style='position:fixed;bottom:8px;right:8px;background:white;font-size:16px;line-height:48px'>Update permission test</a>
<img src='/missing.png' width='1' height='1' alt=''>
<img src='https://10.0.2.2:8443/missing.png' width='1' height='1' alt=''>""".encode()

# ES5 fixture only: the production React layer registry is verified separately.
BACK_CONTROLS = """<div style='position:fixed;top:0;left:0;right:0;z-index:9999;background:white;color:black;font:16px sans-serif'>
<button id='back-detail' style='min-height:48px'>Back detail</button>
<button id='back-overlay' style='min-height:48px'>Back overlay</button>
<span id='back-status'>BACK root</span></div>
<div id='back-layer' style='display:none;position:fixed;top:96px;bottom:32px;left:8px;right:8px;z-index:9998;background:white;color:black;font:24px sans-serif'>Controlled overlay</div>
<script>
(function(){
 var doc=String(Date.now())+'-'+String(Math.random()),seq=0,calls=0,pops=0,overlay=false;
 var origin=performance.timeOrigin||(performance.timing&&performance.timing.navigationStart)||0;
 var status=document.getElementById('back-status'),layer=document.getElementById('back-layer');
 function detail(){return location.search.indexOf('tmCiBack=detail')>=0;}
 function draw(){status.textContent='BACK '+(overlay?'overlay':detail()?'detail':'root');layer.style.display=overlay?'block':'none';}
 function report(phase){fetch('/back-report',{method:'POST',body:JSON.stringify({phase:phase,seq:seq++,doc:doc,origin:origin,calls:calls,pops:pops,overlay:overlay,detail:detail()})});}
 document.getElementById('back-detail').onclick=function(){history.pushState({tmCiDetail:true},'','/?tmCiBack=detail');draw();report('detail');};
 document.getElementById('back-overlay').onclick=function(){if(!detail())return;overlay=true;draw();report('overlay');};
 window.__tmShellBack=function(){calls++;if(overlay){overlay=false;draw();report('overlay-closed');return true;}return false;};
 window.addEventListener('popstate',function(){pops++;draw();report('history-root');});
 draw();report('root');
})();
</script>""".encode()

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
  // A quick page transition/removal must not cancel an unacknowledged FGS start.
  TMShell.setPlaying(false);
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

# No network media dependency: a looped PCM tone only in the isolated emulator.
def tone_wave():
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b''.join(struct.pack('<h', int(500 * math.sin(i * math.pi / 20))) for i in range(16000)))
    return buffer.getvalue()


MEDIA_PAGE = """<!doctype html><meta charset=utf-8><title>Native media permission fixture</title>
<body style='background:white;color:black;font:24px sans-serif'>
<button style='min-height:56px;font-size:24px' onclick='audio.play()'>Start controlled media</button>
<button style='display:block;min-height:56px;font-size:24px' onclick='locked=false'>Allow media pause</button>
<audio id=audio loop src='/tone.wav'></audio>
<a style='display:block;line-height:56px' href='/'>Return to recovery fixture</a></body>
<script>
var audio=document.getElementById('audio'),locked=true,calls=0;
function report(event){fetch('/media-report',{method:'POST',body:JSON.stringify({event:event,paused:audio.paused,calls:calls})})}
window.__tmShellMediaAction=function(action){
 if(action!=='pause')return false;
 calls++;
 report(locked?'blocked':'allowed');
 if(!locked)audio.pause();
 return true;
};
audio.onplaying=function(){TMShell.setPlaying(true);report('playing')};
audio.onpause=function(){TMShell.setPlaying(false);report('paused')};
TMShell.ready();TMShell.setPlaying(false);
if(navigator.mediaSession){
 navigator.mediaSession.metadata=new MediaMetadata({title:'Native media permission fixture',artist:'TongMuTV Plus'});
 navigator.mediaSession.setActionHandler('pause',function(){window.__tmShellMediaAction('pause')});
}
</script>""".encode()

SESSION_PAGE = """<!doctype html><meta charset=utf-8><title>Native session fixture</title>
<body style='background:white;color:black;font:24px sans-serif'>
<button style='min-height:56px;font-size:24px' onclick='audio.play()'>Start session media</button>
<button style='display:block;min-height:56px;font-size:24px' onclick='locked=true;publish();report("session-locked")'>Lock session controls</button>
<button style='display:block;min-height:56px;font-size:24px' onclick='audio.remove();started=false;publish();report("session-removed")'>Remove session media</button>
<audio id=audio loop src='/tone.wav'></audio>
<a style='display:block;line-height:56px' href='/'>Return to recovery fixture</a></body>
<script>
var audio=document.getElementById('audio'),locked=false,started=false,calls=0;
function report(event){fetch('/media-report',{method:'POST',body:JSON.stringify({event:event,paused:audio.paused,calls:calls})})}
function publish(){TMShell.setMediaState(JSON.stringify({v:1,active:started&&document.body.contains(audio),playing:!audio.paused&&!audio.ended,canControl:!locked,title:'Native session fixture'}))}
window.__tmShellMediaAction=function(action){
 if(action!=='pause'&&action!=='play')return false;
 calls++;
 if(!locked){if(action==='play')audio.play();else audio.pause()}
 return true;
};
audio.onplaying=function(){started=true;publish();TMShell.setPlaying(false);report('session-playing')};
audio.onpause=function(){publish();report('session-paused')};
TMShell.ready();publish();
</script>""".encode()

PIP_PAGE = """<!doctype html><meta charset=utf-8><title>Native PiP fixture</title>
<body style='background:white;color:black;font:24px sans-serif'>
<button style='display:block;min-height:56px;font-size:24px' onclick='video.play().then(function(){return video.requestFullscreen()}).catch(function(){report("pip-start-rejected")})'>Start full video</button>
<video id=video loop playsinline preload=metadata src='/pip-clip.webm' style='width:100%'></video>
<a style='display:block;line-height:56px' href='/'>Return to recovery fixture</a></body>
<script>
var video=document.getElementById('video'),originalVideo=video,started=false,calls=0;
function report(event){fetch('/media-report',{method:'POST',body:JSON.stringify({event:event,paused:video.paused,calls:calls,time:video.currentTime,duration:video.duration,origin:performance.timeOrigin,sameVideo:video===originalVideo&&video.isConnected,fullscreen:document.fullscreenElement===video})})}
function publish(){TMShell.setMediaState(JSON.stringify({v:1,active:started&&video.isConnected,playing:!video.paused&&!video.ended,canControl:true,title:'Native PiP fixture',videoWidth:video.videoWidth,videoHeight:video.videoHeight}))}
window.__tmShellMediaAction=function(action){
 if(action==='play'){calls++;video.play()}else if(action==='pause'){calls++;video.pause()}else return false;
 return true;
};
video.onplaying=function(){started=true;publish();report('pip-playing')};
video.onpause=function(){publish();report('pip-paused')};
video.onloadedmetadata=publish;
document.addEventListener('fullscreenchange',function(){report('pip-fullscreen')});
setInterval(function(){if(started)report('pip-tick')},500);
TMShell.ready();publish();
</script>""".encode()


EXTERNAL_PAGE = """<!doctype html><meta charset=utf-8><title>External link fixture</title>
<body style='background:white;color:black;font:24px sans-serif'>
<a href='/external-destination?anchor' target='_blank' rel='noopener noreferrer' style='display:block;line-height:56px'>Open external anchor</a>
<button style='display:block;min-height:56px;font-size:24px' onclick="window.open('/external-destination?script','_blank','noopener,noreferrer')">Open external script</button>
<a href='/native-download-test' style='display:block;line-height:56px'>Native download test</a>
<a href='/' style='display:block;line-height:56px'>Return to recovery fixture</a>
<script>
var originalOrigin=performance.timeOrigin;
function report(){fetch('/external-report',{method:'POST',body:JSON.stringify({event:'source',origin:originalOrigin,path:location.pathname,bridge:!!window.TMShell})})}
TMShell.ready();TMShell.setPlaying(false);report();setInterval(report,500);
setTimeout(function(){window.open('/external-destination?automatic','_blank')},1000);
</script></body>""".encode()

EXTERNAL_DESTINATION = """<!doctype html><meta charset=utf-8><title>External destination</title>
<body>External destination<script>
fetch('/external-report',{method:'POST',body:JSON.stringify({event:'destination',bridge:!!window.TMShell,query:location.search})});
if(window.TMShell)TMShell.ready();
</script></body>""".encode()

CONTENT_EXPORT_PAGE = """<!doctype html><meta charset=utf-8><title>Content export fixture</title>
<body style='background:white;color:black;font:20px sans-serif'>
<div id='status'>Waiting for export bridge</div>
<button style='display:block;min-height:48px;font:20px sans-serif' onclick='audio.play()'>Start export audio</button>
<button style='display:block;min-height:48px;font:20px sans-serif' onclick='saveBlob()'>Export Blob</button>
<button style='display:block;min-height:48px;font:20px sans-serif' onclick='postBlob()'>Export POST Blob</button>
<button style='display:block;min-height:48px;font:20px sans-serif' onclick='slowBlob()'>Export slow Blob</button>
<a href='/' style='display:block;line-height:48px'>Return to recovery fixture</a>
<audio id=audio loop src='/tone.wav'></audio><iframe id=foreign sandbox='allow-scripts' style='display:none'></iframe>
<script>
var audio=document.getElementById('audio'),originalAudio=audio,doc=String(Date.now())+'-'+String(Math.random()),seq=0;
var origin=performance.timeOrigin||(performance.timing&&performance.timing.navigationStart)||0,advanced=0,lastAudioTime=0;
setInterval(function(){var now=audio.currentTime;if(!audio.paused&&audio.duration>0)advanced+=(now-lastAudioTime+audio.duration)%audio.duration;lastAudioTime=now;},100);
function report(event,extra){var row={event:event,seq:seq++,doc:doc,origin:origin,sameAudio:audio===originalAudio&&document.documentElement.contains(audio),paused:audio.paused,time:audio.currentTime,advance:advanced};
 if(extra)row.extra=extra;var xhr=new XMLHttpRequest();xhr.open('POST','/content-export-report');xhr.send(JSON.stringify(row));}
audio.onplaying=function(){TMShell.setPlaying(true);report('playing');};
function exported(blob,name,label){window.__tmContentExport.saveBlob(blob,name).then(function(state){document.getElementById('status').textContent=label+' '+state;report(label+'-'+state);},function(error){report('failed');document.getElementById('status').textContent='Export failed';});}
function saveBlob(){var data=new Uint8Array(131079);for(var i=0;i<data.length;i++)data[i]=i%251;exported(new Blob([data,'桐木导出'],{type:'application/octet-stream'}),'TM-content-blob.bin','Export');}
function postBlob(){var xhr=new XMLHttpRequest();xhr.open('POST','/content-export-post');xhr.responseType='blob';xhr.onload=function(){if(xhr.status!==200){report('failed');return;}exported(xhr.response,'TM-content-post.bin','POST export');};xhr.send('{"bookId":"fixture"}');}
// CI-only delayed FileReader producer: real Blob bytes and native ACKs are retained.
function slowBlob(){var Original=window.FileReader,reads=0;window.FileReader=function(){var reader=new Original(),self=this;
 this.readAsDataURL=function(blob){reader.onload=function(){self.result=reader.result;var delay=reads++===0?0:4000;setTimeout(function(){if(self.onload)self.onload();},delay);};reader.onerror=function(){if(self.onerror)self.onerror();};reader.readAsDataURL(blob);};this.abort=function(){reader.abort();};};
 window.__tmContentExport.saveBlob(new Blob([new Uint8Array(2097152)]),'TM-content-cancel.bin').then(function(state){window.FileReader=Original;document.getElementById('status').textContent='Slow export '+state;report('Slow export-'+state);},function(){window.FileReader=Original;report('failed');});}
var timer=setInterval(function(){if(window.__tmContentExport){clearInterval(timer);document.getElementById('status').textContent='Export ready';report('ready');}},100);
var foreign=document.getElementById('foreign');
window.addEventListener('message',function(event){if(event.source===foreign.contentWindow)report('foreign',event.data);});
foreign.srcdoc='<scr'+'ipt>var readable=false;try{readable=!!parent.document.body;}catch(e){};var native=!!window.TMShell;if(native)TMShell.beginContentExport(new Array(65).join("0"),JSON.stringify({v:1,nonce:new Array(65).join("0"),id:"foreign",name:"foreign.bin",mime:"application/octet-stream",bytes:1}));parent.postMessage({native:native,exportApi:!!window.__tmContentExport,parentReadable:readable},"*");<'+'/scr'+'ipt>';
TMShell.ready();
</script></body>""".encode()

DOWNLOAD_PAGE = """<!doctype html><meta charset=utf-8><title>Download fixture</title>
<body style='background:white;color:black;font:24px sans-serif'>
<button style='display:block;min-height:56px;font-size:24px' onclick='audio.play()'>Start download audio</button>
<a href='/download-attachment' download='TongMu-download-smoke.txt' style='display:block;line-height:56px' onclick='clicked=true;report("download-clicked")'>Download authenticated file</a>
<button style='display:block;min-height:56px;font-size:24px' onclick='audio.pause();started=false;publish()'>Stop download audio</button>
<a href='/' style='display:block;line-height:56px'>Return to recovery fixture</a>
<audio id=audio loop src='/tone.wav'></audio>
<img src='/download-cookie-probe' width='1' height='1' alt=''>
<script>
var audio=document.getElementById('audio'),originalAudio=audio,origin=performance.timeOrigin||performance.timing.navigationStart,started=false,clicked=false;
function report(event){fetch('/download-report',{method:'POST',credentials:'include',body:JSON.stringify({event:event,origin:origin,paused:audio.paused,time:audio.currentTime,sameAudio:audio===originalAudio&&document.documentElement.contains(audio),clicked:clicked})})}
function publish(){TMShell.setMediaState(JSON.stringify({v:1,active:started,playing:started&&!audio.paused,canControl:true,title:'Download fixture'}))}
audio.onplaying=function(){started=true;publish();report('download-playing')};
audio.onpause=function(){publish();report('download-paused')};
TMShell.ready();publish();setInterval(function(){report('download-tick')},500);
</script></body>""".encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/native-content-export':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Set-Cookie', 'tm-export-smoke=content-only; Path=/; HttpOnly; SameSite=Lax')
            self.send_header('Content-Length', str(len(CONTENT_EXPORT_PAGE)))
            self.end_headers()
            self.wfile.write(CONTENT_EXPORT_PAGE)
            return
        print("GET %s UA=%s" % (self.path, self.headers.get("User-Agent")), flush=True)
        if self.path == '/download-cookie-probe':
            print('DOWNLOAD_SOURCE_COOKIE ' + str('tm-download-smoke=download-only' in self.headers.get('Cookie', '')), flush=True)
            self.send_response(204)
            self.end_headers()
            return
        if self.path == '/download-attachment':
            authenticated = 'tm-download-smoke=download-only' in self.headers.get('Cookie', '')
            print('DOWNLOAD_AUTHENTICATED ' + str(authenticated), flush=True)
            if not authenticated:
                self.send_error(401)
                return
            body = b'TongMu Android download smoke\n'
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Disposition', 'attachment; filename="TongMu-download-smoke.txt"')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            # Native's second request is intentionally slow enough to exercise
            # Home/background progress, rather than a completed-file screenshot.
            self.server.download_requests = getattr(self.server, 'download_requests', 0) + 1
            try:
                if self.server.download_requests >= 3:
                    for start in range(0, len(body), 5):
                        self.wfile.write(body[start:start + 5])
                        self.wfile.flush()
                        time.sleep(3)
                else:
                    self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if self.path == '/native-download-test':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Set-Cookie', 'tm-download-smoke=download-only; Path=/; HttpOnly; SameSite=Lax')
            self.send_header('Content-Length', str(len(DOWNLOAD_PAGE)))
            self.end_headers()
            self.wfile.write(DOWNLOAD_PAGE)
            return
        if self.path == '/native-external-test' or self.path.startswith('/external-destination?'):
            body = EXTERNAL_PAGE if self.path == '/native-external-test' else EXTERNAL_DESTINATION
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == '/pip-clip.webm' and getattr(self.server, 'video_path', None):
            with open(self.server.video_path, 'rb') as video:
                body = video.read()
            self.send_response(200)
            self.send_header('Content-Type', 'video/webm')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path in ('/tone.wav', '/native-media-test', '/native-session-test', '/native-pip-test') and getattr(self.server, 'recovery_mode', False):
            body = tone_wave() if self.path == '/tone.wav' else SESSION_PAGE if self.path == '/native-session-test' else PIP_PAGE if self.path == '/native-pip-test' else MEDIA_PAGE
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav' if self.path == '/tone.wav' else 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
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
        if self.path == "/" and controls:
            controls += BACK_CONTROLS
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
        if self.path == '/content-export-post':
            self.rfile.read(length)
            authorized = 'tm-export-smoke=content-only' in self.headers.get('Cookie', '')
            print('CONTENT_EXPORT_AUTHENTICATED ' + str(authorized), flush=True)
            body = bytes([0, 255, 1, 0]) + 'authenticated POST blob\n桐木'.encode()
            self.send_response(200 if authorized else 401)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == '/content-export-report':
            print('CONTENT_EXPORT_REPORT ' + self.rfile.read(length).decode(), flush=True)
            self.send_response(204)
            self.end_headers()
            return
        label = "BACK_REPORT" if self.path == "/back-report" else "DOWNLOAD_REPORT" if self.path == "/download-report" else "EXTERNAL_REPORT" if self.path == "/external-report" else "MEDIA_REPORT" if self.path == "/media-report" else "IME_REPORT" if self.path == "/ime-report" else "REPORT"
        print("%s %s" % (label, self.rfile.read(length).decode()), flush=True)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    recovery = len(sys.argv) > 4 and sys.argv[4] == "recovery"
    if len(sys.argv) >= 4:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(sys.argv[2], sys.argv[3])
        secure = SecureFixtureServer(("0.0.0.0", 8443), Handler, context)
        secure.recovery_mode = recovery
        threading.Thread(target=secure.serve_forever, daemon=True).start()
    server = HTTPServer(("0.0.0.0", int(sys.argv[1])), Handler)
    server.recovery_mode = recovery
    server.video_path = sys.argv[5] if len(sys.argv) > 5 else None
    server.serve_forever()
