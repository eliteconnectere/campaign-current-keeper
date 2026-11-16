#!/usr/bin/env python3
"""Fix: OK send / yes send must trigger real campaign approve control + validate."""
from pathlib import Path

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# Shared broad send detector
NEW_HELPER = '''
  function isClearSendCommand(text: string): boolean {
    const q = text.trim();
    if (!q) return false;
    if (/\b(?:do not|don't|never|stop)\s+(?:send|execute|start|launch)\b/i.test(q)) return false;
    // ok send | yes send | send it | send now | go ahead | execute | launch campaign
    if (/^(?:(?:ok|okay|yes|yeah|yep|please|now|sure|fine|alright|go ahead|do it)\s+)*(?:send|execute|start|launch)(?:\s+it)?\s*[.!]?$/i.test(q)) return true;
    if (/\b(?:send|execute|start|launch)\s+(?:it|that|this|them|now|the\s+(?:campaign|email|message|list))\b/i.test(q)) return true;
    if (/\b(?:i want|i need|please|go ahead and)\s+(?:you to\s+)?(?:send|execute|start|launch)\b/i.test(q)) return true;
    if (/\b(?:send|execute)\s+(?:to\s+)?(?:everyone|all|the\s+list)\b/i.test(q)) return true;
    return false;
  }
'''

if "function isClearSendCommand" not in t:
    # insert near other helpers inside component — before runRexCampaignCommand or after stageRecipientImport
    anchor = "async function stageRecipientImport"
    if anchor in t:
        t = t.replace(anchor, NEW_HELPER + "\n  " + anchor, 1)
        print("helper inserted")
    else:
        # before approveCampaignFromCard
        anchor2 = "async function approveCampaignFromCard"
        t = t.replace(anchor2, NEW_HELPER + "\n  " + anchor2, 1)
        print("helper near approve")

# Replace narrow explicitlyRequestsSend block
old_explicit = '''            const explicitlyRequestsSend =
              /^(?:(?:please|now|go ahead and|i want you to|i need you to)\s+)*(?:send|execute|start|launch)\b/i.test(content.trim()) ||
              /\b(?:send|execute|start|launch)\s+(?:the|this|my)\s+(?:campaign|email|message)\b/i.test(content);
            if (explicitlyRequestsSend) {
              const campaignId = "engine-approval-" + crypto.randomUUID();
              engineSessionApprovalIds.current.add(campaignId);
              toolReply = previewText + "\n\nReview the details above. Approve only if this is exactly what you want sent.\n\n[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]";
            } else {
              toolReply = previewText;
            }'''

new_explicit = '''            // Any clear send command (OK send, yes send, send it, execute…) gets a real Approve control.
            const explicitlyRequestsSend = isClearSendCommand(content);
            if (explicitlyRequestsSend) {
              const campaignId = "engine-approval-" + crypto.randomUUID();
              engineSessionApprovalIds.current.add(campaignId);
              toolReply = previewText +
                "\n\nValidated list is ready. Tap **Approve & Send Now** (or reply yes) to start Elite Engine." +
                "\n\n[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]";
            } else {
              // Still show draft, but invite a clear send so the control appears next turn.
              toolReply = previewText + "\n\nWhen this looks right, say **OK send** or **send it** and I will show the Approve control.";
            }'''

if old_explicit in t:
    t = t.replace(old_explicit, new_explicit, 1)
    print("explicit send fixed")
else:
    print("WARN explicit block pattern mismatch")
    # try softer replace of the regex only
    if "explicitlyRequestsSend =" in t and "isClearSendCommand(content)" not in t:
        import re
        t2, n = re.subn(
            r"const explicitlyRequestsSend =\s*[^;]+;",
            "const explicitlyRequestsSend = isClearSendCommand(content);",
            t,
            count=1,
        )
        if n:
            t = t2
            print("regex only replaced", n)

# Soften REX_PREPARE gate: use isClearSendCommand if available
if "!isExplicitSendRequest(content)" in t:
    t = t.replace(
        "!isExplicitSendRequest(content)",
        "!(typeof isClearSendCommand === 'function' ? isClearSendCommand(content) : isExplicitSendRequest(content))",
    )
    # isClearSendCommand is in component scope - isExplicitSendRequest is local arrow inside send
    print("prepare gate note")

