"""Locate the test app's address field or a known unrelated emulator crash."""
import re
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
nodes = list(root.iter('node'))
messenger_crashed = any(
    node.get('package') == 'android'
    and 'Messenger has stopped' in node.get('text', '')
    for node in nodes
)
for node in nodes:
    if messenger_crashed and node.get('resource-id') == 'android:id/aerr_close':
        action = 'dismiss-messenger'
    elif not messenger_crashed and node.get('package') == sys.argv[2] and node.get('class') == 'android.widget.EditText':
        action = 'address'
    else:
        continue
    bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
    if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
        print(action, (bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
        sys.exit(0)
sys.exit(1)
