#!/usr/bin/env python3
from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

# 1. Extra /> after Assistants MenuRow
old = '''                        onClick={() => {
                          setTeamOpen(true);
                          setPanel("none");
                        }}
                      />
                      />
                      <MenuRow
                        icon={Sparkles}'''

new = '''                        onClick={() => {
                          setTeamOpen(true);
                          setPanel("none");
                        }}
                      />
                      <MenuRow
                        icon={Sparkles}'''

if old in t:
    t = t.replace(old, new, 1)
    print("removed duplicate /> after Assistants")
else:
    # softer
    if "/>\n                      />\n                      <MenuRow" in t:
        t = t.replace("/>\n                      />\n                      <MenuRow", "/>\n                      <MenuRow", 1)
        print("removed soft duplicate />")
    else:
        print("WARN: Assistants duplicate not found")

# 2. Broken double disabled on checkbox
t = t.replace(
    "disabled={!duplicateProtectionEligible}\n                    disabled readOnly",
    "disabled\n                    readOnly",
)
t = t.replace("disabled={!duplicateProtectionEligible} disabled readOnly", "disabled readOnly")
t = t.replace("disabled={!duplicateProtectionEligible} disable", "disabled")

# 3. Any remaining "disabled readOnly" as sole attrs is fine for always-on checkbox

p.write_text(t, encoding="utf-8")
print("done")
# verify
if "/>\n                      />" in t or "/>\n                       />" in t:
    print("WARN still double close")
else:
    print("no double close")
