#!/usr/bin/env python3
"""Toward 100%: exact nav, Smart Fill vs Studio, NL settings values, RexAvatar consistency, suggestions stay in context."""
from pathlib import Path
import re

# ---------- navigation.registry.ts ----------
nav = Path("src/features/assist/navigation.registry.ts")
t = nav.read_text()

# Strengthen smartfill purpose so it never collides with Customization Studio
old_sf = '{ place: "smartfill", purpose: "Smart Fill recipient list generation and saved lists", kind: "studio" }'
new_sf = '{ place: "smartfill", purpose: "Smart Fill Studio ONLY: toggle Smart Fill, saved email lists (max 3), import CSV lists, Smart Fill Memory. NOT Interface Customization Studio and NOT general Settings. User said Smart Fill / smart field / smartfill → always this place.", kind: "studio" }'
if old_sf in t:
    t = t.replace(old_sf, new_sf, 1)
    print("smartfill purpose")
else:
    t = re.sub(
        r'\{ place: "smartfill", purpose: "[^"]+", kind: "studio" \}',
        new_sf,
        t,
        count=1,
    )
    print("smartfill purpose regex")

old_st = '{ place: "studio", purpose: "Customization: colours, theme, night mode, branding, wheel colour, fonts — applies across the full app including Rex UI", kind: "studio" }'
new_st = '{ place: "studio", purpose: "Interface Customization Studio ONLY: colour wheel, accent/ink/surface, fonts, density, radius, shadows, shape mode. NOT Smart Fill Studio. If user says colours/theme/font/appearance → this place. If user says Smart Fill → use smartfill instead.", kind: "studio" }'
if old_st in t:
    t = t.replace(old_st, new_st, 1)
    print("studio purpose")
else:
    t = re.sub(
        r'\{ place: "studio", purpose: "[^"]+", kind: "studio" \}',
        new_st,
        t,
        count=1,
    )
    print("studio purpose regex")

# Disambiguation block in catalog builder
if "DISAMBIGUATION" not in t:
    insert = '''
    "DISAMBIGUATION (mandatory):",
    "- Smart Fill / smart field / saved lists → place smartfill (Smart Fill Studio). Never open studio for this.",
    "- Colours / theme / font / appearance / customization wheel → place studio (Interface Customization).",
    "- Night mode light / glow / edge light → place night-mode or settings-night-mode-light.",
    "- If the user request could mean two different registered places, ASK one short clarifying question instead of guessing wrong.",
    "- Typo-tolerant: 'smart field' = smartfill; 'nite mode' = night-mode.",
'''
    t = t.replace(
        '"CRITICAL: Emit navigate_to',
        insert + '    "CRITICAL: Emit navigate_to',
        1,
    )
    print("disambiguation catalog")

nav.write_text(t)

# ---------- assist.functions.ts SYSTEM_BRIEF ----------
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "DISAMBIGUATION SMART FILL" not in s:
    block = '''
DISAMBIGUATION SMART FILL VS STUDIO
- "Smart Fill", "smart field", "saved email lists" → navigate_to smartfill (Smart Fill Studio). Never studio.
- "Colour", "theme", "font", "appearance", "customization" → studio.
- "Night mode", "glow", "light effect" → night-mode.
- If ambiguous between two places, ask one clarifying question. Do not open the wrong place.
- Suggestion chips the owner taps are continuations of THIS conversation. Answer in context. Never switch to an unrelated canned FAQ topic.
- When the owner says maximum / max / highest / full for a numeric setting, use the top of the allowed range (e.g. nightModeIntensity 5). For minimum / lowest use the bottom. For medium use the midpoint.
- Apply allowlisted settings directly with update_workspace_setting. Prefer changing the value over only opening Settings.
'''
    s = s.replace("ASSISTANT FIRST, AGENT SECOND", block + "\nASSISTANT FIRST, AGENT SECOND", 1)
    af.write_text(s)
    print("brief disambiguation")

# ---------- app.tsx: NL max/min for settings + RexAvatar on menu ----------
app = Path("src/routes/app.tsx")
a = app.read_text()

