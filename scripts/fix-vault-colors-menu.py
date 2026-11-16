#!/usr/bin/env python3
"""
1) Ensure Quarantine Vault appears under Settings menu
2) Replace amber/yellow UI with brand red + blue + white only
"""
import re

path = "src/routes/app.tsx"
text = open(path, encoding="utf-8").read()

print("=== Fix vault menu placement + brand colors ===")

# --- Colors: amber -> brand palette ---
replacements = [
    ("border-amber-200", "border-brand/30"),
    ("border-amber-300", "border-brand/40"),
    ("bg-amber-50/80", "bg-brand-soft"),
    ("bg-amber-50", "bg-brand-soft"),
    ("bg-amber-100", "bg-brand-soft"),
    ("bg-amber-600", "bg-brand"),
    ("bg-amber-700", "bg-brand"),
    ("hover:bg-amber-100", "hover:bg-brand-soft"),
    ("hover:bg-amber-700", "hover:opacity-90"),
    ("text-amber-900", "text-ink"),
    ("text-amber-700", "text-brand"),
    ("text-amber-800", "text-brand"),
]
for a, b in replacements:
    if a in text:
        n = text.count(a)
        text = text.replace(a, b)
        print(f"color: {a} -> {b} ({n}x)")

# --- Menu: add Quarantine Vault under settings if missing ---
if 'label="Quarantine Vault"' not in text and "Quarantine Vault" not in text:
    # Try several settings anchors
    anchors = [
        (r'(<MenuRow\s+icon=\{ScrollText\}\s+label="Activity Log")',
         '''<MenuRow
                        icon={Database}
                        label="Quarantine Vault"
                        sub={`${quarantineVault.length} excluded/risky leads saved`}
                        onClick={() => { setVaultOpen(true); setPanel("none"); }}
                      />
                      '''),
        (r'(<MenuRow[^>]*label="Export Data / CSV Backup")',
         '''<MenuRow
                        icon={Database}
                        label="Quarantine Vault"
                        sub={`${quarantineVault.length} excluded/risky leads saved`}
                        onClick={() => { setVaultOpen(true); setPanel("none"); }}
                      />
                      '''),
        (r'(<MenuRow[^>]*label="Smart Fill History")',
         '''<MenuRow
                        icon={Database}
                        label="Quarantine Vault"
                        sub={`${quarantineVault.length} excluded/risky leads saved`}
                        onClick={() => { setVaultOpen(true); setPanel("none"); }}
                      />
                      '''),
        (r'(<MenuRow[^>]*label="Campaign Protection")',
         '''<MenuRow
                        icon={Database}
                        label="Quarantine Vault"
                        sub={`${quarantineVault.length} excluded/risky leads saved`}
                        onClick={() => { setVaultOpen(true); setPanel("none"); }}
                      />
                      '''),
    ]
    placed = False
    for pat, insert_before in anchors:
        m = re.search(pat, text)
        if m:
            text = text[: m.start()] + insert_before + text[m.start() :]
            print(f"menu: Quarantine Vault inserted before match {pat[:40]}...")
            placed = True
            break
    if not placed:
        print("WARN: could not find MenuRow anchor for Quarantine Vault")
elif 'label="Quarantine Vault"' in text or "Quarantine Vault" in text:
    print("menu: Quarantine Vault label already in file")

# Ensure state exists (minimal) if menu references quarantineVault
if "quarantineVault" in text and "setQuarantineVault" not in text:
    print("WARN: quarantineVault referenced but state missing — re-run full vault script")

# Ensure Database icon is imported
if "quarantineVault" in text or "Quarantine Vault" in text:
    if re.search(r"\bDatabase\b", text) and "Database," not in text and "Database }" not in text:
        # add to lucide import if missing
        if "from \"lucide-react\"" in text or "from 'lucide-react'" in text:
            text2, n = re.subn(
                r"(} from \"lucide-react\")",
                r", Database\1",
                text,
                count=1,
            )
            # better: insert Database into existing import list
            text2, n = re.subn(
                r"(Download,)",
                r"\1\n  Database,",
                text,
                count=1,
            )
            if n:
                text = text2
                print("import: Database added near Download")
            else:
                text2, n = re.subn(
                    r"(from \"lucide-react\")",
                    r"\1",
                    text,
                    count=1,
                )
                print("import: check Database manually if build fails")

open(path, "w", encoding="utf-8").write(text)
print("Done.")
