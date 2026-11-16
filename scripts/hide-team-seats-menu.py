#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

# Hide Settings row that opens Team seats (keep TeamPanel for invite links if needed)
# Common patterns
changed = False

# Pattern: teamCanManage && ( ... Team seats ... )
pat = re.compile(
    r"\{teamCanManage && \([\s\S]*?Team seats[\s\S]*?\)\}",
    re.M,
)
if pat.search(t):
    t = pat.sub("{/* Team seats menu hidden — share is hotspot assistants, not settings row */}", t, count=1)
    changed = True
    print("removed teamCanManage Team seats block")

# label="Team seats"
if 'label="Team seats"' in t:
    # remove whole MenuRow containing Team seats
    pat2 = re.compile(
        r"<MenuRow[\s\S]*?label=\"Team seats\"[\s\S]*?/>",
        re.M,
    )
    if pat2.search(t):
        t = pat2.sub("{/* Team seats removed from settings */}", t, count=1)
        changed = True
        print("removed MenuRow Team seats")

# Alternate: button with Team seats text
pat3 = re.compile(
    r"\{teamCanManage &&[\s\S]{0,400}?Team seats[\s\S]{0,400}?\)\}",
    re.M,
)
if "Team seats" in t and pat3.search(t):
    t = pat3.sub("{/* Team seats settings entry removed */}", t, count=1)
    changed = True
    print("removed soft team seats")

if not changed:
    print("WARN: Team seats menu pattern not found — search manually")
    for i, line in enumerate(t.splitlines()):
        if "Team seats" in line or "teamCanManage" in line and "setTeamOpen" in line:
            print(i + 1, line[:120])

p.write_text(t, encoding="utf-8")
print("done")
