#!/usr/bin/env python3
"""Push Rex toward 100%: exact nav IDs, smart-fill disambiguation, relative setting values, avatar consistency."""
from pathlib import Path
import re

# ---------- 1) Navigation registry ----------
nav = Path("src/features/assist/navigation.registry.ts")
n = nav.read_text()

# Enrich smartfill purpose + add precise sub-destinations
old_sf = '{ place: "smartfill", purpose: "Smart Fill recipient list generation and saved lists", kind: "studio" },'
new_sf = '''{ place: "smartfill", purpose: "Smart Fill Studio (Feature Studio): toggle Smart Fill on/off, create/import/export/delete saved email lists (max 3), Smart Fill Memory toggle, clear saved lists. NOT Interface Studio / colour studio. User may say smart fill, smartfield, smart field.", kind: "studio" },
  { place: "smartfill-lists", purpose: "Smart Fill Studio focused on saved email lists section (create/import/manage lists)", parent: "smartfill", kind: "action" },
  { place: "smartfill-memory", purpose: "Smart Fill Studio focused on Smart Fill Memory toggle and clear-lists control", parent: "smartfill", kind: "settings" },
  { place: "smartfill-toggle", purpose: "Smart Fill Studio focused on the Smart Fill on/off switch", parent: "smartfill", kind: "settings" },'''
if old_sf in n and "smartfill-lists" not in n:
    n = n.replace(old_sf, new_sf, 1)
    print("smartfill destinations expanded")

# Disambiguation rules in catalog builder
if "DISAMBIGUATION" not in n:
    insert = '''    "DISAMBIGUATION (required when the request matches more than one place):",
    "- Smart Fill / smartfield / smart field → smartfill (Smart Fill Studio). Never send Smart Fill requests to studio (Interface colours) or only settings-smart-fill-history unless they asked for history.",
    "- If the user says only 'studio' without context, ask: Interface Studio (colours/theme), Smart Fill Studio, Planner Studio, Night Mode Studio, or Sending Modes?",
    "- 'history' alone is ambiguous: Smart Fill History vs campaign/activity history — ask which one.",
    "- Notification center/bell → notifications-bell; Notification settings/sounds → notifications.",
    "- Prefer the most specific registered place id. If two places are equally plausible, ask one short clarifying question instead of guessing wrong.",
'''
    n = n.replace(
        '"CRITICAL: Emit navigate_to / [[GO:]] ONLY when the user explicitly asked to open, go to, take them to, show, or land on a place.",',
        insert + '    "CRITICAL: Emit navigate_to / [[GO:]] ONLY when the user explicitly asked to open, go to, take them to, show, or land on a place.",',
        1,
    )
    print("disambiguation rules")
nav.write_text(n)

# ---------- 2) app.tsx: relative setting values + RexAvatar on controls ----------
app = Path("src/routes/app.tsx")
a = app.read_text()

# Import RexAvatar if missing
if 'from "@/features/assist/RexAvatar"' not in a and "from '@/features/assist/RexAvatar'" not in a:
    a = a.replace(
        'import { EliteAssist, type AssistPlace } from "@/features/assist/EliteAssist";',
        'import { EliteAssist, type AssistPlace } from "@/features/assist/EliteAssist";\nimport { RexAvatar } from "@/features/assist/RexAvatar";',
        1,
    )
    print("RexAvatar import")

# Relative max/min for numeric settings
old_num = '''            } else if (["uiDensity","textDensity","radius","shadow","nightModeIntensity","weight"].includes(settingKey)) {
              const numeric = Number(settingValue);
              const ranges: Record<string, [number, number]> = {
                uiDensity: [0.5, 1.5], textDensity: [0.5, 1.5], radius: [0, 2], shadow: [0, 4], nightModeIntensity: [1, 5], weight: [0, 2],
              };
              const range = ranges[settingKey];
              if (!range || !Number.isFinite(numeric) || numeric < range[0] || numeric > range[1]) return false;
              parsed = numeric;'''

