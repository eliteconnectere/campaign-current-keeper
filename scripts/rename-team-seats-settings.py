#!/usr/bin/env python3
from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

old = '''                      <MenuRow
                        icon={Users}
                        label="Team seats"
                        sub="ProMaxx invites — own login, own Gmails"
                        onClick={() => {
                          setTeamOpen(true);
                          setPanel("none");
                        }}
                      />'''

new = '''                      <MenuRow
                        icon={Users}
                        label="Assistants"
                        sub="Share access — they use their own login & Gmails"
                        onClick={() => {
                          setTeamOpen(true);
                          setPanel("none");
                        }}
                      />'''

if old in t:
    t = t.replace(old, new, 1)
    print("renamed Team seats → Assistants")
elif 'label="Team seats"' in t:
    t = t.replace('label="Team seats"', 'label="Assistants"', 1)
    t = t.replace(
        'sub="ProMaxx invites — own login, own Gmails"',
        'sub="Share access — they use their own login & Gmails"',
        1,
    )
    print("renamed soft")
elif 'label="Assistants"' in t:
    print("already Assistants")
else:
    print("WARN not found")

# strip any leftover Team seats string in settings context
t = t.replace("Team seats", "Assistants")

p.write_text(t, encoding="utf-8")
print("done")
