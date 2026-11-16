#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

# Replace broken checkbox onChange blocks with disabled always-checked inputs (no setter)

old1 = '''onChange={(event) => { if (event.target.checked && !window.confirm("This permanently blocks the same message from being sent again, even after Gmail rotation or revalidation. Turn it on?")) return; /* always on */ }}'''
new1 = 'disabled readOnly'
if old1 in t:
    t = t.replace(old1, new1, 1)
    print("fixed inline onChange 1")

# Multi-line onChange for permanent protection
pat = re.compile(
    r"onChange=\{\(event\) => \{[\s\S]*?/\* always on \*/[\s\S]*?\}\}",
    re.M,
)
t2, n = pat.subn("disabled readOnly", t, count=2)
if n:
    t = t2
    print("fixed onChange blocks", n)

# Ensure PromoChip isFreeUser is simple and valid
t = re.sub(
    r"<PromoChip isFreeUser=\{[^}]+\} />",
    '<PromoChip isFreeUser={!entitlements?.premium || entitlements?.plan === "free" || !!entitlements?.communityPromo} />',
    t,
    count=1,
)

# Restore Assistants menu row if only a comment remains
if "Assistants menu hidden" in t and 'label="Assistants"' not in t:
    t = t.replace(
        "{/* Assistants menu hidden — share is hotspot assistants, not settings row */}",
        '''<MenuRow
                        icon={Users}
                        label="Assistants"
                        sub="Share access — they use their own login & Gmails"
                        onClick={() => {
                          setTeamOpen(true);
                          setPanel("none");
                        }}
                      />''',
        1,
    )
    print("restored Assistants MenuRow")

p.write_text(t, encoding="utf-8")
print("done")
# sanity: no setPermanentSendProtection
if "setPermanentSendProtection" in t:
    print("WARN setter still there")
else:
    print("no setter")
