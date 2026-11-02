"""Do not modify legacy hardware or retain duplicate mainKeys entries."""
import pathlib
import tempfile
from configure_gesture_avd import configure


with tempfile.TemporaryDirectory() as folder:
    path = pathlib.Path(folder) / 'config.ini.txt'
    original = 'hw.cpu.ncore=2\r\nhw.mainKeys=yes\r\nhw.lcd.width=320\r\n'
    for api in (23, 24):
        path.write_bytes(original.encode())
        assert not configure(api, path)
        assert path.read_bytes() == original.encode(), 'Legacy AVD was modified'
    path.write_text(original + 'hw.mainKeys=yes\n')
    assert configure(34, path)
    result = path.read_text()
    assert result.count('hw.mainKeys=') == 1 and 'hw.mainKeys=no' in result
    assert 'hw.cpu.ncore=2' in result and 'hw.lcd.width=320' in result
    assert configure(34, path) and path.read_text() == result, 'Configuration is not idempotent'
print('PASS: modern software navigation is explicit and legacy AVD bytes are unchanged')
