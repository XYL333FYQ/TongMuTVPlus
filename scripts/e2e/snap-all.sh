#!/bin/bash
# 拍一整套计算样式快照（主账号 + 成员账号），测试站崩了就等看门狗把它拉起来再续拍。
# 用法：scripts/e2e/snap-all.sh <输出目录> [页面...]
# 用哪个 Node：环境变量 NODE（默认 PATH 上的 node，应为 24 版）。
cd "$(dirname "$0")/../.." || exit 1
N=${NODE:-node}
BASE=${SNAP_BASE:-http://localhost:3100}
OUT="$1"; shift
LOG="$OUT.log"
wait_up() {
  for _ in $(seq 1 60); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' -m 120 "$BASE/login")" = 200 ] && return 0
    sleep 5
  done
  return 1
}
run() {
  for i in $(seq 1 25); do
    wait_up || { echo "server never came up"; return 1; }
    "$@" > "$LOG" 2>&1 && return 0
    echo "retry $i: $(grep -m1 -o 'Error: .\{0,120\}' "$LOG")"
  done
  return 1
}
# Git Bash 下把路径转成 Windows 写法给 Node；其他系统原样用
W=$(cygpath -w "$OUT" 2>/dev/null || printf '%s' "$OUT")
run "$N" scripts/e2e/style-snapshot.mjs snap "$W" "$@" && echo "main ok"
if [ $# -eq 0 ] || printf '%s\n' "$@" | grep -q '^lobby'; then
  run env SNAP_USER=member "$N" scripts/e2e/style-snapshot.mjs snap "$W" "$@" && echo "member ok"
fi
echo "count: $(ls "$OUT" | wc -l)"
