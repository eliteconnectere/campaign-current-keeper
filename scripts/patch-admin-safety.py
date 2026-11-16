#!/usr/bin/env python3
"""Restore Admin on MagicCircle for company email + wire content safety on Execute."""
from pathlib import Path
import re

path = Path("src/routes/app.tsx")
t = path.read_text(encoding="utf-8")
orig = t

# --- Import content safety ---
if "contentSafety" not in t:
    if 'from "@/lib/reviewMode"' in t:
        t = t.replace(
            'from "@/lib/reviewMode";',
            'from "@/lib/reviewMode";\nimport { scanCampaignContent, safetyBlockMessage } from "@/lib/contentSafety";',
            1,
        )
        print("+ contentSafety import")
    else:
        t = "import { scanCampaignContent, safetyBlockMessage } from \"@/lib/contentSafety\";\n" + t
        print("+ contentSafety import top")

# --- Ensure ShieldAlert import ---
if "ShieldAlert" not in t and "lucide-react" in t:
    t = t.replace("ShieldCheck,", "ShieldCheck,\n  ShieldAlert,", 1)
    print("+ ShieldAlert")

# --- Ensure AdminPanel import ---
if "AdminPanel" not in t:
    t = t.replace(
        'import { TeamPanel } from "@/features/team/TeamPanel";',
        'import { TeamPanel } from "@/features/team/TeamPanel";\nimport { AdminPanel } from "@/features/admin/AdminPanel";',
        1,
    )
    print("+ AdminPanel import")

# --- State ---
if "const [adminOpen, setAdminOpen]" not in t:
    if "const [uid, setUid]" in t:
        t = t.replace(
            "const [uid, setUid] = useState<string | null>(null);",
            'const [uid, setUid] = useState<string | null>(null);\n  const [userEmail, setUserEmail] = useState<string | null>(null);\n  const [adminOpen, setAdminOpen] = useState(false);',
            1,
        )
        print("+ admin state")

if "setUserEmail(data.session" not in t and "setUid(data.session?.user.id" in t:
    t = t.replace(
        "setUid(data.session?.user.id ?? null);",
        'setUid(data.session?.user.id ?? null);\n        setUserEmail(data.session?.user.email ?? null);',
        1,
    )
    print("+ setUserEmail")

# --- MagicCircle: force admin shortcut after refresh ---
ADMIN_SNIP = '''...(String(userEmail || "").toLowerCase() === "eliteconnectere@gmail.com" ? [{
              id: "admin",
              label: "Admin",
              icon: <ShieldAlert className="size-5" />,
              onSelect: () => setAdminOpen(true),
            }] : []),'''

if 'id: "admin"' not in t:
    # inject after refresh shortcut block
    patterns = [
        r'(id:\s*"refresh"[\s\S]*?window\.location\.reload\(\);\s*\},?\s*\},)',
        r'(id:\s*"refresh"[\s\S]*?reload\(\);[\s\S]*?\},)',
    ]
    injected = False
    for pat in patterns:
        m = re.search(pat, t)
        if m:
            t = t[: m.end()] + "\n            " + ADMIN_SNIP + t[m.end() :]
            print("+ admin shortcut injected")
            injected = True
            break
    if not injected:
        print("WARN: could not inject admin shortcut")
else:
    # Normalize email check to String(userEmail||"")
    t = t.replace(
        'userEmail?.toLowerCase() === "eliteconnectere@gmail.com"',
        'String(userEmail || "").toLowerCase() === "eliteconnectere@gmail.com"',
    )
    print("= admin shortcut already present (email check normalized)")

# Mount AdminPanel
if "AdminPanel onClose" not in t and "AdminPanel" in t:
    if "{chatOpen &&" in t:
        t = t.replace(
            "{chatOpen &&",
            '{adminOpen && (\n        <AdminPanel onClose={() => setAdminOpen(false)} />\n      )}\n\n      {chatOpen &&',
            1,
        )
        print("+ AdminPanel mount")

# Settings menu row for Admin (backup entry)
if "Admin dashboard" not in t and "menuView === \"settings\"" in t:
    # soft: skip if hard to find
    print("= skip settings admin row (optional)")

# --- Pre-send content safety near execute / setEngine("sending") ---
GATE = '''
    // Elite content safety — block clear phishing / bank-fraud copy before Engine sends
    {
      const subj = (tplA?.subject || tplB?.subject || "").toString();
      const body = (tplA?.body || tplB?.body || "").toString();
      const hit = scanCampaignContent(subj, body);
      if (hit.blocked) {
        toast.error(safetyBlockMessage(hit));
        log(safetyBlockMessage(hit), "campaignPaused");
        return;
      }
    }
'''

if "scanCampaignContent" not in t or "hit.blocked" not in t:
    # Insert before setEngine("sending") in start/execute path
    if 'setEngine("sending")' in t and "scanCampaignContent(subj" not in t:
        t = t.replace(
            'setEngine("sending")',
            GATE + '\n    setEngine("sending")',
            1,
        )
        print("+ content safety gate before first setEngine(sending)")
    else:
        print("WARN: setEngine sending anchor not unique or already gated")

path.write_text(t, encoding="utf-8")
print("done", "changed" if t != orig else "no-op", len(t))
