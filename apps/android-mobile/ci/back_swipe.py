"""Use the actual rotated screenshot, not wm's natural panel dimensions."""
import pathlib
import struct
import sys
import zlib


def swipe(data):
    if (len(data) < 33 or data[:8] != b'\x89PNG\r\n\x1a\n' or
            data[8:16] != b'\x00\x00\x00\rIHDR' or
            zlib.crc32(data[12:29]) != struct.unpack('>I', data[29:33])[0]):
        raise ValueError('Missing valid screenshot dimensions')
    width, height = struct.unpack('>II', data[16:24])
    if not 8 <= width <= 8192 or not 8 <= height <= 8192:
        raise ValueError('Unexpected screenshot dimensions')
    return 2, height // 2, width * 3 // 4, height // 2


if __name__ == '__main__':
    print(*swipe(pathlib.Path(sys.argv[1]).read_bytes()))
