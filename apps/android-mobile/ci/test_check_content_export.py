import copy
import json
from check_content_export import verify

generated = bytes(index % 251 for index in range(131079)) + '桐木导出'.encode()
posted = bytes([0, 255, 1, 0]) + 'authenticated POST blob\n桐木'.encode()
rows = [dict(event=event, seq=index, doc='one', origin=123, sameAudio=True, paused=False, time=index + 1, advance=index)
        for index, event in enumerate(['ready', 'playing', 'foreign', 'Export-cancelled', 'Export-queued', 'Slow export-cancelled', 'POST export-queued'])]
rows[2]['extra'] = dict(native=True, exportApi=False, parentReadable=False)


def log(values):
    return '\n'.join('CONTENT_EXPORT_REPORT ' + json.dumps(row) for row in values) + '\nCONTENT_EXPORT_AUTHENTICATED True\n'


verify(log(rows), generated, posted)
for change in ['missing', 'document', 'audio', 'paused', 'foreign', 'duplicate', 'permission', 'clock']:
    bad = copy.deepcopy(rows)
    api = 34
    if change == 'missing': bad.pop()
    elif change == 'document': bad[-1]['origin'] += 1
    elif change == 'audio': bad[-1]['sameAudio'] = False
    elif change == 'paused': bad[-1]['paused'] = True
    elif change == 'foreign': bad[2]['extra']['exportApi'] = True
    elif change == 'duplicate': bad.append(copy.deepcopy(bad[-1]))
    elif change == 'permission': api = 23
    elif change == 'clock': bad[-1]['advance'] = bad[-3]['advance']
    try:
        verify(log(bad), generated, posted, api)
    except AssertionError:
        continue
    raise AssertionError('Invalid content export evidence accepted: ' + change)
for a, b in [(generated[:-1], posted), (generated, posted + b'other')]:
    try: verify(log(rows), a, b)
    except AssertionError: continue
    raise AssertionError('Invalid saved bytes accepted')
print('PASS: export verifier rejects missing/duplicate stages, replaced media/doc, wrong bytes, foreign bridge and absent storage denial')
