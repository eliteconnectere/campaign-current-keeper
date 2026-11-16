from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text()

bad = '''  useEffect(() => {
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

# Remove ALL early copies of this effect
while bad in t:
    t = t.replace(bad, "", 1)
    print("removed bad effect")

# Ensure state exists
if "teamCanManage" not in t:
    t = t.replace(
        "const [teamOpen, setTeamOpen] = useState(false);",
        "const [teamOpen, setTeamOpen] = useState(false);\n  const [teamCanManage, setTeamCanManage] = useState(false);",
        1,
    )
    print("added state")

# Insert effect AFTER signedIn is declared
anchor = "const [signedIn, setSignedIn] = useState(false);"
good = anchor + '''
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

if "setTeamCanManage(Boolean" not in t:
    if anchor in t:
        t = t.replace(anchor, good, 1)
        print("inserted after signedIn")
    else:
        print("FAIL no signedIn anchor")
else:
    print("effect already present somewhere")
    # if effect exists but might be before signedIn still - check
    pos_effect = t.find("setTeamCanManage(Boolean")
    pos_si = t.find(anchor)
    if pos_effect >= 0 and pos_si >= 0 and pos_effect < pos_si:
        print("STILL BEFORE signedIn — force move")
        # already removed bad; re-add after
        if "setTeamCanManage(Boolean" not in t:
            t = t.replace(anchor, good, 1)

p.write_text(t)
# verify order
pos_effect = t.find("setTeamCanManage(Boolean")
pos_si = t.find("const [signedIn, setSignedIn]")
print("order ok", pos_si >= 0 and pos_effect > pos_si, pos_si, pos_effect)
print("len", len(t))
