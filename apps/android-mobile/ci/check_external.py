"""Verify original document survives an actual Android external handoff."""
import json
import re
import sys

log = open(sys.argv[1], encoding='utf-8').read()
mode = sys.argv[2]
records = [json.loads(line.split('EXTERNAL_REPORT ', 1)[1])
           for line in log.splitlines() if line.startswith('EXTERNAL_REPORT ')]
sources = [r for r in records if r.get('event') == 'source']
if not sources or any(r.get('path') != '/native-external-test' or not r.get('bridge') for r in sources):
    sys.exit('Original external-link source has not reported')
if len({r['origin'] for r in sources}) != 1:
    sys.exit('Source document was recreated')
if any(r.get('event') == 'destination' and r.get('bridge') for r in records):
    sys.exit('External destination replaced the application document')
if re.search(r'GET /external-destination\?automatic', log):
    sys.exit('Automatic popup was not blocked')
if mode != 'automatic':
    activities = open(sys.argv[3], encoding='utf-8').read()
    resumed = '\n'.join(line for line in activities.splitlines()
                        if re.search(r'(?:mResumedActivity|topResumedActivity|ResumedActivity)[:=]', line))
    if ('com.tongmutvplus.mobile/' in resumed or not
            re.search(r'com\.android\.(?:chrome|browser)/|ResolverActivity|ChooserActivity', resumed)):
        sys.exit('User link did not hand off to a system browser or chooser')
    # Some clean emulator images show browser onboarding. Do not accept its
    # terms automatically or call that an actual destination-page visit.
    print('External foreground: ' + resumed.strip())
    delivered = any(r.get('event') == 'destination' and not r.get('bridge')
                    and r.get('query') == '?' + mode for r in records)
    print('Destination reported outside WebView: ' + str(delivered))
print('PASS: original document preserved, automatic popup rejected, mode=' + mode)
