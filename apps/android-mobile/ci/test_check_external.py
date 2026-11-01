"""Regression for Android dumpsys delimiters and handoff rejection evidence."""
import pathlib
import subprocess
import sys
import tempfile

parser = pathlib.Path(__file__).with_name('check_external.py')
source = 'EXTERNAL_REPORT {"event":"source","origin":12,"path":"/native-external-test","bridge":true}\n'
with tempfile.TemporaryDirectory() as directory:
    root = pathlib.Path(directory)
    log = root / 'server.txt'
    activities = root / 'activities.txt'
    for delimiter in ('topResumedActivity=', 'mResumedActivity:', 'ResumedActivity:'):
        log.write_text(source)
        activities.write_text(delimiter + 'ActivityRecord{abc u0 com.android.chrome/com.google.android.apps.chrome.Main t12}')
        result = subprocess.run([sys.executable, str(parser), str(log), 'anchor', str(activities)], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        activities.write_text(delimiter + 'ActivityRecord{abc u0 com.tongmutvplus.mobile/.MainActivity t8}')
        result = subprocess.run([sys.executable, str(parser), str(log), 'anchor', str(activities)], capture_output=True, text=True)
        assert result.returncode != 0, 'Own foreground must not pass'
    log.write_text(source + 'EXTERNAL_REPORT {"event":"destination","bridge":true,"query":"?anchor"}\n')
    result = subprocess.run([sys.executable, str(parser), str(log), 'automatic'], capture_output=True, text=True)
    assert result.returncode != 0, 'In-app destination must not pass'
print('PASS: actual dumpsys formats and external handoff negative cases')
