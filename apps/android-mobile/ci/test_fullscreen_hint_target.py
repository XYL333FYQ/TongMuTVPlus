"""Only dismiss Android's immersive guide, never a page or another dialog."""
import pathlib
import subprocess
import sys
import tempfile


selector = pathlib.Path(__file__).with_name('ui_target.py')
with tempfile.TemporaryDirectory() as folder:
    path = pathlib.Path(folder) / 'ui.xml.txt'
    page_button = '<node package="com.tongmutvplus.mobile" resource-id="android:id/ok" text="Got it" bounds="[0,0][100,100]"/>'
    system_button = '<node package="android" resource-id="android:id/ok" text="Got it" bounds="[100,0][200,100]"/>'
    title = '<node package="android" resource-id="android:id/immersive_cling_title" text="Viewing full screen" bounds="[0,100][200,200]"/>'
    for body, expected in [
        (page_button, None),
        (page_button + system_button, None),
        (page_button + title + system_button, '150 50'),
        ((title + system_button).replace('Got it', '知道了'), '150 50'),
    ]:
        path.write_text('<hierarchy>' + body + '</hierarchy>', encoding='utf-8')
        result = subprocess.run([sys.executable, str(selector), str(path), 'fullscreen-hint', 'system'], capture_output=True, text=True)
        if expected is None:
            assert result.returncode != 0, 'Unrelated button matched as the system guide'
        else:
            assert result.returncode == 0 and result.stdout.strip() == expected, result.stderr
print('PASS: immersive guide selector is resource-bound and excludes page/other dialog buttons')
