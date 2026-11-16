#!/usr/bin/env python3
"""Restore EliteAssist from last known good commit and apply critical fixes."""
from pathlib import Path
import urllib.request
import re

GOOD = "0b67178e3ea672d6dc938ed93263517c917aef45"
URL = f"https://raw.githubusercontent.com/eliteconnectere/eliteconnectere/{GOOD}/src/features/assist/EliteAssist.tsx"

out = Path("src/features/assist/EliteAssist.tsx")
print("downloading", URL)
req = urllib.request.Request(URL, headers={"User-Agent": "elite-restore"})
with urllib.request.urlopen(req, timeout=60) as r:
    t = r.read().decode("utf-8")
print("downloaded", len(t))

# Fix else-without-block
t, n = re.subn(
    r"if \(!onValidateRecipients\) \{ /\*[^*]*\*/ \} else\s*\n(\s*)const validation = await onValidateRecipients\(\);",
    lambda m: "if (onValidateRecipients) {\n" + m.group(1) + "const validation = await onValidateRecipients();",
    t,
)
print("else fix", n)
t, n = re.subn(
    r"\belse\s*\n(\s*)const validation = await onValidateRecipients\(\);",
    lambda m: "if (onValidateRecipients) {\n" + m.group(1) + "const validation = await onValidateRecipients();",
    t,
)
print("else2", n)
t = re.sub(r"\} else if \(false\)\s*\n(\s*)(importValidationSummary|const )", r"}\n\1\2", t)

# Define approveActionFromCard
impl = '''
  async function approveActionFromCard(id: string, automatic = false) {
    const action = actionApprovalIds.current.get(id);
    if (!action) {
      toast.error("That control expired. Say pause, stop, or continue again.");
      return;
    }
    actionApprovalIds.current.delete(id);
    let note = "";
    let ok = false;
    if (action === "pause") {
      ok = Boolean(onPauseCurrentCampaign && onPauseCurrentCampaign());
      note = ok ? "Campaign paused." : "Could not pause.";
    } else if (action === "stop") {
      ok = Boolean(onStopCurrentCampaign && onStopCurrentCampaign());
      note = ok ? "Campaign stopped." : "Could not stop.";
    } else {
      ok = onExecuteCurrentCampaign ? await onExecuteCurrentCampaign() : false;
      note = ok ? "Campaign continued." : "Could not continue.";
    }
    setMsgs((current) => current.map((m) =>
      m.content.includes("[[REX_APPROVAL:" + id + ":")
        ? { ...m, content: m.content.replace(/\\[\\[REX_APPROVAL:[^\\]]+\\]\\]/g, "[[REX_APPROVED:" + id + ":" + action + "]]") }
        : m
    ).concat([{ role: "assistant", content: note }]));
    await persistMessage("assistant", note);
    if (ok) toast.success(note); else toast.error(note);
  }

'''
if "async function approveActionFromCard" not in t:
    if "async function approveCampaignFromCard" in t:
        t = t.replace("async function approveCampaignFromCard", impl + "  async function approveCampaignFromCard", 1)
        print("approveActionFromCard added")
    elif "async function approveHotspotInvite" in t:
        t = t.replace("async function approveHotspotInvite", impl + "  async function approveHotspotInvite", 1)
        print("approveActionFromCard near hotspot")

# send campaign in isClearSendCommand
if "send\\s+(?:the\\s+)?campaign" not in t and "send campaign" not in t:
    needle = "if (/\\b(?:send|execute)\\s+(?:to\\s+)?(?:everyone|all|the\\s+list)\\b/i.test(q)) return true;"
    if needle in t:
        t = t.replace(
            needle,
            needle + "\n    if (/\\b(?:send|execute|start|launch|continue)\\s+(?:the\\s+)?campaign\\b/i.test(q)) return true;",
            1,
        )
        print("send campaign")

out.write_text(t)
print("written", out.stat().st_size)
print("approveActionFromCard", t.count("approveActionFromCard"))
print("PLACEHOLDER", "PLACEHOLDER" in t)
print("done")
