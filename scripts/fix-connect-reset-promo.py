#!/usr/bin/env python3
"""Elite Connectere fixes: Reset=workspace reset, hide PSP toggle, promo chip, MagicCircle visibility, team→assistant labels."""
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
t = app.read_text(encoding="utf-8")

old_r = """function resetWorkspace() {
    setRecipients([]);
    setRaw("");
    setValidated(false);
    setEditing(true);
    setGenerated([]);
    setScout(false);
    setEngine("idle");
      setNextInSec(null);
    setCleanupHandled(false);
  }"""
new_r = """function resetWorkspace() {
    setRecipients([]);
    setRaw("");
    setValidated(false);
    setEditing(true);
    setGenerated([]);
    setScout(false);
    setEngine("idle");
    setNextInSec(null);
    setCleanupHandled(false);
    sentRecipientEmailsRef.current = new Set();
    setSentRecipientEmails([]);
  }"""
if old_r in t:
    t = t.replace(old_r, new_r, 1)
    print("resetWorkspace locks")
elif "function resetWorkspace" in t and "sentRecipientEmailsRef.current = new Set()" not in t:
    m = re.search(r"function resetWorkspace\(\) \{[^}]+setCleanupHandled\(false\);\s*\}", t, re.S)
    if m:
        t = t[: m.start()] + new_r + t[m.end() :]
        print("resetWorkspace replaced loose")
    else:
        print("resetWorkspace pattern miss")
else:
    print("resetWorkspace ok/skip")

# Force permanentSendProtection always on
if re.search(r"const \[permanentSendProtection,\s*setPermanentSendProtection\]", t):
    t = re.sub(
        r"const \[permanentSendProtection,\s*setPermanentSendProtection\]\s*=\s*useState\([^)]*\)",
        "const permanentSendProtection = true /* always on */",
        t,
        count=1,
    )
    print("PSP forced true")

# Remove PSP toggle UI block if present
pattern = re.compile(
    r"<div className=\"mt-3 rounded-2xl border border-line bg-card p-3\">\s*"
    r"<label className=\"flex items-start gap-2\.5 cursor-pointer\">[\s\S]*?Permanent Send Protection[\s\S]*?</label>\s*</div>",
    re.M,
)
if pattern.search(t):
    t = pattern.sub("", t, count=1)
    print("PSP UI removed")
else:
    print("PSP UI not matched")

if "PromoChip" not in t:
    t = t.replace(
        'import { ExpiryReminder } from "@/features/billing/ExpiryReminder";',
        'import { ExpiryReminder } from "@/features/billing/ExpiryReminder";\nimport { PromoChip } from "@/features/billing/PromoChip";',
        1,
    )
    print("PromoChip import")

if "<PromoChip" not in t and "PromoChip" in t:
    if "<ErrorGuideHost" in t:
        t = t.replace(
            "<ErrorGuideHost />",
            '<div className="fixed top-14 right-3 z-[55]"><PromoChip isFreeUser={!entitlements || entitlements.plan === "free" || !!entitlements.communityPromo} /></div>\n      <ErrorGuideHost />',
            1,
        )
        print("PromoChip mounted")
    elif "<ExpiryReminder" in t:
        t = t.replace(
            "<ExpiryReminder",
            '<PromoChip isFreeUser={!entitlements || entitlements.plan === "free" || !!entitlements.communityPromo} />\n      <ExpiryReminder',
            1,
        )
        print("PromoChip near expiry")

# Widen MagicCircle gates
for old, new in [
    (
        'signedIn && !chatOpen && !assistOpen && mode === "engine" && chatEligible && (',
        "signedIn && !chatOpen && !assistOpen && (",
    ),
    (
        'signedIn && mode === "elite" && (chatEligible || entitlements?.isAssistant) && !chatOpen && !radarOpen && (',
        "signedIn && !chatOpen && !radarOpen && (",
    ),
    (
        "signedIn && mode === \"engine\" && chatEligible && !chatOpen",
        "signedIn && !chatOpen",
    ),
]:
    if old in t:
        t = t.replace(old, new, 1)
        print("MagicCircle widened")

app.write_text(t, encoding="utf-8")
print("app.tsx", len(t))

gf = Path("src/lib/gmail.functions.ts")
g = gf.read_text(encoding="utf-8")
old_lock = """    if (!ent.premium && !ent.trialActive) {
      return { locked: true as const, reason: "trial_expired" as const, limit: 0 };
    }"""
new_lock = """    if (!ent.premium && !ent.trialActive && !ent.communityPromo) {
      return { locked: true as const, reason: "trial_expired" as const, limit: 0 };
    }"""
if old_lock in g:
    g = g.replace(old_lock, new_lock, 1)
    gf.write_text(g, encoding="utf-8")
    print("gmail connect gate")
else:
    print("gmail gate skip")

tp = Path("src/features/team/TeamPanel.tsx")
if tp.exists():
    u = tp.read_text(encoding="utf-8")
    u2 = u
    for a, b in [
        ("Team seats", "Assistants"),
        ("team seat", "assistant"),
        ("Team seat", "Assistant"),
        ("Add team", "Add assistant"),
        ("Your team", "Your assistants"),
        ("team member", "assistant"),
        ("Team member", "Assistant"),
        ("Team table", "Share table"),
        (">Team<", ">Assistants<"),
        ("Share with team", "Share with assistants"),
    ]:
        u2 = u2.replace(a, b)
    if u2 != u:
        tp.write_text(u2, encoding="utf-8")
        print("TeamPanel labels")
    else:
        print("TeamPanel unchanged")

print("DONE")
