#!/usr/bin/env python3
"""Fix: Gemini 400 'Requests ending with a model turn are not supported'."""
from pathlib import Path

path = Path("src/lib/assist.functions.ts")
t = path.read_text()

old = '''  for (const item of rawContents) {
    const previous = contents[contents.length - 1];

    if (previous && previous.role === item.role) {
      previous.parts[0]!.text +=
        `\n${item.parts[0]!.text}`;
    } else {
      contents.push({
        role: item.role,
        parts: [{ text: item.parts[0]!.text }],
      });
    }
  }

  // Keep the entire provider attempt within a short server-function budget.'''

new = '''  for (const item of rawContents) {
    const text = String(item.parts[0]?.text ?? "").trim();
    if (!text) continue;
    const previous = contents[contents.length - 1];

    if (previous && previous.role === item.role) {
      previous.parts[0]!.text +=
        `\n${text}`;
    } else {
      contents.push({
        role: item.role,
        parts: [{ text }],
      });
    }
  }

  // Gemini (incl. gemini-3.5-flash-lite) rejects requests whose contents end on a model turn.
  // History from the client can include the prior assistant reply as the last item.
  while (contents.length && contents[contents.length - 1]?.role === "model") {
    contents.pop();
  }
  if (!contents.length || contents[contents.length - 1]?.role !== "user") {
    onFailure("Conversation history was empty or did not end with a user message after sanitizing for Gemini.");
    return null;
  }

  // Keep the entire provider attempt within a short server-function budget.'''

if old not in t:
    # try softer match
    if "Requests ending with a model turn" in t or "contents[contents.length - 1]?.role === \"model\"" in t:
        print("fix already present")
    else:
        # locate merge loop end another way
        marker = "// Keep the entire provider attempt within a short server-function budget."
        inject = '''
  // Gemini (incl. gemini-3.5-flash-lite) rejects requests whose contents end on a model turn.
  while (contents.length && contents[contents.length - 1]?.role === "model") {
    contents.pop();
  }
  if (!contents.length || contents[contents.length - 1]?.role !== "user") {
    onFailure("Conversation history was empty or did not end with a user message after sanitizing for Gemini.");
    return null;
  }

'''
        if marker in t and "contents end on a model turn" not in t:
            t = t.replace(marker, inject + marker, 1)
            path.write_text(t)
            print("injected via budget marker")
        else:
            raise SystemExit("pattern not found and fix not present")
else:
    t = t.replace(old, new, 1)
    path.write_text(t)
    print("replaced merge+sanitize block")

print("assist size", path.stat().st_size)
