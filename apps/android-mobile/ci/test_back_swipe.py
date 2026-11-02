"""Portrait/landscape edge points must stay inside the actual display."""
import struct
import zlib
from back_swipe import swipe


def header(width, height):
    content = b'IHDR' + struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + struct.pack('>I', 13) + content + struct.pack('>I', zlib.crc32(content))


assert swipe(header(320, 640)) == (2, 320, 240, 320)
assert swipe(header(640, 320)) == (2, 160, 480, 160)
assert swipe(header(1440, 3168)) == (2, 1584, 1080, 1584)
for data in (b'', header(320, 640)[:24], header(0, 640), header(640, 9000), header(320, 640)[:-1] + b'x'):
    try:
        swipe(data)
    except ValueError:
        continue
    raise AssertionError('Invalid screenshot geometry accepted')
print('PASS: rotated display geometry produces in-bounds edge gestures; malformed headers rejected')
