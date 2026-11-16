from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text()

if "TeamPanel" not in t:
    # Import next to EliteRadarHub import if present
    if 'from "@/features/radar/EliteRadarHub"' in t:
        t = t.replace(
            'from "@/features/radar/EliteRadarHub";',
            'from "@/features/radar/EliteRadarHub";\nimport { TeamPanel } from "@/features/team/TeamPanel";',
            1,
        )
    else:
        t = 'import { TeamPanel } from "@/features/team/TeamPanel";\n' + t
    print("OK import")
else:
    print("import exists")

# State for team panel
if "teamOpen" not in t:
    anchor = "const [radarOpen, setRadarOpen]"
    if anchor in t:
        t = t.replace(
            anchor,
            "const [teamOpen, setTeamOpen] = useState(false);\n  const [radarOpen, setRadarOpen]",
            1,
        )
        print("OK teamOpen state")
    else:
        # fallback near other useState
        t = t.replace(
            "const [chatOpen, setChatOpen]",
            "const [teamOpen, setTeamOpen] = useState(false);\n  const [chatOpen, setChatOpen]",
            1,
        )
        print("OK teamOpen via chatOpen")

# Menu row — after Settings or similar MenuRow
if 'label="Team seats"' not in t and "Team seats" not in t:
    marker = 'label="Settings"'
    if marker in t:
        # Insert a MenuRow after first Settings row block is hard; inject near Chat Settings if present
        pass
    inject = '''
            <MenuRow
              icon={Users}
              label="Team seats"
              sub="ProMaxx invites — own login, own Gmails"
              onClick={() => {
                setTeamOpen(true);
                setPanel(null);
              }}
            />
'''
    if 'label="Chat settings"' in t or 'label="Chat Settings"' in t:
        key = 'label="Chat settings"' if 'label="Chat settings"' in t else 'label="Chat Settings"'
        idx = t.find(key)
        # find start of this MenuRow
        start = t.rfind("<MenuRow", 0, idx)
        end = t.find("/>", idx)
        if end < 0:
            end = t.find("</MenuRow>", idx)
            end = t.find(">", end) + 1 if end > 0 else -1
        else:
            end = end + 2
        if start > 0 and end > start:
            t = t[:end] + inject + t[end:]
            print("OK menu row after chat settings")
        else:
            print("WARN could not place after chat settings")
    elif 'label="Settings"' in t:
        idx = t.find('label="Settings"')
        end = t.find("/>", idx)
        if end > 0:
            t = t[: end + 2] + inject + t[end + 2 :]
            print("OK menu row after Settings")
    else:
        print("WARN no menu anchor")

# Ensure Users icon imported from lucide
if "Users," not in t and "Users }" not in t:
    t = t.replace(
        "  Search,\n} from \"lucide-react\";",
        "  Search,\n  Users,\n} from \"lucide-react\";",
        1,
    )
    if "Users," not in t:
        t = t.replace(
            '} from "lucide-react";',
            '  Users,\n} from "lucide-react";',
            1,
        )
    print("OK Users icon")

# Mount panel overlay
if "teamOpen &&" not in t and "{teamOpen &&" not in t:
    mount = '''
      {teamOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-white shadow-xl sm:rounded-2xl">
            <TeamPanel onClose={() => setTeamOpen(false)} />
          </div>
        </div>
      )}
'''
    if "{radarOpen &&" in t:
        t = t.replace("{radarOpen &&", mount + "\n      {radarOpen &&", 1)
        print("OK mount before radar")
    elif "{chatOpen &&" in t:
        t = t.replace("{chatOpen &&", mount + "\n      {chatOpen &&", 1)
        print("OK mount before chat")
    else:
        # before last closing of main return
        t = t.replace("    </main>", mount + "\n    </main>", 1)
        print("OK mount before main end")

# Auto-accept invite token from URL
if "team_invite" not in t:
    effect = '''
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const tok = q.get("team_invite");
      if (!tok || !signedIn) return;
      import("@/lib/team.functions").then(({ acceptTeamInvite }) => {
        acceptTeamInvite({ data: { token: tok } }).then((res) => {
          if (res.ok) {
            toast.success("Team invite accepted — your Gmails stay on this login only");
            setTeamOpen(true);
          }
        });
      });
    } catch {}
  }, [signedIn]);
'''
    if "const signedIn" in t or "signedIn &&" in t:
        t = t.replace(
            "  useEffect(() => {\n    applyAppearance", 
            effect + "\n  useEffect(() => {\n    applyAppearance",
            1,
        )
        if "team_invite" not in t:
            # append after first useEffect
            idx = t.find("useEffect(() => {")
            if idx > 0:
                t = t[:idx] + effect + t[idx:]
                print("OK team_invite effect")
        else:
            print("OK team_invite effect placed")

p.write_text(t)
print("done", len(t))
