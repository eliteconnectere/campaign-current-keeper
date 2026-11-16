#!/usr/bin/env python3
"""When user says studio/settings vaguely, ASK which one — list options, do not navigate to a wrong default."""
from pathlib import Path

nav = Path("src/features/assist/navigation.registry.ts")
t = nav.read_text()

# Tighten every studio purpose so bare "studio" is never a unique match
replacements = [
    (
        '{ place: "studio", purpose: "Customization: colours, theme, night mode, branding, wheel colour, fonts — applies across the full app including Rex UI", kind: "studio" }',
        '{ place: "studio", purpose: "Interface Customization Studio ONLY (colours, colour wheel, fonts, density, radius, shadows, shape). Never open this for a bare word 'studio' without the user meaning appearance/colours. If user only says studio, ASK which studio.", kind: "studio" }',
    ),
    (
        '{ place: "smartfill", purpose: "Smart Fill recipient list generation and saved lists", kind: "studio" }',
        '{ place: "smartfill", purpose: "Smart Fill Studio ONLY: Smart Fill toggle, up to 3 saved email lists, import CSV, Smart Fill Memory. Not Interface Studio. Bare studio → ask first.", kind: "studio" }',
    ),
    (
        '{ place: "rex-studio", purpose: "Rex control centre: personality, guardian, campaigns, alerts, memory, Rex Monitor controls", kind: "studio" }',
        '{ place: "rex-studio", purpose: "Rex Studio ONLY: agent name, personality, automation, Campaign Monitor, memory, service identity. Not Interface or Smart Fill. Bare studio → ask first.", kind: "studio" }',
    ),
    (
        '{ place: "planner", purpose: "Campaign planner, scheduled days, notes", kind: "studio" }',
        '{ place: "planner", purpose: "Planner & Notes Studio: notes and plans (max 5). Not Interface Studio.", kind: "studio" }',
    ),
    (
        '{ place: "tracker", purpose: "Campaign & Activity Centre with 24-hour Gmail tracker", kind: "studio" }',
        '{ place: "tracker", purpose: "Campaign & Activity Centre / Tracker Studio: runs, skipped, failed, completed, Gmail 24h tracker. Not Interface Studio.", kind: "studio" }',
    ),
    (
        '{ place: "sending", purpose: "Sending modes: Elite Engine vs Standard", kind: "studio" }',
        '{ place: "sending", purpose: "Sending Modes Studio: Elite Engine vs Standard. Not Interface Studio.", kind: "studio" }',
    ),
    (
        '{ place: "activity", purpose: "Activity log of sends, skips, workspace events", kind: "studio" }',
        '{ place: "activity", purpose: "Activity Centre (same family as tracker): send/skip/system activity log. Not Interface Studio.", kind: "studio" }',
    ),
    (
        '{ place: "night-mode", purpose: "Night mode / dark mode controls; should take effect on the whole app including Rex chat and Rex Studio", parent: "studio", kind: "settings" }',
        '{ place: "night-mode", purpose: "Night Mode Light Studio: edge glow, intensity, speed, animation, colours. Distinct from Interface colour wheel. Bare studio → ask first.", parent: "studio", kind: "settings" }',
    ),
]
for old, new in replacements:
    if old in t:
        t = t.replace(old, new, 1)
        print("updated", new[20:50])
    else:
        print("skip missing", old[20:50])

ASK_BLOCK = '''
    "ASK WHEN AMBIGUOUS (mandatory — do not guess):",
    "There are multiple Studios. Bare words like studio / open studio / take me to studio MUST NOT navigate yet.",
    "Reply with a short list and ask which one:",
    "1) Interface Customization Studio — colours, fonts, density (place: studio)",
    "2) Smart Fill Studio — saved email lists (place: smartfill)",
    "3) Rex Studio — agent name, personality, automation, monitor (place: rex-studio)",
    "4) Night Mode Light Studio — glow/intensity (place: night-mode)",
    "5) Planner & Notes Studio (place: planner)",
    "6) Campaign & Activity / Tracker (place: tracker)",
    "7) Sending Modes Studio (place: sending)",
    "Same rule for any request that matches more than one registered place (e.g. notifications vs notifications-bell, settings vs a specific settings row, erase-data vs reset-workspace).",
    "Only navigate after the owner names the exact studio or the request is already specific enough that only one place fits.",
    "If the request is complicated or unclear, ask one clarifying question before navigate_to or update_workspace_setting.",
'''

if "ASK WHEN AMBIGUOUS" not in t:
    t = t.replace(
        '"CRITICAL: Emit navigate_to',
        ASK_BLOCK + '    "CRITICAL: Emit navigate_to',
        1,
    )
    print("ASK block added")
else:
    print("ASK already present")

nav.write_text(t)

# SYSTEM_BRIEF mirror
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "ASK WHEN AMBIGUOUS STUDIO" not in s:
    block = '''
ASK WHEN AMBIGUOUS STUDIO AND MULTI-MATCH (mandatory)
- Bare "studio" / "open studio" / "take me to studio": DO NOT navigate. List the studios and ask which one:
  Interface Customization (colours/fonts) | Smart Fill | Rex Studio (name/personality) | Night Mode Light | Planner | Tracker/Activity | Sending Modes.
- Same for any vague request that could mean 2+ places (notifications dashboard vs bell, erase data vs reset workspace, settings vs a specific settings row).
- Complicated or incomplete instructions: ask one clear clarifying question before acting or navigating.
- Only navigate or change settings when the target is unambiguous or the owner has confirmed.
'''
    anchor = "ASSISTANT FIRST, AGENT SECOND"
    if anchor in s:
        s = s.replace(anchor, block + "\n" + anchor, 1)
    else:
        s = s.replace("THINK FOR YOURSELF", block + "\nTHINK FOR YOURSELF", 1)
    af.write_text(s)
    print("brief ASK")
else:
    print("brief already")

print("done")
