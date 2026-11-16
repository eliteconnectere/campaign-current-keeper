from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text()
changed = False

if 'from "@/features/team/TeamPanel"' not in t:
    if 'from "@/features/radar/EliteRadarHub"' in t:
        t = t.replace(
            'from "@/features/radar/EliteRadarHub";',
            'from "@/features/radar/EliteRadarHub";\nimport { TeamPanel } from "@/features/team/TeamPanel";',
            1,
        )
    else:
        t = 'import { TeamPanel } from "@/features/team/TeamPanel";\n' + t
    changed = True
    print("import")

# Users icon
if re.search(r"\bUsers\b", t) is None or ("Users," not in t and "Users }" not in t):
    t2 = t.replace(
        "  Search,\n} from \"lucide-react\";",
        "  Search,\n  Users,\n} from \"lucide-react\";",
        1,
    )
    if t2 == t:
        t2 = t.replace('} from "lucide-react";', '  Users,\n} from "lucide-react";', 1)
    t = t2
    changed = True
    print("Users icon")

if "teamOpen" not in t:
    for anchor in [
        "const [radarOpen, setRadarOpen]",
        "const [chatOpen, setChatOpen]",
        "const [assistOpen, setAssistOpen]",
    ]:
        if anchor in t:
            t = t.replace(
                anchor,
                "const [teamOpen, setTeamOpen] = useState(false);\n  " + anchor,
                1,
            )
            changed = True
            print("state", anchor)
            break

if 'label="Add people"' not in t and 'label="Team seats"' not in t:
    row = '''
            <MenuRow
              icon={Users}
              label="Add people"
              sub="Premium & ProMaxx — own login, shared Gmail limit"
              onClick={() => {
                setTeamOpen(true);
                try { setPanel(null); } catch {}
              }}
            />
'''
    placed = False
    for key in ['label="Settings"', 'label="Chat settings"', 'label="Chat Settings"', 'label="Private chat"']:
        if key in t:
            idx = t.find(key)
            # end of this MenuRow self-closing or next sibling
            end = t.find("/>", idx)
            if end > 0:
                t = t[: end + 2] + row + t[end + 2 :]
                placed = True
                changed = True
                print("menu after", key)
                break
    if not placed:
        # inject near menu panel
        m = re.search(r"\{panel === \"menu\"", t)
        if m:
            t = t[: m.end()] + row + t[m.end() :]
            changed = True
            print("menu fallback")

if "{teamOpen &&" not in t:
    mount = '''
      {teamOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={() => setTeamOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <TeamPanel onClose={() => setTeamOpen(false)} />
          </div>
        </div>
      )}
'''
    for key in ["{radarOpen &&", "{chatOpen &&", "{assistOpen &&"]:
        if key in t:
            t = t.replace(key, mount + "\n      " + key, 1)
            changed = True
            print("mount before", key)
            break
    else:
        if "</main>" in t:
            t = t.replace("</main>", mount + "\n    </main>", 1)
            changed = True
            print("mount main")

if "team_invite" not in t:
    effect = '''
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const tok = new URLSearchParams(window.location.search).get("team_invite");
      if (!tok) return;
      import("@/lib/team.functions").then(({ acceptTeamInvite }) => {
        acceptTeamInvite({ data: { token: tok } }).then((res: any) => {
          if (res?.ok) {
            toast.success("Joined the team — use your own Gmails only");
            setTeamOpen(true);
          }
        });
      });
    } catch {}
  }, []);
'''
    idx = t.find("useEffect(() => {")
    if idx > 0:
        t = t[:idx] + effect + t[idx:]
        changed = True
        print("invite effect")

if changed:
    p.write_text(t)
    print("WROTE", len(t))
else:
    print("no changes needed")
