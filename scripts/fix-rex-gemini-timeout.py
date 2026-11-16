#!/usr/bin/env python3
"""Raise Rex Gemini shared response budget from 8s to 28s and prefer faster model first."""
from pathlib import Path

TARGET = Path("src/lib/assist.functions.ts")

def main() -> int:
    if not TARGET.exists():
        print("fix-rex-gemini-timeout: missing", TARGET)
        return 0
    text = TARGET.read_text(encoding="utf-8")
    original = text

    # Prefer the faster flash model first, keep 2.5 as fallback.
    text = text.replace(
        'const models = ["gemini-2.5-flash", "gemini-2.0-flash"];',
        'const models = ["gemini-2.0-flash", "gemini-2.5-flash"];',
    )
    text = text.replace(
        'const models = ["gemini-flash-latest", "gemini-2.0-flash"];',
        'const models = ["gemini-2.0-flash", "gemini-2.5-flash"];',
    )
    text = text.replace(
        "const deadline = Date.now() + 8000;",
        "const deadline = Date.now() + 28000;",
    )
    text = text.replace(
        "exceeded the shared 8s response budget",
        "exceeded the shared 28s response budget",
    )
    text = text.replace(
        "Sequential 15s retries across six model IDs could outlive the hosting",
        "Keep attempts inside a 28s server budget so Gemini can finish the large system prompt",
    )

    if text == original:
        print("fix-rex-gemini-timeout: no matching patterns (already fixed or structure changed)")
        return 0

    TARGET.write_text(text, encoding="utf-8")
    print("fix-rex-gemini-timeout: applied 28s budget + model order")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