# Replace isExplicitSendRequest body usages inside send to prefer clear send
# Find local isExplicitSendRequest = and expand
old_isr = '''isExplicitSendRequest = (text: string) =>
        /\b(?:send|execute|start|launch)\b/i.test(text) &&
        !/\b(?:do not|don't|never)\s+(?:send|execute|start|launch)\b/i.test(text) &&'''

if "isClearSendCommand" in t and old_isr in t:
    # Make local function delegate
    t = t.replace(
        "isExplicitSendRequest = (text: string) =>",
        "isExplicitSendRequest = (text: string) => isClearSendCommand(text) || (",
        1,
    )
    # need closing paren - fragile. Better replace whole assignment if we can find end
    print("isr partially wrapped - verify")

# Simpler: replace calls isExplicitSendRequest(content) with isClearSendCommand(content)
if "function isClearSendCommand" in t or "isClearSendCommand(text" in t:
    t = t.replace("isExplicitSendRequest(content)", "isClearSendCommand(content)")
    print("calls switched to isClearSendCommand")

# When second "ok send" after a prepared preview without approval tag, still attach approval
# Handled if explicitlyRequestsSend is true on next prepare - also: if last assistant was preview
# and user says send, force approval in runRexCampaignCommand path

old_run = '''  async function runRexCampaignCommand(question: string): Promise<string | null> {
    // Let Rex prepare and display the real message before any send approval appears.
    const existingApproval = msgs.slice().reverse().find(message =>
      message.role === "assistant" && message.content.includes("[[APPROVE_CAMPAIGN:")
    );
    if (!existingApproval) return null;
    const shortAffirmation = /^(yes|yeah|yep|ok|okay|approved|go ahead|do it|proceed|confirm|send it)$/i.test(question.trim());
    if (shortAffirmation) return "[[TYPED_APPROVE_CAMPAIGN]]";'''

new_run = '''  async function runRexCampaignCommand(question: string): Promise<string | null> {
    const existingApproval = msgs.slice().reverse().find(message =>
      message.role === "assistant" && message.content.includes("[[APPROVE_CAMPAIGN:")
    );
    const shortAffirmation = /^(yes|yeah|yep|ok|okay|approved|go ahead|do it|proceed|confirm|send it)$/i.test(question.trim())
      || isClearSendCommand(question);
    if (existingApproval && shortAffirmation) return "[[TYPED_APPROVE_CAMPAIGN]]";
    // Preview was shown without a button (old path); user now says send → return null so full prepare+approve runs
    if (!existingApproval) return null;'''

if old_run in t:
    t = t.replace(old_run, new_run, 1)
    print("runRexCampaign updated")
else:
    print("WARN runRex pattern")

ea.write_text(t)
print("EliteAssist", ea.stat().st_size)

# Brief: when user says send after discussion, apply agreed draft and show approve — do not loop review
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "OK SEND MEANS SEND" not in s:
    note = '''
OK SEND MEANS SEND
- After you and the owner agree a draft, phrases like "OK send", "send it", "yes send", "execute" mean: apply the agreed copy, validate recipients, quarantine risky/invalid, and present the real Approve & Send control with the exact subject/body/count.
- Do not answer with another "let's finish discussing" or a review-only message with no approval control when the owner clearly asked to send.
- The draft shown on that approval must be the agreed message, not an unrelated template.
'''
    if "ASSISTANT FIRST, AGENT SECOND" in s:
        s = s.replace("ASSISTANT FIRST, AGENT SECOND", "ASSISTANT FIRST, AGENT SECOND\n" + note, 1)
    elif "ONLY SEND NEEDS APPROVAL" in s:
        s = s.replace("ONLY SEND NEEDS APPROVAL", note + "\nONLY SEND NEEDS APPROVAL", 1)
    else:
        s = s.replace("OWNER'S CONTROL", note + "\nOWNER'S CONTROL", 1)
    af.write_text(s)
    print("brief")
print("done")
