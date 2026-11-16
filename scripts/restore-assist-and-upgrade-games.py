#!/usr/bin/env python3
"""Restore Elite Assist (user said LEAVE it, not remove). Keep Games beside it."""
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
code = app.read_text(encoding="utf-8")
orig = code

if 'from "@/features/assist/EliteAssist"' not in code:
    if 'from "@/features/games/GamesHub"' in code:
        code = code.replace(
            'import { GamesHub } from "@/features/games/GamesHub";',
            'import { GamesHub } from "@/features/games/GamesHub";\nimport { EliteAssist } from "@/features/assist/EliteAssist";',
            1,
        )
    else:
        code = 'import { EliteAssist } from "@/features/assist/EliteAssist";\n' + code
    print("Restored EliteAssist import")

if 'from "@/features/games/GamesHub"' not in code:
    code = code.replace(
        'import { EliteAssist } from "@/features/assist/EliteAssist";',
        'import { EliteAssist } from "@/features/assist/EliteAssist";\nimport { GamesHub } from "@/features/games/GamesHub";',
        1,
    )

if "gamesOpen" in code and "assistOpen" not in code:
    code = code.replace(
        "const [gamesOpen, setGamesOpen] = useState(false);",
        "const [gamesOpen, setGamesOpen] = useState(false);\n  const [assistOpen, setAssistOpen] = useState(false);",
        1,
    )
    print("Added assistOpen state")
elif "assistOpen" not in code:
    code = code.replace(
        "const [chatOpen, setChatOpen] = useState(false);",
        "const [chatOpen, setChatOpen] = useState(false);\n  const [assistOpen, setAssistOpen] = useState(false);\n  const [gamesOpen, setGamesOpen] = useState(false);",
        1,
    )

if 'id: "assist"' not in code:
    if 'id: "games"' in code:
        code = code.replace(
            '{\n              id: "games",',
            '{\n              id: "assist",\n              label: "Elite Assist",\n              icon: <Bot className="size-5" />,\n              onSelect: () => setAssistOpen(true),\n            },\n            {\n              id: "games",',
            1,
        )
    elif 'id: "settings"' in code:
        code = code.replace(
            '{\n              id: "settings",',
            '{\n              id: "assist",\n              label: "Elite Assist",\n              icon: <Bot className="size-5" />,\n              onSelect: () => setAssistOpen(true),\n            },\n            {\n              id: "games",\n              label: "Games",\n              icon: <Gamepad2 className="size-5" />,\n              onSelect: () => setGamesOpen(true),\n            },\n            {\n              id: "settings",',
            1,
        )

if "Gamepad2" not in code:
    code = code.replace('Bot } from "lucide-react"', 'Bot, Gamepad2 } from "lucide-react"', 1)

code = code.replace("!chatOpen && !gamesOpen", "!chatOpen && !assistOpen && !gamesOpen")
code = code.replace(
    "!chatOpen && !assistOpen && !assistOpen && !gamesOpen",
    "!chatOpen && !assistOpen && !gamesOpen",
)

if "<EliteAssist" not in code:
    if "<GamesHub" in code:
        code = code.replace(
            "{gamesOpen &&",
            "{assistOpen && (\n        <EliteAssist\n          onClose={() => setAssistOpen(false)}\n          account={{\n            plan: entitlements?.plan ?? \"free\",\n            company: !!entitlements?.company,\n            profiles: profiles.length,\n            mode,\n          }}\n        />\n      )}\n      {gamesOpen &&",
            1,
        )

if code != orig:
    app.write_text(code, encoding="utf-8")
    print("app.tsx updated")
else:
    print("app.tsx no change")
print("done")
