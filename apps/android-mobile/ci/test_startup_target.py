import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('startup_target.py')
PACKAGE = 'com.tongmutvplus.mobile'
FIELD = '<node package="com.tongmutvplus.mobile" class="android.widget.EditText" bounds="[10,20][110,60]"/>'
CLOSE = '<node package="android" resource-id="android:id/aerr_close" bounds="[20,40][120,80]"/>'


def find(*nodes):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'ui.xml'
        path.write_text('<hierarchy>' + ''.join(nodes) + '</hierarchy>', encoding='utf-8')
        return subprocess.run([sys.executable, str(SCRIPT), str(path), PACKAGE], capture_output=True, text=True)


class StartupTargetTest(unittest.TestCase):
    def test_finds_only_the_app_address_field(self):
        result = find(FIELD)
        self.assertEqual((result.returncode, result.stdout.strip()), (0, 'address 60 40'))
        self.assertNotEqual(find('<node package="other" class="android.widget.EditText" bounds="[0,0][5,5]"/>').returncode, 0)

    def test_dismisses_only_known_unrelated_messenger_crash(self):
        title = '<node package="android" text="Messenger has stopped"/>'
        result = find(FIELD, title, CLOSE)
        self.assertEqual((result.returncode, result.stdout.strip()), (0, 'dismiss-messenger 70 60'))
        self.assertNotEqual(find('<node package="android" text="TongMuTV Plus has stopped"/>', CLOSE).returncode, 0)


if __name__ == '__main__':
    unittest.main()
