"""Find a visible native/WebView accessibility target; emit numeric tap coordinates."""
import re
import sys
import xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
kind, value = sys.argv[2:4]
nodes = list(root.iter("node"))
matches = [
    node for node in nodes
    if (
        node.get("resource-id", "").endswith(":id/" + value)
        if kind in ("id", "absent-id")
        else node.get('package') == 'com.android.systemui' and any(
            label in (node.get('text', ''), node.get('content-desc', ''))
            for label in ({'pause': ('暂停', 'Pause'), 'play': ('播放', 'Play')}.get(value, ()))
        ) if kind == 'media-action'
        else value in (node.get("text", ""), node.get("content-desc", ""))
    )
]
if kind == 'fullscreen-hint':
    hint = any(node.get('package') == 'android' and
               node.get('resource-id') == 'android:id/immersive_cling_title' for node in nodes)
    matches = [node for node in nodes if node.get('package') == 'android' and
               node.get('resource-id') == 'android:id/ok'] if hint else []
if kind == "absent-id":
    sys.exit(1 if matches else 0)
for node in matches:
    bounds = list(map(int, re.findall(r"\d+", node.get("bounds", ""))))
    if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
        print((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
        sys.exit(0)
sys.exit(1)
