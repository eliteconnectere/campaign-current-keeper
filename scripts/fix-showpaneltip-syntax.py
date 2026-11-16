#!/usr/bin/env python3
from pathlib import Path
import re

path = Path("src/routes/app.tsx")
text = path.read_text(encoding="utf-8")
original = text

# Broken: onSelect: () => setRadarOpen(true); showPanelTip("radar"),
text = text.replace(
    'onSelect: () => setRadarOpen(true); showPanelTip("radar")',
    'onSelect: () => { setRadarOpen(true); showPanelTip("radar"); }',
)
text = text.replace(
    "onSelect: () => setRadarOpen(true); showPanelTip(\"radar\")",
    "onSelect: () => { setRadarOpen(true); showPanelTip(\"radar\"); }",
)

# Any remaining pattern: () => foo(); bar(
text = re.sub(
    r"onSelect:\s*\(\)\s*=>\s*setRadarOpen\(true\);\s*showPanelTip\(\"radar\"\)",
    'onSelect: () => { setRadarOpen(true); showPanelTip("radar"); }',
    text,
)

# Deduplicate accidental double showPanelTip("settings")
text = re.sub(
    r'(showPanelTip\("settings"\);\s*){2,}',
    'showPanelTip("settings");\n',
    text,
)

if text == original:
    print("No changes")
else:
    path.write_text(text, encoding="utf-8")
    print("Fixed showPanelTip syntax")
