#!/usr/bin/env python3
from pathlib import Path
import re

# Allow 5 children on MagicCircle
mc = Path("src/features/chat/MagicCircle.tsx")
t = mc.read_text(encoding="utf-8")
t = t.replace("shortcuts.slice(0, 4)", "shortcuts.slice(0, 5)")
if "n === 4" in t or "n === 3" in t:
    # expand angles for 5 items if present
    old = """          : [base - SPREAD * 1.15, base - SPREAD * 0.4, base + SPREAD * 0.4, base + SPREAD * 1.15];"""
    new = """          : n === 4
          ? [base - SPREAD * 1.15, base - SPREAD * 0.4, base + SPREAD * 0.4, base + SPREAD * 1.15]
          : [base - SPREAD * 1.3, base - SPREAD * 0.65, base, base + SPREAD * 0.65, base + SPREAD * 1.3];"""
    if old in t:
        t = t.replace(old, new, 1)
mc.write_text(t, encoding="utf-8")
print("MagicCircle max 5")

app = Path("src/routes/app.tsx")
a = app.read_text(encoding="utf-8")

# Ensure RotateCcw imported (already used for Reset often)
if "RotateCcw" not in a:
    a = a.replace("  Settings,", "  Settings,\n  RotateCcw,", 1)

# Insert Refresh shortcut after Settings in MagicCircle shortcuts if missing
if 'id: "refresh"' not in a:
    # Find settings shortcut block end pattern inside MagicCircle shortcuts
    needle = 'id: "settings"'
    idx = a.find(needle)
    if idx < 0:
        print("no settings shortcut")
    else:
        # find closing }, of that object
        end = a.find("},", idx)
        if end > 0:
            insert = """, {
              id: "refresh",
              label: "Refresh",
              icon: <RotateCcw className="size-5" />,
              onSelect: () => {
                try { sessionStorage.setItem("ec.soft-refresh", "1"); } catch {}
                window.location.reload();
              },
            }"""
            a = a[: end + 2] + insert + a[end + 2 :]
            print("refresh shortcut added")
else:
    print("refresh already present")

# Make PromoChip more visible: also show under CONNECTED GOOGLE when free
# Ensure communityPromo users see chip even if plan looks premium incorrectly
a = a.replace(
    'isFreeUser={!entitlements || entitlements.plan === "free" || !!entitlements.communityPromo}',
    'isFreeUser={true /* show whenever November promo active; component self-gates */ && (!entitlements || entitlements.plan === "free" || !!entitlements.communityPromo || !entitlements.premium)}',
)
# simpler fix - force show path in component is better
a = a.replace(
    'isFreeUser={true /* show whenever November promo active; component self-gates */ && (!entitlements || entitlements.plan === "free" || !!entitlements.communityPromo || !entitlements.premium)}',
    'isFreeUser={!entitlements?.premium || entitlements?.plan === "free" || !!entitlements?.communityPromo}',
)

app.write_text(a, encoding="utf-8")
print("done")
