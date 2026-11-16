#!/usr/bin/env python3
from pathlib import Path

# ~5 lines at ~22px line height + padding ≈ 120–130px
MAX_H = 130

# --- EliteAssist ---
ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()
if "inputGrowRef" not in t:
    t = t.replace(
        'import { useEffect, useRef, useState } from "react";',
        'import { useEffect, useLayoutEffect, useRef, useState } from "react";',
        1,
    )
    t = t.replace(
        "const end = useRef<HTMLDivElement>(null);",
        "const end = useRef<HTMLDivElement>(null);\n  const inputGrowRef = useRef<HTMLTextAreaElement>(null);",
        1,
    )
    # grow effect after text state / near other effects
    if "inputGrowRef.current" not in t:
        t = t.replace(
            "useEffect(() => end.current?.scrollIntoView({ behavior: \"smooth\" }), [msgs, busy]);",
            "useEffect(() => end.current?.scrollIntoView({ behavior: \"smooth\" }), [msgs, busy]);\n\n  useLayoutEffect(() => {\n    const ta = inputGrowRef.current;\n    if (!ta) return;\n    ta.style.height = \"auto\";\n    ta.style.height = Math.min(ta.scrollHeight, " + str(MAX_H) + ") + \"px\";\n  }, [text]);",
            1,
        )
    t = t.replace(
        '''        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Ask Rex"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-card px-3 py-2.5 text-[13.5px] text-ink outline-none"
        />''',
        '''        <textarea
          ref={inputGrowRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Ask Rex"
          className="max-h-[130px] min-h-[42px] flex-1 resize-none overflow-y-auto rounded-xl border border-line bg-card px-3 py-2.5 text-[13.5px] leading-snug text-ink outline-none"
        />''',
        1,
    )
    ea.write_text(t)
    print("EliteAssist grow")
else:
    print("EliteAssist already")

# --- PrivateChat: ensure ~5 lines, items-end already ---
pc = Path("src/features/chat/PrivateChat.tsx")
t = pc.read_text()
t2 = t.replace(
    'ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;',
    f'ta.style.height = `${{Math.min(ta.scrollHeight, {MAX_H})}}px`;',
)
t2 = t2.replace("max-h-[140px]", f"max-h-[{MAX_H}px]")
if t2 != t:
    pc.write_text(t2)
    print("PrivateChat max height aligned")
else:
    print("PrivateChat unchanged or already")

print("done")
