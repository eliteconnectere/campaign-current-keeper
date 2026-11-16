#!/usr/bin/env python3
from pathlib import Path

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# 1) Always send recent live-session messages to Gemini.
# rememberContext / saveHistory control long-term memory, NOT the current chat window.
old_ctx = "const contextMessages = memorySettings.rememberContext ? next.slice(-10) : [next[next.length - 1]!];"
new_ctx = '''// Live session always keeps recent turns for the model so "More details" and follow-ups work
      // even when long-term memory / history is off. saveHistory only controls DB persistence.
      const contextMessages = next.slice(-12);'''
if old_ctx in t:
    t = t.replace(old_ctx, new_ctx, 1)
    print("context always live")
else:
    print("WARN context pattern")

# 2) More details: attach previous assistant answer so expand is never context-blind
old_more = 'onMore={() => void send("Please expand your previous answer with more useful detail, explain the reasoning and practical steps, and keep the context of our conversation.")}'
new_more = '''onMore={() => {
                const lastAssist = [...msgs].reverse().find((m) => m.role === "assistant");
                const prior = lastAssist?.content
                  ? lastAssist.content.replace(/\[\[[^\]]+\]\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 900)
                  : "";
                void send(
                  prior
                    ? "Please expand on your previous answer with more useful detail, reasoning, and practical steps. Keep our conversation context. Your previous answer was: " + prior
                    : "Please expand your previous answer with more useful detail, explain the reasoning and practical steps, and keep the context of our conversation."
                );
              }}'''
if old_more in t:
    t = t.replace(old_more, new_more, 1)
    print("more details improved")
else:
    print("WARN more details")

# 3) Typed positive confirmation can authorize a pending campaign approval
# (red button remains the preferred one-tap path; typing is optional equivalent)
old_short = '''    if (existingApproval && shortAffirmation) {
      return "The campaign approval is already displayed above. Tap its Approve button to authorize the workflow. A typed confirmation does not execute it.";
    }
    if (existingApproval && (approvalIntent || prepareIntent)) {
      return "The campaign approval is already displayed above. Tap its Approve button to authorize the exact workflow. Typing approval or asking me to run it again does not execute it.";
    }'''

# Replace with: for short affirmation, return a special marker the send() path can act on
# Simpler: change the message to tell user they can tap OR say yes — and in send() intercept yes to call approve

# Actually handle in send path: before campaignReply, if short yes and pending APPROVE_CAMPAIGN, call approve

if "TYPED_APPROVE_CAMPAIGN" not in t:
    # Change short affirmation responses to not block — return null so flow continues, and add send() interceptor
    t = t.replace(
        '''    if (existingApproval && shortAffirmation) {
      return "The campaign approval is already displayed above. Tap its Approve button to authorize the workflow. A typed confirmation does not execute it.";
    }
    if (existingApproval && (approvalIntent || prepareIntent)) {
      return "The campaign approval is already displayed above. Tap its Approve button to authorize the exact workflow. Typing approval or asking me to run it again does not execute it.";
    }''',
        '''    // Typed yes / go ahead is a valid approval when a pending campaign card is already shown.
    // Prefer the red button (one tap); typing is the same authorization, just more steps.
    if (existingApproval && shortAffirmation) {
      return "[[TYPED_APPROVE_CAMPAIGN]]";
    }
    if (existingApproval && (approvalIntent || prepareIntent) && shortAffirmation) {
      return "[[TYPED_APPROVE_CAMPAIGN]]";
    }
    if (existingApproval && (approvalIntent || prepareIntent)) {
      return "A campaign approval is already displayed above. Tap Approve & Send Now, or reply yes / go ahead to authorize the same workflow.";
    }''',
        1,
    )
    print("typed campaign approve marker")

# In send(), when campaignReply is TYPED_APPROVE_CAMPAIGN, execute approve from last card
inject = '''      if (campaignReply === "[[TYPED_APPROVE_CAMPAIGN]]") {
        const pending = [...msgs].reverse().find(message =>
          message.role === "assistant" && /\[\[APPROVE_CAMPAIGN:[^:]+:/.test(message.content)
        );
        const match = pending?.content.match(/\[\[APPROVE_CAMPAIGN:([a-z0-9-]+):([^:]+):(send|schedule)\]\]/i);
        if (match) {
          setBusy(false);
          await approveCampaignFromCard(match[1]!, match[2]!, match[3] === "schedule" ? "schedule" : "send");
          return;
        }
        const tip = "I could not find an active campaign approval card. Ask me to prepare the campaign again, then tap Approve or reply yes.";
        setMsgs([...next, { role: "assistant", content: tip }]);
        await persistMessage("assistant", tip);
        return;
      }
'''

if "TYPED_APPROVE_CAMPAIGN" in t and "await approveCampaignFromCard(match" not in t:
    needle = "if (campaignReply) {\n        // This response came from a deterministic app workflow, not the AI model."
    if needle in t:
        t = t.replace(needle, inject + "\n      if (campaignReply) {\n        // This response came from a deterministic app workflow, not the AI model.", 1)
        print("send interceptor")
    else:
        print("WARN inject point")

# Import typing yes
t = t.replace(
    'Tap its approval button to continue; typing yes does not execute it again.',
    'Tap its approval button, or reply yes / go ahead, to continue.',
)

ea.write_text(t)
print("EliteAssist size", ea.stat().st_size)

# Brief note
af = Path("src/lib/assist.functions.ts")
if af.exists():
    s = af.read_text()
    if "TYPED YES IS VALID APPROVAL" not in s:
        note = """
TYPED YES IS VALID APPROVAL (UX):
- Prefer the red Approve control (one tap).
- A clear positive reply (yes, go ahead, proceed, confirm, do it, ok) after a pending approval card is also authorization for that same pending action.
- Clear negative (no, cancel, stop, never mind) declines / expires that pending control.
- Do not invent new approvals from a lone "yes" when no pending control is on screen.
"""
        for a in ["PREVIEW-BEFORE-APPROVE", "APPROVAL LIFECYCLE", "Never invent approval buttons"]:
            if a in s:
                s = s.replace(a, a + "\n" + note, 1)
                print("brief")
                break
        af.write_text(s)

print("done")
