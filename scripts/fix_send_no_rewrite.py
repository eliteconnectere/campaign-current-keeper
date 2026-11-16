#!/usr/bin/env python3
# CRITICAL: use raw strings so \\b stays as regex word-boundary, not backspace.
from pathlib import Path
import re

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# Replace entire isClearSendCommand function with a correct one
new_helper = r'''
  function isClearSendCommand(text: string): boolean {
    const q = text.trim();
    if (!q) return false;
    if (/\b(?:do not|don't|never|stop)\s+(?:send|execute|start|launch)\b/i.test(q)) return false;
    // ok send | yes send | send it | send now | go ahead | execute
    if (/^(?:(?:ok|okay|yes|yeah|yep|please|now|sure|fine|alright|go ahead|do it)\s+)*(?:send|execute|start|launch)(?:\s+it)?\s*[.!]?$/i.test(q)) return true;
    if (/\b(?:send|execute|start|launch)\s+(?:it|that|this|them|now|the\s+(?:campaign|email|message|list))\b/i.test(q)) return true;
    if (/\b(?:i want|i need|please|go ahead and)\s+(?:you to\s+)?(?:send|execute|start|launch)\b/i.test(q)) return true;
    if (/\b(?:send|execute)\s+(?:to\s+)?(?:everyone|all|the\s+list)\b/i.test(q)) return true;
    return false;
  }
'''

# Match existing broken or good function
m = re.search(r"  function isClearSendCommand\(text: string\): boolean \{[\s\S]*?\n  \}\n", t)
if m:
    t = t[:m.start()] + new_helper + "\n" + t[m.end():]
    print("replaced isClearSendCommand")
else:
    print("WARN no isClearSendCommand block")

# Early intercept in send(): clear send never goes to Gemini for a new draft
intercept = r'''
      // HARD RULE: "OK send" / "send it" is agent work — never rewrite the message via Gemini.
      if (isClearSendCommand(content)) {
        const existingApproval = [...msgs].reverse().find(message =>
          message.role === "assistant" && message.content.includes("[[APPROVE_CAMPAIGN:")
        );
        if (existingApproval) {
          const match = existingApproval.content.match(/\[\[APPROVE_CAMPAIGN:([a-z0-9-]+):([^:\]]+):(send|schedule)\]\]/i);
          if (match) {
            setBusy(false);
            await approveCampaignFromCard(match[1]!, match[2]!, match[3] === "schedule" ? "schedule" : "send");
            return;
          }
        }
        // No pending approval yet → run import + validate + prepare + show Approve (no AI rewrite)
        if (!onPrepareCampaign || !onExecuteCurrentCampaign) {
          const fail = "Campaign send is not connected in this workspace session. Nothing was sent.";
          setMsgs([...next, { role: "assistant", content: fail }]);
          await persistMessage("assistant", fail);
          return;
        }
        try {
          let importValidationSummary = "";
          if (pendingImport && onImportRecipients) {
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
          }
          const prepared = await onPrepareCampaign();
          let preview: { recipientCount?: number; subject?: string; body?: string } = {};
          try { preview = JSON.parse(prepared) as typeof preview; } catch {}
          const recipientCount = Number(preview.recipientCount ?? 0);
          const subject = String(preview.subject ?? "").trim();
          const body = String(preview.body ?? "").trim();
          if (!subject || !body || recipientCount < 1) {
            throw new Error("No complete campaign draft in the workspace yet (need subject, body, and at least one eligible recipient). Apply the agreed message to a template and import recipients, then say OK send again.");
          }
          const campaignId = "engine-approval-" + crypto.randomUUID();
          engineSessionApprovalIds.current.add(campaignId);
          const toolReply =
            "Ready to send.\n\nRecipients: " + recipientCount.toLocaleString() + importValidationSummary +
            "\n\nSubject: " + subject +
            "\n\nMessage:\n" + body +
            "\n\nNothing has been sent yet. Tap Approve & Send Now (or reply yes)." +
            "\n\n[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: toolReply }]);
          await persistMessage("assistant", toolReply);
          return;
        } catch (error) {
          const fail = error instanceof Error ? error.message : "Send preparation failed. Nothing was sent.";
          setMsgs([...next, { role: "assistant", content: fail }]);
          await persistMessage("assistant", fail);
          return;
        }
      }
'''

# Insert after setBusy(true); setSuggests([]); try {
if "HARD RULE: \"OK send\"" not in t and "HARD RULE: " not in t:
    needle = "setBusy(true);\n    setSuggests([]);\n    try {"
    if needle in t:
        t = t.replace(needle, "setBusy(true);\n    setSuggests([]);\n    try {" + intercept, 1)
        print("intercept inserted")
    else:
        needle2 = "setBusy(true);\n    setSuggests([]);\n    try {\n"
        if needle2 in t:
            t = t.replace(needle2, "setBusy(true);\n    setSuggests([]);\n    try {" + intercept + "\n", 1)
            print("intercept inserted alt")
        else:
            print("WARN insert point missing")
else:
    print("intercept already present")

# Collapse huge recipient dumps in staged assistant copy
t = t.replace(
    '"I\'ve staged your recipient list here in Rex (" + pastedEmails.length.toLocaleString() + " email addresses). It has NOT been imported into your active Recipients workspace. Let\'s agree on the message first; I will only transfer the list and prepare the campaign after you explicitly tell me to send it. Nothing has been sent."',
    '"Staged **" + pastedEmails.length.toLocaleString() + " recipients** privately (list hidden in chat — open Recipients to see them). Agree the message, then say **OK send** — I will import, validate, and show Approve. Nothing has been sent."',
)

ea.write_text(t)
print("size", ea.stat().st_size)

# Verify no literal backspace in helper
if "\x08" in ea.read_text():
    print("WARNING still has backspace chars")
else:
    print("no backspace corruption")
print("done")
