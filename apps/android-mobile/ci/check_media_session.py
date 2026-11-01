"""Assert this app's actual system session, independent of unrelated OS sessions."""
import re
import sys
from pathlib import Path

lines = Path(sys.argv[1]).read_text(errors='replace').splitlines()
expected = sys.argv[2]
records = []
for index, line in enumerate(lines):
    if line.strip() != 'package=com.tongmutvplus.mobile':
        continue
    indent = len(line) - len(line.lstrip())
    end = index + 1
    while end < len(lines) and (not lines[end].strip() or len(lines[end]) - len(lines[end].lstrip()) >= indent):
        end += 1
    record = '\n'.join(lines[index:end])
    if re.search(r'^\s*active=true\s*$', record, re.M):
        records.append(record)
if expected == 'absent':
    assert not records, 'Removed media left an active system session'
else:
    assert len(records) == 1, 'Expected exactly one active app session, got %d' % len(records)
    record = records[0]
    assert (sys.argv[3] if len(sys.argv) > 3 else 'Native session fixture') in record, 'Actual system metadata is missing'
    state = 'PAUSED' if expected == 'paused' else 'PLAYING'
    code = 2 if expected == 'paused' else 3
    assert re.search(r'state=(?:%s\(%d\)|%d)(?:,|\s)' % (state, code, code), record), 'Unexpected real playback state'
    if expected == 'locked':
        assert re.search(r'actions=0(?:,|\s)', record), 'Locked session still offers control actions'
print('PASS: actual native media session ' + expected)