new_num = '''            } else if (["uiDensity","textDensity","radius","shadow","nightModeIntensity","weight"].includes(settingKey)) {
              const ranges: Record<string, [number, number]> = {
                uiDensity: [0.5, 1.5], textDensity: [0.5, 1.5], radius: [0, 2], shadow: [0, 4], nightModeIntensity: [1, 5], weight: [0, 2],
              };
              const range = ranges[settingKey]!;
              const raw = String(settingValue).trim().toLowerCase();
              let numeric = Number(settingValue);
              if (["max","maximum","full","highest","more","increase","up"].includes(raw)) numeric = range[1];
              else if (["min","minimum","lowest","less","decrease","down","none"].includes(raw)) numeric = range[0];
              else if (["medium","mid","normal","default"].includes(raw)) numeric = (range[0] + range[1]) / 2;
              if (!Number.isFinite(numeric) || numeric < range[0] || numeric > range[1]) return false;
              parsed = numeric;'''

if old_num in a:
    a = a.replace(old_num, new_num, 1)
    print("relative numeric settings")
elif "maximum" not in a[a.find("nightModeIntensity"):a.find("nightModeIntensity")+800]:
    # softer insert before Number(settingValue) in that block
    a = a.replace(
        "const numeric = Number(settingValue);\n              const ranges: Record<string, [number, number]> = {\n                uiDensity: [0.5, 1.5], textDensity: [0.5, 1.5], radius: [0, 2], shadow: [0, 4], nightModeIntensity: [1, 5], weight: [0, 2],\n              };\n              const range = ranges[settingKey];\n              if (!range || !Number.isFinite(numeric) || numeric < range[0] || numeric > range[1]) return false;",
        "const ranges: Record<string, [number, number]> = {\n                uiDensity: [0.5, 1.5], textDensity: [0.5, 1.5], radius: [0, 2], shadow: [0, 4], nightModeIntensity: [1, 5], weight: [0, 2],\n              };\n              const range = ranges[settingKey]!;\n              const raw = String(settingValue).trim().toLowerCase();\n              let numeric = Number(settingValue);\n              if ([\"max\",\"maximum\",\"full\",\"highest\",\"more\",\"increase\",\"up\"].includes(raw)) numeric = range[1];\n              else if ([\"min\",\"minimum\",\"lowest\",\"less\",\"decrease\",\"down\",\"none\"].includes(raw)) numeric = range[0];\n              else if ([\"medium\",\"mid\",\"normal\",\"default\"].includes(raw)) numeric = (range[0] + range[1]) / 2;\n              if (!Number.isFinite(numeric) || numeric < range[0] || numeric > range[1]) return false;",
        1,
    )
    print("relative numeric soft")

# Enum relative for nightModeSpeed
if 'nightModeSpeed: ["slow","medium","fast"]' in a and "fastest" not in a[a.find("nightModeSpeed"):a.find("nightModeSpeed")+400]:
    # after enum parse, map max->fast before validation - add helper in enum branch
    pass

# Map speed aliases when setting nightModeSpeed
if 'settingKey === "nightModeSpeed"' not in a:
    # inject before enums check by expanding settingValue normalization
    marker = 'let parsed: string | number | boolean = settingValue;'
    if marker in a:
        a = a.replace(
            marker,
            '''let normalizedValue = String(settingValue).trim();
            const lowVal = normalizedValue.toLowerCase();
            if (settingKey === "nightModeSpeed") {
              if (["max","maximum","highest","fastest","full","up"].includes(lowVal)) normalizedValue = "fast";
              else if (["min","minimum","lowest","slowest"].includes(lowVal)) normalizedValue = "slow";
              else if (["mid","normal","default"].includes(lowVal)) normalizedValue = "medium";
            }
            let parsed: string | number | boolean = normalizedValue;''',
            1,
        )
        # boolean/number still use settingValue - fix to use normalized for non-numeric path
        a = a.replace(
            'if (booleanKeys.has(settingKey)) {\n              if (!["true","false"].includes(settingValue)) return false;\n              parsed = settingValue === "true";',
            'if (booleanKeys.has(settingKey)) {\n              if (!["true","false","on","off","yes","no"].includes(lowVal)) return false;\n              parsed = ["true","on","yes"].includes(lowVal);',
            1,
        )
        print("speed + boolean aliases")

