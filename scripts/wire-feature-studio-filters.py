#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("src/routes/app.tsx")
if not p.exists():
    print("missing app.tsx")
    raise SystemExit(0)

text = p.read_text(encoding="utf-8")
original = text

# When FeatureStudios is rendered, pass initial filters from sessionStorage
# set by onGo for tracker-*/activity-*
if "initialCampaignFilter" not in text:
    # Find FeatureStudios usage
    m = re.search(r"<FeatureStudios\b([^>]*)>", text)
    if m:
        attrs = m.group(1)
        if "initialCampaignFilter" not in attrs:
            injection = (
                "\n          initialCampaignFilter={(() => { try { return sessionStorage.getItem(\"ec.tracker.filter\") || \"all\"; } catch { return \"all\"; } })()}\n"
                "          initialActivityFilter={(() => { try { return sessionStorage.getItem(\"ec.activity.filter\") || \"all\"; } catch { return \"all\"; } })()}\n"
            )
            text = text.replace(
                "<FeatureStudios" + attrs + ">",
                "<FeatureStudios" + attrs + injection + ">",
                1,
            )
            print("injected FeatureStudios filter props")
    else:
        # self-closing or multiline
        m2 = re.search(r"<FeatureStudios\b[\s\S]*?/>", text)
        if m2 and "initialCampaignFilter" not in m2.group(0):
            block = m2.group(0)
            new_block = block.replace(
                "/>",
                "\n          initialCampaignFilter={(() => { try { return sessionStorage.getItem(\"ec.tracker.filter\") || \"all\"; } catch { return \"all\"; } })()}\n"
                "          initialActivityFilter={(() => { try { return sessionStorage.getItem(\"ec.activity.filter\") || \"all\"; } catch { return \"all\"; } })()}\n"
                "        />",
                1,
            )
            text = text.replace(block, new_block, 1)
            print("injected FeatureStudios self-closing filter props")
        else:
            print("FeatureStudios tag not found or already has filters")
else:
    print("initialCampaignFilter already present")

if text != original:
    p.write_text(text, encoding="utf-8")
    print("saved app.tsx")
else:
    print("no change")
