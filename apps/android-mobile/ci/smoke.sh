#!/usr/bin/env bash
# 模拟器冒烟测试：装 APK -> 启动 -> 在地址框输入假服务器 -> 确认 WebView 真的请求了页面且没崩溃
# 用法：smoke.sh <apk> <截图输出目录> [包名，默认手机版]
set -uo pipefail

APK="$1"
OUT="$2"
PKG="${3:-com.tongmutvplus.mobile}"
mkdir -p "$OUT"

python3 "$(dirname "$0")/smoke_server.py" 8080 >"$OUT/server.log" 2>&1 &
SERVER_PID=$!

adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -n "$PKG/.MainActivity"
sleep 8
adb exec-out screencap -p >"$OUT/1-dialog.png"

# 首次启动应弹出地址框：输入模拟器访问宿主机的地址并回车
adb shell input text "10.0.2.2:8080"
sleep 1
adb shell input keyevent 66
sleep 10
adb exec-out screencap -p >"$OUT/2-page.png"

adb logcat -d >"$OUT/logcat.txt"
kill "$SERVER_PID" 2>/dev/null

status=0
if [ -z "$(adb shell pidof $PKG | tr -d '\r')" ]; then
  echo "FAIL: 应用进程不在运行"
  status=1
fi
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt"; then
  echo "FAIL: logcat 里有崩溃"
  grep -A 20 "FATAL EXCEPTION" "$OUT/logcat.txt" | head -60
  status=1
fi
if grep -q "TongMuTVPlusAndroid" "$OUT/server.log"; then
  echo "PASS: WebView 已请求假服务器页面"
else
  echo "FAIL: 假服务器没收到带 TongMuTVPlusAndroid 的请求"
  cat "$OUT/server.log"
  status=1
fi
exit $status
