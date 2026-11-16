#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("src/routes/app.tsx")
text = p.read_text(encoding="utf-8")
original = text

# Fix the body tone chips crash: chips is undefined; toneChips is defined as [string, string][]
text = re.sub(
    r"\{chips\.map\(\(\{\s*label,\s*body\s*\}\)\s*=>",
    "{toneChips.map(([label, body]) =>",
    text,
)

# Fix RexStudio optional prop for exactOptionalPropertyTypes
text = text.replace(
    "initialSection={rexStudioSection}",
    "{...(rexStudioSection ? { initialSection: rexStudioSection } : {})}",
)

if text == original:
    print("no changes (already fixed or pattern mismatch)")
    # show nearby lines for debug
    for i, line in enumerate(text.splitlines(), 1):
        if "chips.map" in line or "toneChips.map" in line or "initialSection=" in line:
            print(f"{i}: {line.strip()[:120]}")
else:
    p.write_text(text, encoding="utf-8")
    print("fixed chips crash + RexStudio prop")
