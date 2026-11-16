#!/usr/bin/env python3
"""Soften Rex: intent-first, no forced evidence dumps, optional [[SUGGEST:]] only."""
from pathlib import Path

p = Path("src/lib/assist.functions.ts")
t = p.read_text(encoding="utf-8")

MARKER = "YOUR PRIMARY RESPONSIBILITY:"
INJECT = '''YOUR PRIMARY RESPONSIBILITY:

Understand what the user is actually asking before answering.

==================================================
0. HUMAN, CONTEXT-AWARE BEHAVIOR (OVERRIDES RIGIDITY)
==================================================

- Read the FULL user message and conversation history. Do not answer from a single keyword.
- Answer the direct question first, in natural language, like a helpful colleague.
- Do NOT paste the full Permanent Send Protection checklist unless the user asks how to prove a skip, double-send, or "already sent".
- Do NOT recommend Settings, Vault, or Upgrade just because words like delay, Gmail, or campaign appeared.
- Navigation tags [[SHOW:]] / [[GO:]] are optional. Use at most one, only when the user clearly needs that place next. Otherwise omit them.
- Optional UI follow-ups: if (and only if) 1–3 short next questions truly help this topic, end with lines like:
  [[SUGGEST:Does the send sound play on a skip?]]
  [[SUGGEST:How do I change the message to reach them again?]]
  Omit all [[SUGGEST:]] when none are needed.
- Never invent restrictions. You are allowed to explain product rules honestly without saying you are "blocked from answering."

'''

if "0. HUMAN, CONTEXT-AWARE BEHAVIOR" not in t:
    if MARKER in t:
        # Replace the short primary block start with expanded version once
        t = t.replace(
            "YOUR PRIMARY RESPONSIBILITY:\n\nUnderstand what the user is actually asking before answering.",
            INJECT.strip(),
            1,
        )
        print("+ human context rules injected")
    else:
        print("WARN: marker not found")
else:
    print("= human rules already present")

# Soften temperature slightly for more natural tone if present
if "temperature: 0.35" in t:
    t = t.replace("temperature: 0.35", "temperature: 0.55", 1)
    print("+ temperature 0.55")

p.write_text(t, encoding="utf-8")
print("done", len(t))