# Replace Bot with RexAvatar in return-to-rex floating button
a2 = a.replace(
    '''className="fixed bottom-24 right-4 z-[120] inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-bold text-white shadow-2xl ring-2 ring-background"
          aria-label="Return to Rex conversation"
        >
          <Bot className="size-4" /> Return to Rex''',
    '''className="fixed bottom-24 right-4 z-[120] inline-flex items-center gap-2 rounded-full border border-white/40 bg-[#1437bd] px-3 py-2.5 text-sm font-bold text-white shadow-2xl ring-2 ring-background"
          aria-label="Return to Rex conversation"
        >
          <RexAvatar size="small" /> <span>Rex</span>''',
    1,
)
if a2 != a:
    a = a2
    print("floating Rex avatar")
else:
    # looser
    a2 = re.sub(
        r'(aria-label="Return to Rex conversation"\s*>)\s*<Bot className="size-4" /> Return to Rex',
        r'\1\n          <RexAvatar size="small" /> <span>Rex</span>',
        a,
        count=1,
    )
    if a2 != a:
        a = a2
        print("floating Rex avatar regex")

# Bottom nav Rex icon
a2 = a.replace(
    '''id: "rex",
              label: "Rex",
              icon: <Bot className="size-5" />,''',
    '''id: "rex",
              label: "Rex",
              icon: <RexAvatar size="small" />,''',
    1,
)
if a2 != a:
    a = a2
    print("nav Rex avatar")

# Wire new smartfill places in onGo if present
if 'case "smartfill"' in a or 'p === "smartfill"' in a:
    if 'smartfill-lists' not in a:
        # find smartfill handler and extend
        a = a.replace(
            'p === "smartfill"',
            'p === "smartfill" || p === "smartfill-lists" || p === "smartfill-memory" || p === "smartfill-toggle"',
            1,
        )
        print("onGo smartfill aliases")

app.write_text(a)

# ---------- 3) SYSTEM_BRIEF: settings relative values + no override on suggestions + disambiguation ----------
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "RELATIVE SETTING VALUES" not in s:
    s = s.replace(
        "OK SEND MEANS SEND",
        "RELATIVE SETTING VALUES\n"
        "- When the owner says maximum / max / full / highest for a numeric preference (nightModeIntensity, uiDensity, etc.), write the high end of the allowed range (e.g. nightModeIntensity 5). minimum / min / lowest → low end.\n"
        "- nightModeSpeed: max/fastest → fast; min/slowest → slow.\n"
        "- Boolean on/off/yes/no/true/false are all valid.\n"
        "- After a successful update_workspace_setting, confirm the exact value applied. Do not send them to Settings only because they said maximum.\n\n"
        "NAVIGATION DISAMBIGUATION\n"
        "- Smart Fill / smartfield → place smartfill (Smart Fill Studio), never Interface Studio.\n"
        "- If two destinations fit equally, ask one short question instead of opening the wrong place.\n\n"
        "SUGGESTION CHIPS\n"
        "- [[SUGGEST:]] chips must continue the CURRENT conversation topic. Never pivot to an unrelated FAQ, Python tutorial, or generic starter when the owner taps a suggestion from an in-progress thread.\n"
        "- When the owner message is a short suggestion chip from your previous reply, treat it as a direct follow-up to that reply, not a new session.\n\n"
        "OK SEND MEANS SEND",
        1,
    )
    af.write_text(s)
    print("brief updated")

print("done")
