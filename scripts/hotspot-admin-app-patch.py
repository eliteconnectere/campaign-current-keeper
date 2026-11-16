#!/usr/bin/env python3
"""Wire Hotspot Access menu labels + Admin panel on MagicCircle."""
from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

# --- Imports ---
if 'AdminPanel' not in t:
    if 'import { TeamPanel }' in t:
        t = t.replace(
            'import { TeamPanel } from "@/features/team/TeamPanel";',
            'import { TeamPanel } from "@/features/team/TeamPanel";\nimport { AdminPanel } from "@/features/admin/AdminPanel";',
            1,
        )
        print("+ AdminPanel import")
    else:
        print("WARN: TeamPanel import missing")

# ShieldAlert for admin icon — use ShieldCheck if ShieldAlert not imported
if "ShieldAlert" not in t and 'from "lucide-react"' in t:
    # Prefer adding ShieldAlert next to ShieldCheck
    if "ShieldCheck," in t:
        t = t.replace("ShieldCheck,", "ShieldCheck,\n  ShieldAlert,", 1)
        print("+ ShieldAlert import")
    elif "ShieldCheck" in t:
        t = t.replace("ShieldCheck", "ShieldCheck,\n  ShieldAlert", 1)
        print("+ ShieldAlert import soft")

# --- State: userEmail + adminOpen ---
if "const [userEmail, setUserEmail]" not in t:
    if "const [uid, setUid]" in t:
        t = t.replace(
            "const [uid, setUid] = useState<string | null>(null);",
            'const [uid, setUid] = useState<string | null>(null);\n  const [userEmail, setUserEmail] = useState<string | null>(null);\n  const [adminOpen, setAdminOpen] = useState(false);',
            1,
        )
        print("+ userEmail adminOpen state")
    elif "setUid(" in t:
        # insert near signedIn
        t = t.replace(
            "const [signedIn, setSignedIn] = useState(false);",
            'const [signedIn, setSignedIn] = useState(false);\n  const [userEmail, setUserEmail] = useState<string | null>(null);\n  const [adminOpen, setAdminOpen] = useState(false);',
            1,
        )
        print("+ userEmail adminOpen near signedIn")

# Session email
if "setUserEmail(data.session" not in t:
    if "setUid(data.session?.user.id ?? null);" in t:
        t = t.replace(
            "setUid(data.session?.user.id ?? null);",
            'setUid(data.session?.user.id ?? null);\n        setUserEmail(data.session?.user.email ?? null);',
            1,
        )
        print("+ setUserEmail on session")
    elif "setSignedIn(Boolean(data.session));" in t:
        t = t.replace(
            "setSignedIn(Boolean(data.session));",
            'setSignedIn(Boolean(data.session));\n        setUserEmail(data.session?.user.email ?? null);',
            1,
        )
        print("+ setUserEmail soft")

# Rename Assistants / Team seats → Hotspot access
for old, new in [
    ('label="Assistants"', 'label="Hotspot access"'),
    ('label="Team seats"', 'label="Hotspot access"'),
    (
        'sub="Share access — they use their own login & Gmails"',
        'sub="Share your subscription; Gmail slots and Chat Energy are shared"',
    ),
    (
        'sub="ProMaxx invites — own login, own Gmails"',
        'sub="Share your subscription; Gmail slots and Chat Energy are shared"',
    ),
]:
    if old in t:
        t = t.replace(old, new)
        print(f"renamed {old[:40]}")

# MagicCircle: add admin shortcut for master email
if 'id: "admin"' not in t and "<MagicCircle" in t:
    # Insert before closing of shortcuts array — look for refresh block
    refresh_block = '''{
              id: "refresh",
              label: "Refresh",
              icon: <RotateCcw className="size-5" />,
              onSelect: () => {
                try { sessionStorage.setItem("ec.soft-refresh", "1"); } catch {}
                window.location.reload();
              },
            },'''
    admin_extra = '''{
              id: "refresh",
              label: "Refresh",
              icon: <RotateCcw className="size-5" />,
              onSelect: () => {
                try { sessionStorage.setItem("ec.soft-refresh", "1"); } catch {}
                window.location.reload();
              },
            },
            ...(userEmail?.toLowerCase() === "eliteconnectere@gmail.com" ? [{
              id: "admin",
              label: "Admin",
              icon: <ShieldAlert className="size-5" />,
              onSelect: () => setAdminOpen(true),
            }] : []),'''
    if refresh_block in t:
        t = t.replace(refresh_block, admin_extra, 1)
        print("+ admin on MagicCircle")
    else:
        print("WARN: refresh shortcut not found for admin inject")

# Admin panel mount
if "{adminOpen &&" not in t and "AdminPanel" in t:
    # After teamOpen panel if present
    if "{teamOpen && (" in t:
        # append near end before last closing of return
        marker = "{radarOpen && ("
        inject = '''{adminOpen && (
        <AdminPanel onClose={() => setAdminOpen(false)} />
      )}

      {radarOpen && ('''
        if marker in t and "AdminPanel onClose" not in t:
            t = t.replace(marker, inject, 1)
            print("+ adminOpen panel")
    elif "{chatOpen &&" in t:
        t = t.replace(
            "{chatOpen &&",
            '{adminOpen && (\n        <AdminPanel onClose={() => setAdminOpen(false)} />\n      )}\n\n      {chatOpen &&',
            1,
        )
        print("+ adminOpen near chat")

p.write_text(t, encoding="utf-8")
print("done", len(t))
