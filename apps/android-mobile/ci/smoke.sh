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
# 模拟器网络和 WebView 首次初始化偶尔很慢：最多等 45 秒，等到假服务器收到请求就继续
for _ in $(seq 1 45); do
  grep -q "TongMuTVPlusAndroid" "$OUT/server.log" && break
  sleep 1
done
# 页面会在加载后约 3 秒报告壳注入的结果；最多再等 20 秒
for _ in $(seq 1 20); do
  grep -q "REPORT" "$OUT/server.log" && break
  sleep 1
done
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
# 只有手机壳有 TMShell 对接；电视壳共用本脚本，不检查这一项
if [ "$PKG" = "com.tongmutvplus.mobile" ]; then
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
