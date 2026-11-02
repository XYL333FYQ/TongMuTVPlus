#!/usr/bin/env bash
# 模拟器冒烟测试：装 APK -> 启动 -> 在地址框输入假服务器 -> 确认 WebView 真的请求了页面且没崩溃
# 用法：smoke.sh <apk> <截图输出目录> [包名，默认手机版]
set -uo pipefail

APK="$1"
OUT="$2"
PKG="${3:-com.tongmutvplus.mobile}"
mkdir -p "$OUT"
API_LEVEL=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
BACK_NAV_RESTORE=
BACK_INPUT=key
restore_back_navigation() {
  if [ "$BACK_NAV_RESTORE" = disable ]; then
    adb shell cmd overlay disable --user 0 com.android.internal.systemui.navbar.gestural >/dev/null 2>&1
  elif [ -n "$BACK_NAV_RESTORE" ]; then
    adb shell cmd overlay enable-exclusive --user 0 --category "$BACK_NAV_RESTORE" >/dev/null 2>&1
  fi
}
app_pid() {
  if [ "$API_LEVEL" -ge 26 ]; then adb shell ps -A >"$OUT/app-processes.txt";
  else adb shell ps >"$OUT/app-processes.txt"; fi
  python3 "$(dirname "$0")/process_pid.py" "$OUT/app-processes.txt" "$PKG"
}

TLS_DIR=$(mktemp -d)
SERVER_PID=
trap 'restore_back_navigation; if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null; fi; rm -f "$TLS_DIR/key.pem" "$TLS_DIR/cert.pem" "$TLS_DIR/video.webm"; rmdir "$TLS_DIR" 2>/dev/null' EXIT
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TLS_DIR/key.pem" -out "$TLS_DIR/cert.pem" -subj '/CN=smoke.invalid' -days 1 >/dev/null 2>&1 || exit 1
fixture_mode=standard
[ "$PKG" = "com.tongmutvplus.mobile" ] && fixture_mode=recovery
if [ "$PKG" = "com.tongmutvplus.mobile" ] && [ "$API_LEVEL" -ge 29 ]; then
  # Disposable emulator only, before Activity creation. Keep gesture mode for
  # the entire run so changing navigation mode cannot rebuild the test document.
  adb shell cmd overlay list --user 0 >"$OUT/back-overlays-before.txt" || exit 1
  previous=$(awk '$1 == "[x]" && $2 ~ /^com\.android\.internal\.systemui\.navbar\.(threebutton|twobutton|gestural)/ {print $2}' "$OUT/back-overlays-before.txt" | head -1 | tr -d '\r')
  BACK_NAV_RESTORE=${previous:-disable}
  adb shell cmd overlay enable-exclusive --user 0 --category com.android.internal.systemui.navbar.gestural || exit 1
  for _ in $(seq 1 10); do
    adb shell settings get secure navigation_mode | tr -d '\r' >"$OUT/back-navigation-mode.txt"
    grep -qx 2 "$OUT/back-navigation-mode.txt" && break
    sleep 1
  done
  grep -qx 2 "$OUT/back-navigation-mode.txt" || exit 1
  adb shell cmd overlay list --user 0 >"$OUT/back-overlays-active.txt" || exit 1
  grep -Fq '[x] com.android.internal.systemui.navbar.gestural' "$OUT/back-overlays-active.txt" || exit 1
  BACK_INPUT=edge-swipe
fi
printf '%s\n' "$BACK_INPUT" >"$OUT/back-input.txt"
if [ "$PKG" = "com.tongmutvplus.mobile" ] && [ "$API_LEVEL" -ge 33 ]; then
  curl --fail --location --max-time 30 https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm -o "$TLS_DIR/video.webm" || exit 1
  echo 'c6f8a348953395598a9a73b9bab1676436410797bce9f398f4be1531d6e76dda  '"$TLS_DIR/video.webm" | sha256sum -c - || exit 1
