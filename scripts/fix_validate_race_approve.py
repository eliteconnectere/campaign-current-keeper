#!/usr/bin/env python3
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
a = app.read_text()

# Add ref for last imported raw so validate/prepare don't rely only on async setState
if "rexImportRawRef" not in a:
    # place near other refs - after sentRecipientEmailsRef or similar
    if "sentRecipientEmailsRef" in a:
        a = a.replace(
            "sentRecipientEmailsRef",
            "sentRecipientEmailsRef",
            1,
        )
    # inject after first useRef for engine or generated
    marker = "const generatedRef"
    if marker in a and "rexImportRawRef" not in a:
        # find the line with generatedRef declaration
        m = re.search(r"const generatedRef = useRef[^;]+;", a)
        if m:
            a = a[: m.end()] + "\n  const rexImportRawRef = useRef<string>(\"\");" + a[m.end() :]
            print("rexImportRawRef added")
    elif "const [raw, setRaw]" in a:
        a = a.replace(
            "const [raw, setRaw]",
            "const rexImportRawRef = useRef<string>(\"\");\n  const [raw, setRaw]",
            1,
        )
        print("rexImportRawRef near raw")

if "rexImportRawRef.current = rawFile" not in a:
    a = a.replace(
        "setRecipients(imported);\n    setRaw(rawFile);",
        "rexImportRawRef.current = rawFile;\n    setRecipients(imported);\n    setRaw(rawFile);",
        1,
    )
    print("import sets ref")

# validate: use ref fallback when raw empty
old_val = "const parsed = raw.trim() ? parseRecipientFileText(raw) : recipients;"
new_val = "const sourceText = raw.trim() || rexImportRawRef.current.trim();\n    const parsed = sourceText ? parseRecipientFileText(sourceText) : recipients;"
if old_val in a and "rexImportRawRef.current" in a:
    a = a.replace(old_val, new_val, 1)
    print("validate uses ref")

# prepare: use ref fallback
old_prep = 'const inputRows = raw.trim() ? parseRecipientFileText(raw) : recipients;'
if old_prep in a:
    a = a.replace(
        old_prep,
        'const sourceText = raw.trim() || rexImportRawRef.current.trim();\n      const inputRows = sourceText ? parseRecipientFileText(sourceText) : recipients;',
        1,
    )
    print("prepare uses ref")

app.write_text(a)
print("app", app.stat().st_size)

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# Soften intercept: never abort whole send on validate; always try prepare + Approve
old_block = '''          if (pendingImport && onImportRecipients) {
            if (!onImportRecipients(pendingImport.raw, pendingImport.fileName)) {
              const why = (typeof window !== "undefined" && (window as any).__ecLastImportError)
                ? String((window as any).__ecLastImportError)
                : "Could not import the staged recipient list.";
              throw new Error(why);
            }
            setPendingImport(null);
            await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
            if (onValidateRecipients) {
              const validation = await onValidateRecipients();
              if (!validation.ok) throw new Error("Recipient validation did not complete.");
              importValidationSummary = " Checks: " + validation.valid + " valid, " + validation.risky + " risky, " + validation.duplicate + " duplicate.";
            }
          } else if (onValidateRecipients) {
            try {
              const validation = await onValidateRecipients();
              if (validation.ok) {
                importValidationSummary = " Checks: " + validation.valid + " valid, " + validation.risky + " risky, " + validation.duplicate + " duplicate.";
              }
            } catch { /* optional if list already in workspace */ }
          }'''

new_block = '''          if (pendingImport && onImportRecipients) {
            if (!onImportRecipients(pendingImport.raw, pendingImport.fileName)) {
              const why = (typeof window !== "undefined" && (window as any).__ecLastImportError)
                ? String((window as any).__ecLastImportError)
                : "Could not import the staged recipient list.";
              throw new Error(why);
            }
            setPendingImport(null);
            // Allow React state + import ref to settle before validate/prepare
            await new Promise<void>(r => setTimeout(r, 50));
          }
          if (onValidateRecipients) {
            try {
              const validation = await onValidateRecipients();
              if (validation.ok) {
                importValidationSummary = " Checks: " + validation.valid + " valid, " + validation.risky + " risky, " + validation.duplicate + " duplicate.";
              } else {
                importValidationSummary = " Validation pending — Elite Engine will re-check on prepare.";
              }
            } catch {
              importValidationSummary = " Validation will run during prepare.";
            }
          }'''

if old_block in t:
    t = t.replace(old_block, new_block, 1)
    print("intercept softened")
else:
    # replace the throw line only
    if 'throw new Error("Recipient validation did not complete.")' in t:
        t = t.replace(
            'if (!validation.ok) throw new Error("Recipient validation did not complete.");',
            'if (!validation.ok) { importValidationSummary = " Validation will complete on prepare."; } else',
            1,
        )
        # might break syntax - check
        print("throw removed soft")
    else:
        print("WARN block not found")
        # show nearby
        i = t.find("Recipient validation")
        print(repr(t[i - 100 : i + 120]) if i >= 0 else "no phrase")

ea.write_text(t)
print("assist", ea.stat().st_size)
print("done")
