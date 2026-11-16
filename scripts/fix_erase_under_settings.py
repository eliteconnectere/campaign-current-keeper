#!/usr/bin/env python3
"""Erase Data lives under Settings (menuView settings), NOT root menu with Reset workspace."""
from pathlib import Path

path = Path("src/routes/app.tsx")
t = path.read_text()

# Remove erase-data from the root-menu group if still grouped there
# Dedicated branch for erase-data / clear-cache under settings

if 'p === "erase-data"' in t and 'setMenuView("settings")' in t and 'data-ec-menu-erase' in t:
    # Check if erase already opens settings
    if 'else if (p === "erase-data")' in t or 'p === "erase-data") {\n              setMenuView("settings")' in t:
        print("may already have dedicated branch")

# Replace the combined branch that wrongly uses root for erase-data
old = None
# Find pattern that includes erase-data with setMenuView("root")
if 'p === "erase-data"' in t:
    # Soft replace: when handling erase-data specifically after combined branch opens root,
    # inject dedicated case BEFORE the combined workspace-menu branch
    needle = '} else if (p === "workspace-menu" || p === "logout" || p === "export-data" || p === "clear-cache" || p === "erase-data"'
    alt = '} else if (p === "workspace-menu" || p === "logout" || p === "export-data" || p === "clear-cache" || p === "erase-data" || p === "reset-workspace"'
    dedicated = '''} else if (p === "erase-data" || p === "clear-cache") {
              // Erase Data + Clear Local Cache live under Settings, not the root menu.
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
                const sel = p === "erase-data" ? "[data-ec-menu-erase]" : "[data-ec-menu-clear-cache]";
                const el = document.querySelector(sel);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                else document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 9999, behavior: "smooth" });
              }, 100);
            } else if (p === "reset-workspace") {
              setAssistOpen(false);
              setFeatureStudio(null);
              setPanel("menu");
              setMenuView("root");
              window.setTimeout(() => {
                const el = document.querySelector("[data-ec-reset-workspace]");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 100);
            } else if (p === "workspace-menu" || p === "logout" || p === "export-data"'''

    if needle in t:
        t = t.replace(needle, dedicated, 1)
        print("dedicated erase-data under settings")
    elif alt in t:
        t = t.replace(alt, dedicated, 1)
        print("dedicated erase via alt needle")
    else:
        print("WARN: could not find erase branch")

# settings destination should open settings view not root
t = t.replace(
    '''} else if (p === "settings") {
              setMenuView("root");
              setPanel("menu");
              window.setTimeout(() => document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 0, behavior: "instant" }), 0);''',
    '''} else if (p === "settings") {
              setMenuView("settings");
              setPanel("menu");
              window.setTimeout(() => document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 0);''',
    1,
)
print("settings opens settings view")

# Ensure Erase Data row has data attr
if 'label="Erase Data"' in t and 'data-ec-menu-erase' not in t:
    t = t.replace('label="Erase Data"', 'label="Erase Data"\n                        dataAttr="data-ec-menu-erase"', 1)
elif 'label="Erase Data"' in t and 'dataAttr="data-ec-menu-erase"' not in t and 'data-ec-menu-erase' in t:
    # attr might be on button already
    pass

if 'label="Erase Data"' in t and 'dataAttr="data-ec-menu-erase"' not in t:
    # try again near label
    t = t.replace(
        '''label="Erase Data"
                        sub="Wipe this workspace and start fresh"''',
        '''label="Erase Data"
                        dataAttr="data-ec-menu-erase"
                        sub="Wipe this workspace and start fresh"''',
        1,
    )
    print("tagged Erase Data row")

if 'label="Clear Local Cache"' in t and 'data-ec-menu-clear-cache' not in t:
    t = t.replace(
        'label="Clear Local Cache"',
        'label="Clear Local Cache"\n                        dataAttr="data-ec-menu-clear-cache"',
        1,
    )
    print("tagged Clear Local Cache")

# Registry purpose parent settings
reg = Path("src/features/assist/navigation.registry.ts")
rt = reg.read_text()
rt = rt.replace(
    'parent: "workspace-menu", kind: "action" },\n  { place: "reset-workspace"',
    'parent: "settings", kind: "action" },\n  { place: "reset-workspace"',
    1,
)
# fix erase-data parent to settings
import re
rt2 = re.sub(
    r'\{ place: "erase-data", purpose: "[^"]*", parent: "[^"]*", kind: "action" \}',
    '{ place: "erase-data", purpose: "Open Settings and scroll to Erase Data (wipe stored workspace data after confirmation). Different from reset-workspace which only clears the current campaign draft on the root menu.", parent: "settings", kind: "action" }',
    rt,
    count=1,
)
if rt2 != rt:
    rt = rt2
    print("registry erase parent=settings")
rt = rt.replace(
    '{ place: "clear-cache", purpose: "Navigate to the Clear Local Cache control in the workspace menu; do not clear anything until the user presses the control", parent: "workspace-menu", kind: "action" }',
    '{ place: "clear-cache", purpose: "Open Settings and scroll to Clear Local Cache; does not clear until the user presses the control", parent: "settings", kind: "action" }',
    1,
)
reg.write_text(rt)
path.write_text(t)
print("app", path.stat().st_size)