fi
python3 "$(dirname "$0")/smoke_server.py" 8080 "$TLS_DIR/cert.pem" "$TLS_DIR/key.pem" "$fixture_mode" "$TLS_DIR/video.webm" >"$OUT/server.log" 2>&1 &
SERVER_PID=$!

adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -n "$PKG/.MainActivity"
sleep 8
APP_PID=$(app_pid) || exit 1
adb exec-out screencap -p >"$OUT/1-dialog.png"

# 首次启动应弹出地址框：输入模拟器访问宿主机的地址并回车
adb shell input text "10.0.2.2:8080"
sleep 1
adb shell input keyevent 66
# 模拟器网络和 WebView 首次初始化偶尔很慢：最多等 45 秒，等到假服务器收到请求就继续
for _ in $(seq 1 45); do
  grep -q "TongMuTVPlusAndroid" "$OUT/server.log" && break
  sleep 1
done
# 页面会在加载后约 3 秒报告壳注入的结果；最多再等 20 秒
for _ in $(seq 1 20); do
  grep -q '^REPORT ' "$OUT/server.log" && break
  sleep 1
done
adb exec-out screencap -p >"$OUT/2-page.png"

# Exercise real system IME in the mobile APK, rather than inferring it from a
# smaller synthetic viewport. API24 uses legacy insets; API34 uses Type.ime().
if [ "$PKG" = "com.tongmutvplus.mobile" ]; then
  adb shell settings put secure show_ime_with_hard_keyboard 1
  keyboard_input=false
  for attempt in $(seq 1 5); do
    adb shell uiautomator dump /sdcard/keyboard-smoke.xml >/dev/null
    adb exec-out cat /sdcard/keyboard-smoke.xml >"$OUT/keyboard-before.xml"
    if point=$(python3 - "$OUT/keyboard-before.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
nodes = list(root.iter('node'))
# setPlaying() in this fixture also exercises the media service. On API33+
# its notification permission prompt is a separate native layer above input.
for kind, match in (
    ('permission', lambda n: n.get('resource-id', '').endswith(':id/permission_deny_button')),
    ('input', lambda n: n.get('class') == 'android.widget.EditText'),
):
    for node in nodes:
        if match(node):
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
            print(kind, (x1 + x2) // 2, (y1 + y2) // 2)
            sys.exit(0)
sys.exit('Keyboard smoke input was absent from accessibility tree')
PY
    ); then
      read -r target tap_x tap_y <<<"$point"
      adb shell input tap "$tap_x" "$tap_y"
      if [ "$target" = input ]; then
        keyboard_input=true
        break
      fi
      echo 'Notification permission declined in emulator; continuing IME check'
    fi
    sleep 1
  done
  if [ "$keyboard_input" = true ]; then
    for _ in $(seq 1 15); do
      grep -q 'IME_REPORT.*"keyboard":"open"' "$OUT/server.log" && break
      sleep 1
    done
    adb exec-out screencap -p >"$OUT/3-keyboard-open.png"
    adb shell input keyevent 4
    sleep 2
    adb exec-out screencap -p >"$OUT/4-keyboard-closed.png"
  fi
fi

# A real HTTP failure, invalid main-frame TLS and renderer loss must use the
# native recovery surface. Broken poster HTTP/TLS must leave the page usable.
recovery_status=0
if [ "$PKG" = "com.tongmutvplus.mobile" ]; then
  ui_target() {
    adb shell uiautomator dump /sdcard/recovery-smoke.xml >/dev/null 2>&1
    adb exec-out cat /sdcard/recovery-smoke.xml >"$OUT/recovery-latest.xml"
    python3 "$(dirname "$0")/ui_target.py" "$OUT/recovery-latest.xml" "$1" "$2"
  }
  wait_target() {
    for _ in $(seq 1 "${3:-12}"); do
      if ui_target "$1" "$2"; then return 0; fi
      sleep 1
    done
    echo "Missing recovery target: $1 $2" >&2
    adb exec-out screencap -p >"$OUT/missing-target.png"
    return 1
  }
  tap_target() {
    local point x y
    point=$(wait_target "$1" "$2") || return 1
    read -r x y <<<"$point"
    adb shell input tap "$x" "$y"
  }
  native_back() {
    if [ "$BACK_INPUT" = edge-swipe ]; then
      local label=${1:-attempt}
      adb shell dumpsys activity service com.android.systemui/.SystemUIService >"$OUT/back-system-before-$label.txt" 2>&1
      adb shell dumpsys window windows >"$OUT/back-windows-before-$label.txt" 2>&1
      adb shell dumpsys activity activities >"$OUT/back-activities-before-$label.txt" 2>&1
      adb shell wm size >"$OUT/back-window-size.txt" || return 1
      local size width height
      size=$(sed -n 's/.*size: \([0-9]*x[0-9]*\).*/\1/p' "$OUT/back-window-size.txt" | tail -1 | tr -d '\r')
      [[ "$size" =~ ^[0-9]+x[0-9]+$ ]] || return 1
      read -r width height <<<"${size/x/ }"
      adb shell input swipe 2 "$((height / 2))" "$((width * 3 / 4))" "$((height / 2))" 350 || return 1
      adb shell dumpsys activity service com.android.systemui/.SystemUIService >"$OUT/back-system-after-$label.txt" 2>&1
      adb shell dumpsys activity activities >"$OUT/back-activities-after-$label.txt" 2>&1
    else
      adb shell input keyevent 4
    fi
  }
  diagnose_back_input() {
    [ "$BACK_INPUT" = edge-swipe ] || return 0
    # Do not turn a failed gesture into a pass by falling back to key input.
    # These controls only identify the boundary after the strict check failed.
    adb shell input keyevent 4
    sleep 2
    adb exec-out screencap -p >"$OUT/back-key-control.png"
    grep '^BACK_REPORT ' "$OUT/server.log" >"$OUT/back-key-control.txt"
    adb shell am start -a android.settings.SETTINGS >"$OUT/back-settings-start.txt" 2>&1
    sleep 1
    adb shell am start -a android.settings.WIFI_SETTINGS >>"$OUT/back-settings-start.txt" 2>&1
    sleep 2
    adb exec-out screencap -p >"$OUT/back-settings-before.png"
    native_back settings-control
    sleep 2
    adb exec-out screencap -p >"$OUT/back-settings-after.png"
  }
  verify_back_chain() {
    wait_target text 'BACK root' >/dev/null || return 1
    tap_target text 'Back detail' || return 1
    wait_target text 'BACK detail' >/dev/null || return 1
    tap_target text 'Back overlay' || return 1
    wait_target text 'BACK overlay' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/4b-back-overlay.png"
    native_back overlay || return 1
    if ! wait_target text 'BACK detail' >/dev/null; then
      diagnose_back_input
      return 1
    fi
    adb exec-out screencap -p >"$OUT/4c-back-overlay-closed.png"
    native_back history || return 1
    wait_target text 'BACK root' >/dev/null || return 1
    for _ in $(seq 1 8); do
      grep -q '^BACK_REPORT .*"phase":"history-root"' "$OUT/server.log" && break
      sleep 1
    done
    python3 "$(dirname "$0")/check_back.py" "$OUT/server.log" "$OUT/back-chain.json" || return 1
    [ "$(app_pid)" = "$APP_PID" ] || return 1
    adb exec-out screencap -p >"$OUT/4d-back-history-root.png"
    echo "PASS: $BACK_INPUT closes overlay before SPA history without replacing document or host"
  }
  verify_file_download() {
    tap_target text 'Native download test' || return 1
    tap_target text 'Start download audio' || return 1
    sleep 1
    tap_target text 'Download authenticated file' || return 1
    wait_target text '下载文件' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/19-download-confirm.png"
    tap_target text '取消' || return 1
    wait_target text 'Stop download audio' >/dev/null || return 1
    tap_target text 'Download authenticated file' || return 1
    tap_target text '下载' || return 1
    if [ "$API_LEVEL" -lt 29 ]; then
      tap_target id permission_deny_button || return 1
      wait_target text 'Stop download audio' >/dev/null || return 1
      adb exec-out screencap -p >"$OUT/19-download-storage-denied.png"
      tap_target text 'Download authenticated file' || return 1
      tap_target text '下载' || return 1
      tap_target id permission_allow_button || return 1
    fi
    adb shell input keyevent 3
    sleep 2
    adb shell cmd statusbar expand-notifications || return 1
    wait_target text '正在下载' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/19-download-background-progress.png"
    adb shell cmd statusbar collapse || return 1
    adb shell am start -n "$PKG/.MainActivity" >/dev/null || return 1
    for _ in $(seq 1 30); do
      adb logcat -d -s TongMuClient >"$OUT/download-native.log"
      grep -q 'file download completed' "$OUT/download-native.log" && break
      sleep 1
    done
    grep -q 'file download completed' "$OUT/download-native.log" || return 1
    downloaded=$(adb shell 'ls /sdcard/Download/TongMu-download-smoke-*.txt 2>/dev/null' | tr -d '\r')
    [[ "$downloaded" =~ ^/sdcard/Download/TongMu-download-smoke-[0-9]+\.txt$ ]] || return 1
    adb pull "$downloaded" "$OUT/download-smoke.txt" || return 1
    wait_target text 'Stop download audio' >/dev/null || return 1
    sleep 2
    python3 "$(dirname "$0")/check_download.py" "$OUT/server.log" "$OUT/download-smoke.txt" || return 1
    adb exec-out screencap -p >"$OUT/19-download-complete.png"
    adb shell cmd statusbar expand-notifications || return 1
    wait_target text '下载完成' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/19-download-complete-notification.png"
    adb shell cmd statusbar collapse || return 1
    tap_target text 'Stop download audio' || return 1
  }
  verify_recovery() {
    wait_target absent-id tm_load_surface >/dev/null || return 1
    grep -q 'GET /missing.png' "$OUT/server.log" || return 1
    verify_back_chain || return 1
    tap_target text 'Light theme' || return 1
    tap_target text 'HTTP failure test' || return 1
    wait_target text '服务暂时不可用' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/5-http-native-recovery.png"
    tap_target id tm_load_retry || return 1
    wait_target absent-id tm_load_surface >/dev/null || return 1
    wait_target text 'HTTP failure test' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/6-http-retried.png"
    tap_target text 'TLS failure test' || return 1
    # Keep the assertion strict, but observe beyond the 40-second native watchdog
    # so a missing callback is not confused with an already-visible loading view.
    wait_target text '安全连接未通过验证' 22 >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/7-tls-native-recovery.png"
    tap_target id tm_load_settings || return 1
    # The address dialog retains the original HTTP server, not the bad TLS URL.
    sleep 1
    adb shell input keyevent 66
    wait_target absent-id tm_load_surface >/dev/null || return 1
    wait_target text 'HTTP failure test' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/8-server-restored.png"
    tap_target text 'Back from failure test' || return 1
    wait_target text '服务暂时不可用' >/dev/null || return 1
    adb shell input keyevent 4
    wait_target absent-id tm_load_surface >/dev/null || return 1
    wait_target text 'HTTP failure test' >/dev/null || return 1
    adb exec-out screencap -p >"$OUT/8b-native-error-back.png"

    if [ "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" -ge 26 ]; then
      adb root >/dev/null 2>&1
      timeout 30 adb wait-for-device || return 1
      local host_before renderer signal
      host_before=$(app_pid) || return 1
      [ "$host_before" = "$APP_PID" ] || return 1
      for signal in KILL SEGV; do
        adb shell ps -A >"$OUT/processes-before-$signal.txt"
        renderer=$(python3 - "$OUT/processes-before-$signal.txt" <<'PY'
import sys
lines = [line.split() for line in open(sys.argv[1]) if line.strip()]
pid_index = lines[0].index('PID')
pids = [row[pid_index] for row in lines[1:] if 'webview' in row[-1] and 'sandboxed_process' in row[-1]]
if len(pids) != 1 or not pids[0].isdigit():
    sys.exit('Expected one WebView renderer in this isolated emulator')
print(pids[0])
PY
        ) || return 1
        adb shell kill -"$signal" "$renderer" || return 1
        wait_target text '显示内容已中断' >/dev/null || return 1
        [ "$(app_pid)" = "$host_before" ] || return 1
        adb exec-out screencap -p >"$OUT/9-renderer-$signal-native-recovery.png"
        tap_target id tm_load_retry || return 1
        wait_target absent-id tm_load_surface >/dev/null || return 1
        wait_target text 'HTTP failure test' >/dev/null || return 1
        adb exec-out screencap -p >"$OUT/10-renderer-$signal-retried.png"
      done
    else
      echo 'Renderer callback unavailable below API26; host recovery is not claimed'
    fi
    echo 'PASS: native HTTP/TLS recovery and applicable renderer recovery'
    if [ "$API_LEVEL" -ge 33 ]; then
      # Grant only in this isolated emulator, after the earlier real IME test.
      adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || return 1
      tap_target text 'Native media permission test' || return 1
      tap_target text 'Start controlled media' || return 1
      for _ in $(seq 1 15); do
        grep -q 'MEDIA_REPORT.*"event":"playing"' "$OUT/server.log" && break
        sleep 1
      done
      grep -q 'MEDIA_REPORT.*"event":"playing"' "$OUT/server.log" || return 1
      adb shell dumpsys media_session >"$OUT/13-media-sessions.txt"
      adb shell cmd statusbar expand-notifications || return 1
      tap_target media-action pause || return 1
      sleep 1
      adb exec-out screencap -p >"$OUT/13-notification-blocked.png"
      grep -q 'MEDIA_REPORT.*"event":"blocked","paused":false' "$OUT/server.log" || return 1
      if grep -q 'MEDIA_REPORT.*"event":"paused"' "$OUT/server.log"; then return 1; fi
      adb shell cmd statusbar collapse || return 1
      tap_target text 'Allow media pause' || return 1
      adb shell cmd statusbar expand-notifications || return 1
      tap_target media-action pause || return 1
      sleep 1
      grep -q 'MEDIA_REPORT.*"event":"allowed","paused":false' "$OUT/server.log" || return 1
      grep -q 'MEDIA_REPORT.*"event":"paused","paused":true' "$OUT/server.log" || return 1
      adb exec-out screencap -p >"$OUT/14-notification-paused.png"
      adb shell cmd statusbar collapse || return 1
      tap_target text 'Return to recovery fixture' || return 1
      echo 'PASS: native notification uses page media action; denied action keeps playing, allowed action pauses'
      tap_target text 'Native session test' || return 1
      tap_target text 'Start session media' || return 1
      for _ in $(seq 1 10); do
        grep -q 'MEDIA_REPORT.*"event":"session-playing"' "$OUT/server.log" && break
        sleep 1
      done
      grep -q 'MEDIA_REPORT.*"event":"session-playing"' "$OUT/server.log" || return 1
      native_session() {
        local state="$1" snapshot="$OUT/15-session-$1.txt"
        for _ in $(seq 1 10); do
          adb shell dumpsys media_session >"$snapshot"
          python3 "$(dirname "$0")/check_media_session.py" "$snapshot" "$state" && return 0
          sleep 1
        done
        return 1
      }
      native_session playing || return 1
      adb shell input keyevent 3
      sleep 1
      adb shell cmd media_session dispatch pause || return 1
      native_session paused || return 1
      grep -q 'MEDIA_REPORT.*"event":"session-paused","paused":true,"calls":1' "$OUT/server.log" || return 1
      adb shell cmd statusbar expand-notifications || return 1
      adb exec-out screencap -p >"$OUT/15-session-paused-notification.png"
      adb shell cmd statusbar collapse || return 1
      adb shell cmd media_session dispatch play || return 1
      native_session playing || return 1
      grep -q 'MEDIA_REPORT.*"event":"session-playing","paused":false,"calls":2' "$OUT/server.log" || return 1
      adb shell am start -n "$PKG/.MainActivity" >/dev/null || return 1
      tap_target text 'Lock session controls' || return 1
      native_session locked || return 1
      adb shell cmd media_session dispatch pause || return 1
      sleep 1
      native_session locked || return 1
      if grep -q 'MEDIA_REPORT.*"calls":3' "$OUT/server.log"; then return 1; fi
      tap_target text 'Remove session media' || return 1
      native_session absent || return 1
      tap_target text 'Return to recovery fixture' || return 1
      echo 'PASS: single native session, actual metadata, background pause/resume, locked controls and removal cleanup'
      tap_target text 'Native PiP test' || return 1
      tap_target text 'Start full video' || return 1
      for _ in $(seq 1 10); do
        python3 "$(dirname "$0")/check_pip.py" "$OUT/server.log" fullscreen && break
        sleep 1
      done
      python3 "$(dirname "$0")/check_pip.py" "$OUT/server.log" fullscreen || return 1
      sleep 1
      adb shell input keyevent 3
      for _ in $(seq 1 10); do
        adb shell dumpsys activity activities >"$OUT/16-pip-activities.txt"
        python3 "$(dirname "$0")/check_pip_window.py" "$OUT/16-pip-activities.txt" && break
        sleep 1
      done
      python3 "$(dirname "$0")/check_pip_window.py" "$OUT/16-pip-activities.txt" || return 1
      sleep 1
      adb exec-out screencap -p >"$OUT/16-pip-playing.png"
      adb shell cmd media_session dispatch pause || return 1
      sleep 1
      python3 "$(dirname "$0")/check_pip.py" "$OUT/server.log" paused || return 1
      adb shell cmd media_session dispatch play || return 1
      sleep 2
      python3 "$(dirname "$0")/check_pip.py" "$OUT/server.log" resumed || return 1
      adb shell am start -n "$PKG/.MainActivity" >/dev/null || return 1
      sleep 1
      python3 "$(dirname "$0")/check_pip.py" "$OUT/server.log" returned || return 1
      adb exec-out screencap -p >"$OUT/17-pip-returned.png"
      adb shell input keyevent 4
      tap_target text 'Return to recovery fixture' || return 1
      echo 'PASS: actual Android PiP, same decoded video/document, system pause/resume and fullscreen return'
      tap_target text 'Native external test' || return 1
      wait_target text 'Open external anchor' >/dev/null || return 1
      sleep 2
      python3 "$(dirname "$0")/check_external.py" "$OUT/server.log" automatic || return 1
      for kind in anchor script; do
        tap_target text "Open external $kind" || return 1
        sleep 2
        adb shell dumpsys activity activities >"$OUT/18-external-$kind-activities.txt"
        adb exec-out screencap -p >"$OUT/18-external-$kind.png"
        python3 "$(dirname "$0")/check_external.py" "$OUT/server.log" "$kind" "$OUT/18-external-$kind-activities.txt" || return 1
        adb shell am start -n "$PKG/.MainActivity" >/dev/null || return 1
        wait_target text 'Open external anchor' >/dev/null || return 1
        sleep 1
        python3 "$(dirname "$0")/check_external.py" "$OUT/server.log" automatic || return 1
      done
      adb exec-out screencap -p >"$OUT/18-external-returned.png"
      verify_file_download || return 1
      tap_target text 'Return to recovery fixture' || return 1
      echo 'PASS: actual anchor/window.open handoff, source retained and automatic popup blocked'
    fi
    if [ "$API_LEVEL" -lt 29 ]; then
      tap_target text 'Native external test' || return 1
      verify_file_download || return 1
      tap_target text 'Return to recovery fixture' || return 1
    fi
    if [ "$API_LEVEL" -ge 26 ]; then
      tap_target text 'Update permission test' || return 1
      wait_target text 'Update missing package test' >/dev/null || return 1
      adb shell appops set "$PKG" REQUEST_INSTALL_PACKAGES deny || return 1
      tap_target text 'Update missing package test' || return 1
      sleep 2
      adb exec-out screencap -p >"$OUT/11-update-permission.png"
      adb shell input keyevent 4
      wait_target text 'Update missing package test' >/dev/null || return 1
      adb logcat -d -s TongMuClient >"$OUT/update-denied.log"
      grep -q 'update permission not granted' "$OUT/update-denied.log" || return 1
      if grep -q 'update queued' "$OUT/update-denied.log"; then return 1; fi
      tap_target text 'Update missing package test' || return 1
      sleep 2
      # Test-only permission change while the actual Settings Activity is open.
      # The destination deliberately returns no APK; the test never installs.
      adb shell appops set "$PKG" REQUEST_INSTALL_PACKAGES allow || return 1
      adb shell input keyevent 4
      wait_target text 'Update missing package test' >/dev/null || return 1
      adb logcat -d -s TongMuClient >"$OUT/update-granted.log"
      grep -q 'update queued' "$OUT/update-granted.log" || return 1
      adb exec-out screencap -p >"$OUT/12-update-resumed.png"
      echo 'PASS: denied permission does not download; granted Settings return queues original request'
    fi
  }
  verify_recovery || recovery_status=1
fi

adb logcat -d >"$OUT/logcat.txt"

status=$recovery_status
if [ "$(app_pid)" != "$APP_PID" ]; then
  echo "FAIL: 应用进程已退出或意外重启"
  status=1
fi
if ! python3 "$(dirname "$0")/check_logcat.py" "$OUT/logcat.txt" "$PKG" "$APP_PID"; then
  status=1
fi
if grep -q "TongMuTVPlusAndroid" "$OUT/server.log"; then
  echo "PASS: WebView 已请求假服务器页面"
else
  echo "FAIL: 假服务器没收到带 TongMuTVPlusAndroid 的请求"
  cat "$OUT/server.log"
  status=1
fi
# 只有手机壳有 TMShell 对接；电视壳共用本脚本，不检查这一项
if [ "$PKG" = "com.tongmutvplus.mobile" ]; then
  if grep -q 'IME_REPORT.*"keyboard":"open","source":"native"' "$OUT/server.log" &&
      [ "$(grep 'IME_REPORT' "$OUT/server.log" | tail -1)" = 'IME_REPORT {"keyboard":"closed","source":"native"}' ]; then
    echo "PASS: 系统输入法打开/返回关闭，网页收到真实 native 标记"
  else
    echo "FAIL: 系统输入法开关未完整传递到网页"
    grep IME_REPORT "$OUT/server.log"
    status=1
  fi
  if grep -q 'REPORT.*"bridge":true' "$OUT/server.log" && grep -q 'REPORT.*"shell":"android"' "$OUT/server.log"; then
    echo "PASS: 网页认到了 TMShell，壳已铺满屏幕并注入系统栏高度"
  else
    echo "FAIL: 壳没有回应网页的 ready()（没有注入 data-tm-shell）"
    grep REPORT "$OUT/server.log"
    status=1
  fi
  if grep -Eq 'UA=.*TMBuild/[0-9]{12}' "$OUT/server.log"; then
    echo "PASS: UA 里带有 12 位构建时间"
  else
    echo "FAIL: UA 里没有 TMBuild/构建时间"
    grep "GET" "$OUT/server.log" | head -3
    status=1
  fi
fi
exit $status
