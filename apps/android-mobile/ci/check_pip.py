"""Compare real media heartbeats across the Android PiP lifecycle."""
import json
import sys
from pathlib import Path

rows = [json.loads(line.split('MEDIA_REPORT ', 1)[1]) for line in Path(sys.argv[1]).read_text().splitlines()
        if line.startswith('MEDIA_REPORT ') and '"event":"pip-' in line]
assert rows, 'No decoded PiP video reports'
assert all(row['sameVideo'] for row in rows), 'Video DOM was replaced or removed'
assert len({row['origin'] for row in rows}) == 1, 'Document reloaded during PiP'
if sys.argv[2] == 'fullscreen':
    assert any(row['fullscreen'] and not row['paused'] for row in rows), 'Video never entered fullscreen'
elif sys.argv[2] == 'paused':
    assert any(row['event'] == 'pip-paused' and row['calls'] == 1 for row in rows), 'System pause never reached the same video'
elif sys.argv[2] == 'resumed':
    paused = next(row for row in rows if row['event'] == 'pip-paused' and row['calls'] == 1)
    assert any(row['calls'] == 2 and not row['paused'] and row.get('duration', 0) > 0
               and (row['time'] - paused['time'] + row['duration']) % row['duration'] > 0.15
               for row in rows), 'Video time did not advance after system resume'
elif sys.argv[2] == 'returned':
    assert rows[-1]['fullscreen'] and rows[-1]['calls'] == 2 and not rows[-1]['paused'], 'Returning lost fullscreen or playback'
elif sys.argv[2] == 'exited':
    assert not rows[-1]['fullscreen'] and rows[-1]['calls'] == 2 and not rows[-1]['paused'], 'Native back did not exit fullscreen with the original playing video'
print('PASS: same decoded video/document PiP ' + sys.argv[2])
