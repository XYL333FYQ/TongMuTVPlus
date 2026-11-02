"""Reject skipped, duplicated and cross-document back sequences."""
import copy
import json
from check_back import validate


base = [
    dict(phase=phase, seq=seq, doc='fixture-document', origin=1234,
         calls=calls, pops=pops, overlay=overlay, detail=detail)
    for seq, (phase, calls, pops, overlay, detail) in enumerate([
        ('root', 0, 0, False, False),
        ('detail', 0, 0, False, True),
        ('overlay', 0, 0, True, True),
        ('overlay-closed', 1, 0, False, True),
        ('history-root', 2, 1, False, False),
    ])
]


def log(rows):
    return '\n'.join('BACK_REPORT ' + json.dumps(row) for row in rows)


assert len(validate(log(base))) == 5
assert len(validate(log(list(reversed(base))))) == 5  # HTTP arrival order is not event order.
bad = [base[:-1], base + [base[-1]]]
for field, value, index in [
    ('doc', 'replacement', 3), ('origin', 1235, 4), ('pops', 1, 3),
    ('calls', 2, 3), ('overlay', True, 3), ('detail', True, 4), ('seq', 2, 3),
]:
    rows = copy.deepcopy(base)
    rows[index][field] = value
    bad.append(rows)
for rows in bad:
    try:
        validate(log(rows))
    except AssertionError:
        continue
    raise AssertionError('Invalid native back evidence was accepted')
print('PASS: back verifier rejects missing/duplicate events, premature history, duplicate dispatch and document replacement')
