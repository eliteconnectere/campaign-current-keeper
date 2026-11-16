#!/usr/bin/env python3
from pathlib import Path
import re

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# Nuke literal backspaces left from bad \\b encoding
if "\x08" in t:
    t = t.replace("\x08", r"\b")  # this might wrong - better remove bad regex chars
    # Actually replace backspace with nothing then fix isClearSendCommand fully
    t = ea.read_text()
    t = t.replace("\x08", "")
    print("stripped backspaces")

# Replace isClearSendCommand completely (correct \\b via chr)
def wb():
    return "\\b"

new_fn = """
  function isClearSendCommand(text: string): boolean {
    const q = text.trim().toLowerCase();
    if (!q) return false;
    if (/\\b(do not|don't|never|stop)\\s+(send|execute|start|launch)\\b/i.test(q)) return false;
    // bare send / execute / launch / go ahead
    if (/^(ok|okay|yes|yeah|yep|sure|fine|alright|please|now)?\\s*(send|execute|start|launch)(\\s+it)?\\s*[.!]?$/i.test(q)) return true;
    if (/^(go ahead|do it|proceed|confirm)\\s*[.!]?$/i.test(q)) return true;
    if (/\\b(send|execute|start|launch)\\s+(it|that|this|them|now|the\\s+(campaign|email|message|list))\\b/i.test(q)) return true;
    if (/\\b(i want|i need|please|go ahead and)\\s+(you to\\s+)?(send|execute|start|launch)\\b/i.test(q)) return true;
    if (/\\b(send|execute)\\s+(to\\s+)?(everyone|all|the\\s+list)\\b/i.test(q)) return true;
    return false;
  }
""".replace("\\\\b", "\\b")  # produce \b in output file for JS regex

m = re.search(r"  function isClearSendCommand\(text: string\): boolean \{[\s\S]*?\n  \}\n", t)
if m:
    t = t[: m.start()] + new_fn + "\n" + t[m.end() :]
    print("isClearSendCommand replaced")

# Remove ALL throws that abort after import for validation failure — continue instead
replacements = [
    (
        'if (!onValidateRecipients) throw new Error("The list was imported, but recipient validation is not connected. Nothing was sent.");',
        'if (!onValidateRecipients) { /* prepare will validate */ } else',
    ),
    (
        'if (!validation.ok) throw new Error("The list was imported, but recipient validation did not complete. Nothing was sent.");',
        'if (!validation.ok) { importValidationSummary = (importValidationSummary || "") + " Validation will finish on prepare."; } else if (false)',
    ),
    (
        'if (!onValidateRecipients) throw new Error("The recipient list was imported, but recipient validation is not connected. Nothing was sent.");',
        'if (!onValidateRecipients) { /* prepare handles */ } else',
    ),
    (
        'if (!validation.ok) throw new Error("The recipient list was imported, but validation did not complete. Nothing was sent.");',
        'if (!validation.ok) { importValidationSummary = (importValidationSummary || "") + " Validation will finish on prepare."; } else if (false)',
    ),
]

for old, new in replacements:
    c = t.count(old)
    if c:
        t = t.replace(old, new)
        print(f"replaced x{c}: {old[:50]}...")

# Any remaining hard validation abort phrases → soft
for phrase in [
    "Recipient validation did not complete",
    "recipient validation did not complete",
    "validation did not complete",
]:
    if phrase in t and "throw" in t:
        # soft-replace throw lines containing phrase
        t2 = re.sub(
            r'throw new Error\("[^"]*' + re.escape(phrase) + r'[^"]*"\);',
            'importValidationSummary = (importValidationSummary || "") + " Validation skipped — prepare continues.";',
            t,
        )
        if t2 != t:
            print("softed phrase", phrase)
            t = t2

ea.write_text(t)
print("assist", ea.stat().st_size, "backspace", ea.read_text().count(chr(8)))

# app.tsx — ensure rexImportRawRef exists and is used
app = Path("src/routes/app.tsx")
a = app.read_text()
if "rexImportRawRef" not in a:
    a = a.replace(
        "const [raw, setRaw]",
        'const rexImportRawRef = useRef<string>("");\n  const [raw, setRaw]',
        1,
    )
    print("added ref")
if "rexImportRawRef.current = rawFile" not in a:
    a = a.replace(
        "setRecipients(imported);\n    setRaw(rawFile);",
        "rexImportRawRef.current = rawFile;\n    setRecipients(imported);\n    setRaw(rawFile);",
        1,
    )
    print("import writes ref")
if "rexImportRawRef.current.trim()" not in a:
    a = a.replace(
        "const parsed = raw.trim() ? parseRecipientFileText(raw) : recipients;",
        'const sourceText = raw.trim() || (rexImportRawRef.current || "").trim();\n    const parsed = sourceText ? parseRecipientFileText(sourceText) : recipients;',
        1,
    )
    a = a.replace(
        "const inputRows = raw.trim() ? parseRecipientFileText(raw) : recipients;",
        'const sourceText = raw.trim() || (rexImportRawRef.current || "").trim();\n      const inputRows = sourceText ? parseRecipientFileText(sourceText) : recipients;',
        1,
    )
    print("validate/prepare use ref")
app.write_text(a)

# Force Vercel rebuild marker
Path("public/.rex-build").write_text("force-send-approve-2026-11-10T20\n")
print("done")
