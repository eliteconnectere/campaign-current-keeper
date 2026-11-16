#!/usr/bin/env python3
"""Remove leftover setPermanentSendProtection calls that break the production build."""
from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

# Remove localStorage restore of PSP setter
t = re.sub(
    r"try \{\s*const key = `ec\.permanent-send-protection:\$\{uid\}`;\s*const saved = window\.localStorage\.getItem\(key\);\s*if \(saved !== null\) setPermanentSendProtection\(saved === \"true\"\);\s*\} catch \{\s*\}",
    "/* permanent send protection always on */",
    t,
)
t = t.replace(
    'if (saved !== null) setPermanentSendProtection(saved === "true");',
    "/* always on */",
)

# Disable checkbox handlers that call the removed setter
t = re.sub(
    r"setPermanentSendProtection\(event\.target\.checked\);",
    "/* always on */",
    t,
)
t = re.sub(
    r"setPermanentSendProtection\([^)]*\);",
    "/* always on */",
    t,
)

if "setPermanentSendProtection" in t:
    print("WARN still present")
    for line in t.splitlines():
        if "setPermanentSendProtection" in line:
            print(line.strip()[:120])
else:
    print("cleared all setPermanentSendProtection")

p.write_text(t, encoding="utf-8")
print("done", len(t))
