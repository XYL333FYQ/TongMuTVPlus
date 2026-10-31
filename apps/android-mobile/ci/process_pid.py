"""Match the tested main process exactly, including old Android ps formats."""
import sys

rows = [line.split() for line in open(sys.argv[1], encoding="utf-8", errors="replace") if line.strip()]
index = rows[0].index("PID")
pids = [row[index] for row in rows[1:] if row[-1] == sys.argv[2]]
if len(pids) != 1 or not pids[0].isdigit():
    sys.exit("Expected exactly one tested main process")
print(pids[0])
