#!/usr/bin/env python3
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
code = app.read_text(encoding="utf-8")
orig = code

# Import GamesHub
if 'from "@/features/games/GamesHub"' not in code:
    if 'from "@/features/assist/EliteAssist"' in code:
        code = code.replace(
            'import { EliteAssist } from "@/features/assist/EliteAssist";',
            'import { GamesHub } from "@/features/games/GamesHub";',
            1,
        )
        print("Replaced EliteAssist import with GamesHub")
    else:
        code = code.replace(
            'import { Bot } from "lucide-react";',
            'import { Bot, Gamepad2 } from "lucide-react";\nimport { GamesHub } from "@/features/games/GamesHub";',
            1,
        )
        print("Added GamesHub import")
else:
    print("GamesHub already imported")

# Ensure Gamepad2 import if missing
if "Gamepad2" not in code and 'from "lucide-react"' in code:
    code = code.replace(
        'Bot } from "lucide-react"',
        'Bot, Gamepad2 } from "lucide-react"',
        1,
    )

# State: assistOpen -> gamesOpen
if "assistOpen" in code:
    code = code.replace("assistOpen", "gamesOpen")
    code = code.replace("setAssistOpen", "setGamesOpen")
    # fix double if any
    code = code.replace("setGamesOpenOpen", "setGamesOpen")
    print("Renamed assistOpen -> gamesOpen")

# MagicCircle assist shortcut -> games
old_assist_shortcut = """            {
              id: "assist",
              label: "Elite Assist",
              icon: <Bot className="size-5" />,
              onSelect: () => setGamesOpen(true),
            },"""
# after rename setAssistOpen became setGamesOpen already in onSelect maybe
old_assist_shortcut2 = """            {
              id: "assist",
              label: "Elite Assist",
              icon: <Bot className="size-5" />,
              onSelect: () => setAssistOpen(true),
            },"""

new_games_shortcut = """            {
              id: "games",
              label: "Games",
              icon: <Gamepad2 className="size-5" />,
              onSelect: () => setGamesOpen(true),
            },"""

if 'id: "assist"' in code:
    code2, n = re.subn(
        r"\{\s*id:\s*\"assist\"[\s\S]*?onSelect:\s*\(\)\s*=>\s*setGamesOpen\(true\),\s*\},",
        new_games_shortcut.strip(),
        code,
        count=1,
    )
    if n:
        code = code2
        print("Replaced assist shortcut with games")
    else:
        code2, n = re.subn(
            r"\{\s*id:\s*\"assist\"[\s\S]*?onSelect:\s*\(\)\s*=>\s*setAssistOpen\(true\),\s*\},",
            new_games_shortcut.strip(),
            code,
            count=1,
        )
        if n:
            code = code2
            print("Replaced assist shortcut (pre-rename)")
        else:
            print("WARN: assist shortcut pattern not found")
elif 'id: "games"' not in code:
    print("WARN: no assist id to replace")
else:
    print("games shortcut already present")

# Render: EliteAssist -> GamesHub
if "<EliteAssist" in code:
    code = re.sub(
        r"\{gamesOpen && \(\s*<EliteAssist[\s\S]*?/>\s*\)\}",
        "{gamesOpen && (\n        <GamesHub onClose={() => setGamesOpen(false)} />\n      )}",
        code,
        count=1,
    )
    code = re.sub(
        r"\{assistOpen && \(\s*<EliteAssist[\s\S]*?/>\s*\)\}",
        "{gamesOpen && (\n        <GamesHub onClose={() => setGamesOpen(false)} />\n      )}",
        code,
        count=1,
    )
    # simpler replace lines
    if "<EliteAssist" in code:
        code = re.sub(
            r"<EliteAssist[^/]*/>",
            '<GamesHub onClose={() => setGamesOpen(false)} />',
            code,
        )
        print("Replaced EliteAssist component tag")
    else:
        print("EliteAssist block replaced")
elif "<GamesHub" in code:
    print("GamesHub already rendered")
else:
    # try inject near PrivateChat
    if "{chatOpen &&" in code and "<GamesHub" not in code:
        code = code.replace(
            "{chatOpen &&",
            "{gamesOpen && (\n        <GamesHub onClose={() => setGamesOpen(false)} />\n      )}\n      {chatOpen &&",
            1,
        )
        print("Injected GamesHub near chatOpen")
    else:
        print("WARN: could not place GamesHub render")

# MagicCircle visibility: was !assistOpen -> !gamesOpen already if renamed
# condition often: !chatOpen && !assistOpen
if "!assistOpen" in code:
    code = code.replace("!assistOpen", "!gamesOpen")

if code != orig:
    app.write_text(code, encoding="utf-8")
    print("app.tsx written")
else:
    print("app.tsx unchanged")

print("done")
