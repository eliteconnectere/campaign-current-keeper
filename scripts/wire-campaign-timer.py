#!/usr/bin/env python3
"""Wire CampaignTimerChip into app.tsx near PromoChip."""
from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

# Import
if "CampaignTimerChip" not in t:
    if 'from "@/features/billing/PromoChip"' in t:
        t = t.replace(
            'from "@/features/billing/PromoChip"',
            'from "@/features/billing/PromoChip";\nimport { CampaignTimerChip } from "@/features/campaign/CampaignTimerChip"',
            1,
        )
        print("+ import via PromoChip path")
    elif "PromoChip" in t:
        t = t.replace(
            "import { PromoChip }",
            'import { CampaignTimerChip } from "@/features/campaign/CampaignTimerChip";\nimport { PromoChip }',
            1,
        )
        print("+ import PromoChip sibling")
    else:
        t = t.replace(
            'from "react";',
            'from "react";\nimport { CampaignTimerChip } from "@/features/campaign/CampaignTimerChip";',
            1,
        )
        print("+ import fallback")

# JSX insertion near PromoChip
if "<CampaignTimerChip" not in t:
    chip_jsx = (
        "<>\n"
        "                      <CampaignTimerChip\n"
        '                        active={engine === "sending" || engine === "scouting"}\n'
        "                        remaining={Math.max(0, (typeof to === \"number\" && typeof from === \"number\" ? to - from + 1 : (generated?.length ?? 0)) - (typeof current === \"number\" ? current : 0))}\n"
        "                        delaySeconds={typeof delay === \"number\" ? delay : 3}\n"
        "                        totalInRange={typeof to === \"number\" && typeof from === \"number\" ? to - from + 1 : generated?.length}\n"
        "                        sentInRun={typeof current === \"number\" ? current : 0}\n"
        "                        soundEnabled={settings?.sounds !== false && settings?.sound !== false}\n"
        "                      />\n"
        "                      {PROMO}\n"
        "                    </>"
    )
    m = re.search(r"<PromoChip\\b[^>]*/>", t)
    if not m:
        m = re.search(r"<PromoChip\\b[\\s\\S]{0,300}?>", t)
    if m:
        end = m.end()
        if not t[m.start():end].rstrip().endswith("/>"):
            end_m = re.search(r"/>", t[m.start() : m.start() + 500])
            if end_m:
                end = m.start() + end_m.end()
        block = t[m.start() : end]
        insert = chip_jsx.replace("{PROMO}", block)
        t = t[: m.start()] + insert + t[end:]
        print("+ CampaignTimerChip next to PromoChip")
    else:
        print("WARN: PromoChip not found — timer component created but not mounted")
else:
    print("= CampaignTimerChip already present")

p.write_text(t, encoding="utf-8")
print("done", len(t))
