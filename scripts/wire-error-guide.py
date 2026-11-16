from pathlib import Path
p = Path("src/routes/app.tsx")
t = p.read_text()

if "ErrorGuideHost" not in t:
    t = t.replace(
        'import { ExpiryReminder } from "@/features/billing/ExpiryReminder";',
        'import { ExpiryReminder } from "@/features/billing/ExpiryReminder";\nimport { ErrorGuideHost, showErrorGuide } from "@/features/workspace/ErrorGuide";',
        1,
    )
    # mount near EliteTips
    if "<EliteTips" in t and "<ErrorGuideHost" not in t:
        t = t.replace(
            "<EliteTips",
            "<ErrorGuideHost />\n      <EliteTips",
            1,
        )
        print("mounted host")

# Improve already-sent toast + guide
old = 'toast.info("🛡️ Cannot send: All recipients in this range were already sent! Permanent Send Protection locked these addresses to prevent duplicate sends.");'
# try multiple possible strings
candidates = [
    old,
    'toast.info("Cannot send: every address in this range was already sent. Permanent Send Protection blocks duplicates.");',
    'toast.error("Cannot send: every address in this range was already sent. Permanent Send Protection blocks duplicates.");',
]
replacement = '''toast.info("Cannot send: this range already finished. Tap Reset, or change subject/body, then Execute again.");
      showErrorGuide({
        title: "This range already finished",
        body: "Elite blocked a second run of the same finished list so you do not spam the same people by accident.",
        steps: [
          "Tap Reset (next to Execute) to clear Sent marks for this run.",
          "Or change the subject / message body if this is a new outreach.",
          "Or change From–To to addresses not yet marked Sent.",
          "Then tap Execute Campaign again.",
        ],
      });'''

for c in candidates:
    if c in t:
        t = t.replace(c, replacement, 1)
        print("replaced toast", c[:40])
        break
else:
    # softer search
    if "already sent" in t and "showErrorGuide" not in t:
        import re
        m = re.search(r'toast\.(info|error)\([^)]*already sent[^)]*\);', t)
        if m:
            t = t[: m.start()] + replacement + t[m.end() :]
            print("regex toast replace")
        else:
            print("WARN no already-sent toast")
    else:
        print("skip toast")

p.write_text(t)
print("done")
