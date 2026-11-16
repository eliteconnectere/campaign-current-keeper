#!/usr/bin/env python3
from pathlib import Path

p = Path("src/routes/learn-more.tsx")
t = p.read_text()
# Broken: after rex-ai content array, missing }, before radar-chat
broken = '''      "Want the full detail (what it can do, what it cannot do, and warnings)? Open the Agent Rex guide: https://eliteconnectere.site/rex",
    ],
  {
    id: "radar-chat",'''
fixed = '''      "Want the full detail (what it can do, what it cannot do, and warnings)? Open the Agent Rex guide: https://eliteconnectere.site/rex",
    ],
  },
  {
    id: "radar-chat",'''
if broken in t:
    t = t.replace(broken, fixed, 1)
    p.write_text(t)
    print("fixed missing }, after rex-ai")
elif 'id: "rex-ai"' in t and '],\n  {\n    id: "radar-chat"' in t:
    t = t.replace('],\n  {\n    id: "radar-chat"', '],\n  },\n  {\n    id: "radar-chat"', 1)
    p.write_text(t)
    print("fixed alt pattern")
else:
    print("pattern not found — check manually")
    # show around rex
    i = t.find('id: "rex-ai"')
    print(repr(t[i:i+800]))
