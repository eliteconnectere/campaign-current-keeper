#!/usr/bin/env python3
from pathlib import Path

BRIEF = '''
PREVIEW-BEFORE-APPROVE (HARD SAFETY — NEVER SKIP):
- Before any send-related approval control (Private Chat send, campaign execute/send, hotspot share when message-like), the user MUST see the exact content they are authorizing in the same assistant message.
- Private Chat: show To (recipient) + the full message body in plain text, then the registered [[REX_CHAT_APPROVAL:...]] marker. Never show Approve & Send alone without the body.
- Campaign / Elite Engine execute: show at least recipient count (or "active list"), subject, and body/template preview from the live workspace when available. If you cannot show the draft content, say so and offer workspace inspect approval first — do NOT emit Approve & Send Now until the user has been able to read what will go out.
- If the user says they need to read, edit, or see the message first, do not pressure them to approve. Show or help them open the draft. Withhold the send approval until content is visible.
- Typing "yes" is never execution. Only the real red/product Approve button after a clear preview is authorization.
'''

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# Stronger campaign prepare copy requiring content visibility
old_prep = (
    'return "This approval authorizes Rex to inspect the active Elite Engine campaign and recipient list, validate recipients, classify valid, risky and duplicate entries and apply the workspace\'s sending protections'
)
if "PREVIEW BEFORE YOU APPROVE" not in t:
    # Replace the long return string for campaign prepare - find unique start
    marker = 'const campaignId = "engine-approval-" + crypto.randomUUID();'
    if marker in t:
        # find return after this that includes APPROVE_CAMPAIGN and engine-approval
        i = t.find(marker)
        j = t.find("[[APPROVE_CAMPAIGN:" + '" + campaignId', i)
        if j < 0:
            j = t.find("[[APPROVE_CAMPAIGN:", i)
        # find start of return statement containing this
        ret = t.rfind("return ", i, j)
        end = t.find(";", j)
        if ret > 0 and end > ret:
            new_return = r'''return (
      "PREVIEW BEFORE YOU APPROVE\n" +
      "This control starts the active Elite Engine campaign from your current workspace draft.\n\n" +
      "Before you tap Approve & Send Now, you must know what will go out:\n" +
      "• Open your subject and body in the workspace (or ask me to inspect the live draft with a separate read approval).\n" +
      "• Confirm the recipient list is the list you intend.\n\n" +
      "I will not claim the exact subject/body here unless a live draft snapshot is available in this step. " +
      "If you have not read the message, do not approve — ask me to show the draft first.\n\n" +
      "This approval then authorizes inspect + validate + protections + start for the current Engine session only. " +
      "Nothing is sent until you tap the button below.\n\n" +
      "[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]"
    );'''
            # careful - the old return is one long string. Use simpler replace of first occurrence of the long authorize string
            pass

# Simpler approach: inject safety prefix into the known authorize string start
if "PREVIEW BEFORE YOU APPROVE" not in t:
    needle = "This approval authorizes Rex to inspect the active Elite Engine campaign"
    if needle in t:
        t = t.replace(
            needle,
            "PREVIEW BEFORE YOU APPROVE. If you have not read the subject and body of the active campaign draft, do not approve yet — ask me to inspect or show the draft first. " + needle,
            2,  # both prepare paths
        )
        print("campaign preview prefix")

# Campaign button UI: add warning panel
old_btn = '''      {campaignApproval && !alreadyApproved && (
        <button
          type="button"
          onClick={() => onApproveCampaign(campaignApproval[1]!, campaignApproval[2]!, campaignApproval[3] === "schedule" ? "schedule" : "send")}
          className="mt-2 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground"
        >
          {campaignApproval[3] === "schedule" ? "Approve & Schedule" : "Approve & Send Now"}
        </button>
      )}'''

new_btn = '''      {campaignApproval && !alreadyApproved && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Campaign send — read before you approve</p>
          <p className="mt-1 text-[12px] text-ink-soft">This starts the <span className="font-semibold text-ink">current Elite Engine</span> draft (active subject, body, and recipient list). If you have not opened or inspected that message, cancel and ask Rex to show the draft first.</p>
          <button
            type="button"
            onClick={() => onApproveCampaign(campaignApproval[1]!, campaignApproval[2]!, campaignApproval[3] === "schedule" ? "schedule" : "send")}
            className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            {campaignApproval[3] === "schedule" ? "Approve & Schedule" : "Approve & Send Now"}
          </button>
        </div>
      )}'''

if old_btn in t:
    t = t.replace(old_btn, new_btn, 1)
    print("campaign card UI")
else:
    print("campaign card pattern miss")

# Chat approval card - stronger read-first wording
old_chat = '''      {chatPayload && !chatSent && (
'''
# find and replace the title line if present
t = t.replace(
    "Approve & Send Private Message",
    "I have read this — Approve & Send",
)
if "Private Chat send — read the exact message" not in t:
    t = t.replace(
        "{chatPayload && !chatSent && (",
        '''{chatPayload && chatPayload.body.trim() && !chatSent && (
''',
        1,
    )
    # Replace the first bold line in chat card - try common patterns
    for a, b in [
        ("Send Private Chat message — approval required",
         "Private Chat send — read the exact message below before you approve"),
        ("Private message — approval required",
         "Private Chat send — read the exact message below before you approve"),
    ]:
        if a in t:
            t = t.replace(a, b, 1)
            print("chat title", a)

ea.write_text(t)
print("EliteAssist size", ea.stat().st_size)

# Brief
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "PREVIEW-BEFORE-APPROVE" not in s:
    for a in ["APPROVAL LIFECYCLE", "Never invent approval buttons", "SAFE navigation is automatic"]:
        if a in s:
            s = s.replace(a, a + "\n\n" + BRIEF, 1)
            print("brief via", a)
            break
    af.write_text(s)
else:
    print("brief already")

print("done")
