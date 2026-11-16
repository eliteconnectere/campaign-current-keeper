from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text()

if 'label="Add people"' in t:
    print("already has menu")
else:
    needle = '''                      <MenuRow
                        icon={Settings}
                        label="Settings"
                        onClick={() => setMenuView("settings")}
                      />'''
    insert = needle + '''
                      <MenuRow
                        icon={Users}
                        label="Add people"
                        sub="Premium & ProMaxx — own login, shared Gmail limit"
                        onClick={() => {
                          setTeamOpen(true);
                          setPanel(null);
                        }}
                      />'''
    if needle in t:
        t = t.replace(needle, insert, 1)
        p.write_text(t)
        print("OK menu inserted")
    else:
        print("WARN Settings MenuRow not found exact")
        # looser
        if 'label="Settings"' in t and "setMenuView(\"settings\")" in t:
            t = t.replace(
                'label="Settings"\n                        onClick={() => setMenuView("settings")}\n                      />',
                'label="Settings"\n                        onClick={() => setMenuView("settings")}\n                      />\n                      <MenuRow\n                        icon={Users}\n                        label="Add people"\n                        sub="Premium & ProMaxx — own login, shared Gmail limit"\n                        onClick={() => {\n                          setTeamOpen(true);\n                          setPanel(null);\n                        }}\n                      />',
                1,
            )
            p.write_text(t)
            print("OK loose insert")
