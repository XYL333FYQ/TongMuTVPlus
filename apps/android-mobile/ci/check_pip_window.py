"""Pinned intent/state alone does not prove the fullscreen-to-PiP transition finished."""
import re
import sys
from pathlib import Path

lines = Path(sys.argv[1]).read_text(errors='replace').splitlines()
starts = [index for index, line in enumerate(lines)
          if 'Task{' in line and 'com.tongmutvplus.mobile' in line and 'mode=pinned' in line]
assert starts, 'No owned pinned task'
config = next((line for line in lines[starts[0]:starts[0] + 50]
               if line.strip().startswith('CurrentConfiguration=')), '')
assert 'mWindowingMode=pinned' in config, 'Activity is still using its fullscreen transition configuration'

def size(field):
    match = re.search(field + r'=Rect\((-?\d+),\s*(-?\d+)\s*-\s*(-?\d+),\s*(-?\d+)\)', config)
    assert match, 'Missing actual window bounds: ' + field
    left, top, right, bottom = map(int, match.groups())
    return right - left, bottom - top

width, height = size('mBounds')
maximum_width, maximum_height = size('mMaxBounds')
assert width > 0 and height > 0 and width * height < maximum_width * maximum_height / 2, 'PiP has not actually shrunk below fullscreen'
print('PASS: settled native PiP bounds %dx%d within %dx%d' % (width, height, maximum_width, maximum_height))
