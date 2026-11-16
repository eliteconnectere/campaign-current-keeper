#!/usr/bin/env python3
from pathlib import Path

# --- app: import returns reason ---
app = Path("src/routes/app.tsx")
a = app.read_text()
old = '''  function importRecipientsIntoWorkspace(rawFile: string, sourceName = "Imported list"): boolean {
    if (engine === "sending" || engine === "paused") {
      toast.error("Pause or stop the active campaign before replacing its recipient list.");
      return false;
    }
    const imported = parseRecipientFileText(rawFile);
    if (!imported.length) {
      toast.error("No usable email addresses were found. Check that the file has an Email column or valid email addresses.");
      return false;
    }'''

# Change to return status object is bigger change - keep boolean but set last error on window for Rex
if 'ecLastImportError' not in a:
    a = a.replace(
        '''  function importRecipientsIntoWorkspace(rawFile: string, sourceName = "Imported list"): boolean {
    if (engine === "sending" || engine === "paused") {
      toast.error("Pause or stop the active campaign before replacing its recipient list.");
      return false;
    }
    const imported = parseRecipientFileText(rawFile);
    if (!imported.length) {
      toast.error("No usable email addresses were found. Check that the file has an Email column or valid email addresses.");
      return false;
    }''',
        '''  function importRecipientsIntoWorkspace(rawFile: string, sourceName = "Imported list"): boolean {
    if (engine === "sending" || engine === "paused") {
      try { (window as any).__ecLastImportError = "A campaign is still sending or paused. Pause/stop it before replacing the recipient list."; } catch {}
      toast.error("Pause or stop the active campaign before replacing its recipient list.");
      return false;
    }
    const imported = parseRecipientFileText(rawFile);
    if (!imported.length) {
      try { (window as any).__ecLastImportError = "No usable email addresses were parsed from the staged text (need valid emails or an Email column)."; } catch {}
      toast.error("No usable email addresses were found. Check that the file has an Email column or valid email addresses.");
      return false;
    }
    try { (window as any).__ecLastImportError = ""; } catch {}''',
        1,
    )
    app.write_text(a)
    print("app import errors")

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()
old_err = 'throw new Error("I couldn\'t transfer the staged recipient list into Elite Engine. Nothing was sent.");'
new_err = '''{
                const why = (typeof window !== "undefined" && (window as any).__ecLastImportError) ? String((window as any).__ecLastImportError) : "";
                throw new Error((why || "I could not import the staged list into the Recipients workspace.") + " Nothing was sent.");
              }'''
if old_err in t:
    t = t.replace(old_err, new_err, 1)
    print("assist error honest")
else:
    # alternate quote style
    t = t.replace(
        "I couldn't transfer the staged recipient list into Elite Engine. Nothing was sent.",
        '" + (((typeof window !== "undefined" && (window as any).__ecLastImportError) ? String((window as any).__ecLastImportError) : "I could not import the staged list into the Recipients workspace.")) + " Nothing was sent.',
    )
    print("assist alt")

ea.write_text(t)

af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "WORKSPACE AUTHORITY" not in s:
    note = '''
WORKSPACE AUTHORITY (HONEST)
You ARE connected to this owner's live Elite Connectere workspace through application handlers. You can (when the handlers succeed):
- Import a staged recipient list into Recipients
- Validate recipients (valid / risky / duplicate → quarantine path)
- Apply subject/body to Campaign Template A/B
- Prepare campaign preview (count, subject, body)
- After owner Approve: start/pause/stop Elite Engine for the current campaign
- Navigate registered places (settings, workspace, notifications, etc.)
- Update many reversible Studio/settings toggles
- Read approved workspace snapshots when the owner authorizes inspect
- Private Chat send only after exact message approval

You cannot:
- Invent external URLs or backend routes outside Elite Connectere
- Access another user's data or full Gmail inbox
- Bypass send approval for campaigns or Private Chat
- Claim import/validate/send succeeded if the application returned failure

If an import fails, explain the real reason (campaign still running, no parseable emails, handler missing) — never say you lack an import tool when the workspace import handler is connected.
If the user asks what you can do, answer as assistant (chat, draft, explain, plan) and as agent (workspace operations above) clearly.
If something is beyond these capabilities, say so plainly and offer the closest supported path.
'''
    if "OK SEND MEANS SEND" in s:
        s = s.replace("OK SEND MEANS SEND", note + "\nOK SEND MEANS SEND", 1)
    else:
        s = s.replace("OWNER'S CONTROL", note + "\nOWNER'S CONTROL", 1)
    af.write_text(s)
    print("brief")
print("done")
