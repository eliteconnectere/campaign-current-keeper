#!/usr/bin/env python3
"""Legacy safety no-op.

MagicCircle shortcuts are maintained directly in src/routes/app.tsx.
The previous regex stopped at nested self-closing icon elements (for example
<MessageCircle />) instead of the closing <MagicCircle />, duplicating JSX
and breaking production builds. Do not rewrite the component with regex.
"""
from pathlib import Path

app = Path("src/routes/app.tsx")
if not app.exists():
    print("WARN: app route not found")
else:
    source = app.read_text(encoding="utf-8")
    if "<MagicCircle" not in source:
        print("WARN: no MagicCircle component found")
    else:
        print("MagicCircle patch skipped: shortcuts are maintained in app.tsx.")
