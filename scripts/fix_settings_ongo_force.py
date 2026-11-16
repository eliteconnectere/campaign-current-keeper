#!/usr/bin/env python3
from pathlib import Path
import re

path = Path("src/routes/app.tsx")
t = path.read_text()

# Force settings destination to open settings view
t2, n = re.subn(
    r'(p === "settings"\) \{\s*setMenuView\(")root(\"\))',
    r'\1settings\2',
    t,
    count=1,
)
if n:
    t = t2
    print("settings view forced")
else:
    t = t.replace('p === "settings") {\n              setMenuView("root");', 'p === "settings") {\n              setMenuView("settings");', 1)
    print("settings view replace attempt")

BLOCK = r'''
            } else if (p === "erase-data" || p === "settings-erase-data" || p === "clear-cache" || p === "settings-clear-cache" || p === "export-data" || p === "settings-export-data") {
              setAssistOpen(false);
              setFeatureStudio(null);
              setRadarOpen(false);
              setVaultOpen(false);
              setStudioOpen(false);
              setChatOpen(false);
              setChatSettingsOpen(false);
              setTeamOpen(false);
              setPanel("menu");
              setMenuView("settings");
              window.setTimeout(() => {
                const sel =
                  p === "clear-cache" || p === "settings-clear-cache" ? "[data-ec-menu-clear-cache]" :
                  p === "export-data" || p === "settings-export-data" ? "[data-ec-menu-export]" :
                  "[data-ec-menu-erase]";
                const el = document.querySelector(sel);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                else document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 9999, behavior: "smooth" });
              }, 120);
            } else if (p === "settings-campaign-protection" || p === "protection") {
              setAssistOpen(false); setPanel("menu"); setMenuView("campaignProtection");
            } else if (p === "settings-smart-fill-history" || p === "history") {
              setAssistOpen(false); setPanel("menu"); setMenuView("history");
            } else if (p === "settings-notifications" || p === "notifications") {
              setAssistOpen(false); setPanel("menu"); setMenuView("notifications");
            } else if (p === "settings-tools" || p === "tools") {
              setAssistOpen(false); setPanel("menu"); setMenuView("tools");
            } else if (p === "settings-subscription" || p === "subscription") {
              setAssistOpen(false); setPanel("menu"); setMenuView("subscription");
            } else if (p === "settings-night-mode-light" || p === "night-mode") {
              setAssistOpen(false); setFeatureStudio("nightMode"); setPanel("none");
            } else if (p === "settings-interface" || p === "appearance") {
              setAssistOpen(false); setStudioOpen(true); setPanel("none");
            } else if (p === "reset-workspace") {
              setAssistOpen(false); setPanel("menu"); setMenuView("root");
              window.setTimeout(() => document.querySelector("[data-ec-reset-workspace]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
'''

if "settings-erase-data" not in t or 'setMenuView("settings")' not in t[t.find("erase-data"):t.find("erase-data")+500] if "erase-data" in t else True:
    # Find handleRexNavigation and insert block after workspace branch closes first else if
    idx = t.find("function handleRexNavigation")
    if idx < 0:
        raise SystemExit("no handleRexNavigation")
    # Find first occurrence of workspace-menu branch after handler
    m = re.search(r'\} else if \(p === "workspace-menu"[^)]*\) \{', t[idx:])
    if not m:
        raise SystemExit("no workspace-menu branch")
    abs_pos = idx + m.start()
    # Insert BLOCK before this else if
    t = t[:abs_pos] + BLOCK + t[abs_pos:]
    print("inserted settings block before workspace-menu")
else:
    print("settings-erase path may exist")

# Tag UI rows
for label, attr in [
    ('label="Erase Data"', 'dataAttr="data-ec-menu-erase"'),
    ('label="Clear Local Cache"', 'dataAttr="data-ec-menu-clear-cache"'),
    ('label="Export Data / CSV Backup"', 'dataAttr="data-ec-menu-export"'),
    ('label="Reset workspace"', 'dataAttr="data-ec-reset-workspace"'),
]:
    if attr.split('=')[1].strip('"') not in t and label in t:
        t = t.replace(label, label + "\n                        " + attr, 1)
        print("tagged", attr)

path.write_text(t)
print("size", path.stat().st_size)
# sanity
assert "settings-erase-data" in path.read_text() or "erase-data" in path.read_text()
print("ok")
