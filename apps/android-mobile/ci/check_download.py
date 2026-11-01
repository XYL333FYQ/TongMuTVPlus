"""Require actual saved bytes and the original playing media/document."""
import json
import pathlib
import sys

log = pathlib.Path(sys.argv[1]).read_text()
rows = [json.loads(line.split('DOWNLOAD_REPORT ', 1)[1]) for line in log.splitlines()
        if line.startswith('DOWNLOAD_REPORT ')]
assert rows and len({row['origin'] for row in rows}) == 1, 'Download recreated the source document'
assert all(row['sameAudio'] for row in rows), 'Download replaced the media element'
clicked = [row for row in rows if row['clicked']]
assert len(clicked) >= 3 and all(not row['paused'] for row in clicked), 'Playback stopped during download'
assert len({row['time'] for row in clicked}) >= 3, 'Media time did not advance'
assert 'DOWNLOAD_AUTHENTICATED True' in log and 'DOWNLOAD_AUTHENTICATED False' not in log, 'Download lost its authentication'
assert pathlib.Path(sys.argv[2]).read_bytes() == b'TongMu Android download smoke\n', 'Saved file is not the attachment'
print('PASS: actual authenticated attachment bytes, original document/audio and continuous playback')
