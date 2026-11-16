from pathlib import Path
import re, shutil

p = Path("src/routes/app.tsx")
t = p.read_text()

t = t.replace(
    'import { GamesHub } from "@/features/games/GamesHub";',
    'import { EliteRadarHub } from "@/features/radar/EliteRadarHub";',
)
t = t.replace('import { Bot, Gamepad2 } from "lucide-react";', 'import { Bot, Activity } from "lucide-react";')
t = t.replace("const [gamesOpen, setGamesOpen] = useState(false);", "const [radarOpen, setRadarOpen] = useState(false);")
t = t.replace("!gamesOpen", "!radarOpen")

old_sc = '''{
              id: "games",
              label: "Games",
              icon: <Gamepad2 className="size-5" />,
              onSelect: () => setGamesOpen(true),
            },'''
new_sc = '''{
              id: "radar",
              label: "Radar",
              icon: <Activity className="size-5" />,
              onSelect: () => setRadarOpen(true),
            },'''
if old_sc in t:
    t = t.replace(old_sc, new_sc)
    print("shortcut ok")
else:
    print("shortcut pattern missing")

old_m = '''{gamesOpen && (
        <GamesHub onClose={() => setGamesOpen(false)} />
      )}'''
new_m = '''{radarOpen && (
        <EliteRadarHub
          onClose={() => setRadarOpen(false)}
          sentCount={sentCount}
          totalCount={generated.length}
          pacingSeconds={delay}
          quarantineVault={quarantineVault}
          onClearVault={() => {
            if (window.confirm("Clear all leads from the Quarantine Vault?")) {
              setQuarantineVault([]);
              toast.info("Quarantine Vault cleared");
            }
          }}
          onLoadVaultToStandard={() => {
            if (quarantineVault.length === 0) return;
            setRecipients(quarantineVault);
            setMode("standard");
            toast.success(`Loaded ${quarantineVault.length} leads into Standard Mode`);
          }}
          onApplyTemplate={(tpl) => {
            setTplA(tpl);
            toast.success("Applied to Template A");
          }}
          activeProfileEmail={profiles.find((p) => p.id === activeProfileId)?.email}
          isSending={engine === "sending"}
        />
      )}'''
if old_m in t:
    t = t.replace(old_m, new_m)
    print("mount ok")
else:
    print("mount pattern missing")

t = t.replace("Gamepad2", "Activity")
t = t.replace("setGamesOpen", "setRadarOpen")
t = t.replace("gamesOpen", "radarOpen")

p.write_text(t)
print("written", len(t))

g = Path("src/features/games")
if g.exists():
    shutil.rmtree(g)
    print("games removed")
