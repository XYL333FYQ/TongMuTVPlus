"""Require native back consumption before same-document WebView history."""
import json
import pathlib
import sys


def validate(log):
    rows = [json.loads(line.split(' ', 1)[1]) for line in log.splitlines()
            if line.startswith('BACK_REPORT ')]
    assert len(rows) == 5, 'Missing or duplicate back transitions'
    rows.sort(key=lambda row: row['seq'])
    assert [row['seq'] for row in rows] == list(range(5)), 'Back sequence changed'
    assert len({row['doc'] for row in rows}) == 1, 'Back rebuilt the document'
    assert rows[0]['doc'] and len({row['origin'] for row in rows}) == 1, 'Document identity missing or changed'
    assert rows[0]['origin'] > 0, 'Missing document start time'
    expected = [
        ('root', 0, 0, False, False),
        ('detail', 0, 0, False, True),
        ('overlay', 0, 0, True, True),
        ('overlay-closed', 1, 0, False, True),
        ('history-root', 2, 1, False, False),
    ]
    actual = [(row['phase'], row['calls'], row['pops'], row['overlay'], row['detail'])
              for row in rows]
    assert actual == expected, 'Back skipped overlay, dispatched twice, or navigated prematurely'
    return rows


if __name__ == '__main__':
    rows = validate(pathlib.Path(sys.argv[1]).read_text())
    if len(sys.argv) > 2:
        pathlib.Path(sys.argv[2]).write_text(json.dumps(rows, indent=2))
    print('PASS: native back closes overlay first, then SPA history; original document retained')
