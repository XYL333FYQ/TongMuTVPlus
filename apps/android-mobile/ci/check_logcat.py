"""Fail for the tested app's crashes; keep unrelated emulator/tool failures visible."""
import re
import sys

path, package = sys.argv[1:3]
host_pid = int(sys.argv[3]) if len(sys.argv) > 3 else None
fatal = set()
app_pids = {host_pid} if host_pid else set()
lines = open(path, encoding="utf-8", errors="replace").readlines()
native_host_failure = False
for line in lines:
    if host_pid and "Fatal signal" in line and re.search(r"\bpid\s+%s\b" % host_pid, line):
        native_host_failure = True
    match = re.search(r"\s(\d+)\s+\d+\s+[A-Z]\s+AndroidRuntime:\s*(.*)$", line)
    if not match:
        continue
    pid, message = int(match.group(1)), match.group(2)
    if "FATAL EXCEPTION:" in message:
        fatal.add(pid)
    process = re.match(r"Process:\s*([^,]+),\s*PID:", message)
    if process and (process.group(1) == package or process.group(1).startswith(package + ":")):
        app_pids.add(pid)
own = fatal & app_pids
if own or native_host_failure:
    print("FAIL: tested app has fatal log records; pids=", sorted(own))
    sys.exit(1)
print("PASS: no tested-app fatal records; unrelated emulator/tool fatal processes=", len(fatal - app_pids))