# Normalize verbal values before numeric parse
if "normalizeSettingVerbal" not in a:
    # inject helper near booleanKeys block
    needle = 'let parsed: string | number | boolean = settingValue;'
    helper = '''let rawValue = String(settingValue).trim();
            // Natural language → concrete values for numeric / enum settings
            const verbal = rawValue.toLowerCase();
            const numericKeys = ["uiDensity","textDensity","radius","shadow","nightModeIntensity","weight"] as const;
            if (numericKeys.includes(settingKey as typeof numericKeys[number])) {
              const ranges: Record<string, [number, number]> = {
                uiDensity: [0.5, 1.5], textDensity: [0.5, 1.5], radius: [0, 2], shadow: [0, 4], nightModeIntensity: [1, 5], weight: [0, 2],
              };
              const [lo, hi] = ranges[settingKey] ?? [0, 1];
              if (/^(max|maximum|highest|full|strongest)$/i.test(verbal)) rawValue = String(hi);
              else if (/^(min|minimum|lowest|weakest)$/i.test(verbal)) rawValue = String(lo);
              else if (/^(mid|medium|normal|default)$/i.test(verbal)) rawValue = String((lo + hi) / 2);
            }
            if (settingKey === "nightModeSpeed" && /^(max|maximum|highest|fastest)$/i.test(verbal)) rawValue = "fast";
            if (settingKey === "nightModeSpeed" && /^(min|minimum|lowest|slowest)$/i.test(verbal)) rawValue = "slow";
            let parsed: string | number | boolean = rawValue;'''
    if needle in a:
        a = a.replace(needle, helper, 1)
        # Also fix the later use of settingValue for number - use rawValue path
        a = a.replace(
            'const numeric = Number(settingValue);',
            'const numeric = Number(rawValue);',
            1,
        )
        # enum check should use rawValue
        a = a.replace(
            'if (settingKey === "nightModeCustomColor") {\n                if (!/^#[0-9a-f]{6}$/i.test(settingValue)) return false;',
            'if (settingKey === "nightModeCustomColor") {\n                if (!/^#[0-9a-f]{6}$/i.test(rawValue)) return false;',
            1,
        )
        a = a.replace(
            '} else if (!enums[settingKey]?.includes(settingValue)) return false;',
            '} else if (!enums[settingKey]?.includes(rawValue)) return false;\n              else parsed = rawValue;',
            1,
        )
        print("NL settings verbal")
    else:
        print("WARN no parsed needle")

# Import RexAvatar if missing
if 'from "@/features/assist/RexAvatar"' not in a and "RexAvatar" not in a.split("from")[0]:
    if 'from "@/features/assist/EliteAssist"' in a:
        a = a.replace(
            'import { EliteAssist, type AssistPlace } from "@/features/assist/EliteAssist";',
            'import { EliteAssist, type AssistPlace } from "@/features/assist/EliteAssist";\nimport { RexAvatar } from "@/features/assist/RexAvatar";',
            1,
        )
        print("import RexAvatar")

# Replace menu Rex Bot icon with RexAvatar
a2, n = re.subn(
    r'(id:\s*"rex"[\s\S]{0,120}?icon:\s*)<Bot className="size-5" />',
    r'\1<span className="inline-flex size-6 items-center justify-center overflow-hidden rounded-full"><RexAvatar size="small" /></span>',
    a,
    count=1,
)
if n:
    a = a2
    print("menu RexAvatar")
else:
    print("WARN menu icon pattern")

# Return-to-Rex FAB: use RexAvatar for consistency
a2, n = re.subn(
    r'(aria-label="Return to Rex conversation"[\s\S]{0,200}?)<Bot className="size-4" /> Return to Rex',
    r'\1<span className="inline-flex size-5 items-center justify-center overflow-hidden rounded-full"><RexAvatar size="small" /></span> Return to Rex',
    a,
    count=1,
)
if n:
    a = a2
    print("FAB RexAvatar")

app.write_text(a)

# ---------- EliteAssist: suggestion chips stay in conversation context ----------
ea = Path("src/features/assist/EliteAssist.tsx")
et = ea.read_text()
# If suggestions are sent as new prompts that hit FAQ, mark them with a soft prefix so agent treats as continuation
if "[[SUGGEST_CONTINUATION]]" not in et:
    # when user taps a suggest, content is usually set via setText or sendSuggest - find onClick suggests
    # Common pattern: onClick={() => void send(s)} or setText(s)
    if "extractSuggests" in et and "SUGGEST_CONTINUATION" not in et:
        # Harden SYSTEM is server-side; client: prefix chip sends
        et2, n = re.subn(
            r'(onClick=\{\(\) =>[^}]{0,80}?)(sendMessage|ask|submit|send)\((s|suggest|item|chip)\)',
            r'\1\2("Continuing our current topic: " + \3)',
            et,
        )
        # softer: leave if no match; brief already updated
        if n:
            et = et2
            print("suggest prefix", n)
        else:
            print("suggest pattern skip - brief covers")
    ea.write_text(et)

print("done")
