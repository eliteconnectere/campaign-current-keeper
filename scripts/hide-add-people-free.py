from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text()

if "Add people" not in t:
    print("no menu row")
    raise SystemExit(0)

if "teamCanManage" not in t and "const [teamOpen, setTeamOpen]" in t:
    t = t.replace(
        "const [teamOpen, setTeamOpen] = useState(false);",
        "const [teamOpen, setTeamOpen] = useState(false);\n  const [teamCanManage, setTeamCanManage] = useState(false);",
        1,
    )
    print("state")

if "setTeamCanManage" in t and t.count("listMyTeamSeats") < 2:
    # app may already import list in invite effect — still add owner check effect once
    if "setTeamCanManage(Boolean" not in t:
        effect = '''
  useEffect(() => {
    if (!signedIn) {
      setTeamCanManage(false);
      return;
    }
    import("@/lib/team.functions")
      .then(({ listMyTeamSeats }) => listMyTeamSeats())
      .then((res) => setTeamCanManage(Boolean(res?.canManage)))
      .catch(() => setTeamCanManage(false));
  }, [signedIn]);
'''
        idx = t.find("useEffect(() => {")
        if idx > 0:
            t = t[:idx] + effect + t[idx:]
            print("effect")

new = '''                      {teamCanManage && (
                        <MenuRow
                          icon={Users}
                          label="Add people"
                          sub="Share as assistance — you set their Gmail limit"
                          onClick={() => {
                            setTeamOpen(true);
                            setPanel(null);
                          }}
                        />
                      )}'''

m = re.search(
    r"\{entitlements &&[\s\S]*?label=\"Add people\"[\s\S]*?\)\}",
    t,
)
if m:
    t = t[: m.start()] + new + t[m.end() :]
    print("replaced entitlements gate")
else:
    m2 = re.search(r"<MenuRow\s+icon=\{Users\}\s+label=\"Add people\"[\s\S]*?/>", t)
    if m2:
        t = t[: m2.start()] + new + t[m2.end() :]
        print("replaced MenuRow")
    elif "{teamCanManage &&" in t:
        print("already teamCanManage menu")
    else:
        print("FAIL")

p.write_text(t)
print("done")
