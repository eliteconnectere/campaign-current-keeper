#!/usr/bin/env python3
import subprocess
import urllib.request
from pathlib import Path

GOOD = "7f68baeff6b885ce8194f1a68755b0a6f6b4fe58"
URL = f"https://raw.githubusercontent.com/eliteconnectere/eliteconnectere/{GOOD}/src/routes/app.tsx"
p = Path("src/routes/app.tsx")

print("downloading", URL)
with urllib.request.urlopen(URL, timeout=60) as r:
    t = r.read().decode("utf-8")
print("downloaded", len(t))
if "PLACEHOLDER" in t or "CampaignTimerChip" not in t or len(t) < 50000:
    # fallback git show
    t = subprocess.check_output(["git", "show", f"{GOOD}:src/routes/app.tsx"], max_buffer=20 * 1024 * 1024).decode("utf-8")
    print("git show fallback", len(t))

old_mount = '{(engine === "sending" || engine === "paused") && ('
new_mount = '{(settings.showCampaignTimer !== false && (engine === "sending" || engine === "paused")) && ('
if old_mount in t and "settings.showCampaignTimer" not in t:
    t = t.replace(old_mount, new_mount, 1)
    print("+ gated on showCampaignTimer")

# Settings toggle near sounds if possible
if "Campaign countdown" not in t:
    for marker in ["Notification sounds", "Sending sound", "Activity recording", "Interactive Hand Tour"]:
        if marker not in t:
            continue
        i = t.find(marker)
        j = t.find("</div>", i)
        j2 = t.find("</div>", j + 1) if j > 0 else -1
        j3 = t.find("</div>", j2 + 1) if j2 > 0 else -1
        insert_at = j3 + 6 if j3 > 0 else (j2 + 6 if j2 > 0 else -1)
        if insert_at < 0:
            continue
        block = '''
              <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">Campaign countdown</p>
                  <p className="text-[11px] leading-snug text-ink-soft">
                    Live timer beside Promo while Engine is sending. Turn off if you prefer a cleaner header.
                  </p>
                </div>
                <Toggle
                  on={settings.showCampaignTimer !== false}
                  onClick={() =>
                    setSettings((s) => ({ ...s, showCampaignTimer: !(s.showCampaignTimer !== false) }))
                  }
                />
              </div>'''
        t = t[:insert_at] + block + t[insert_at:]
        print(f"+ toggle near {marker}")
        break

p.write_text(t, encoding="utf-8")
print("wrote", len(t))
