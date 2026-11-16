#!/usr/bin/env python3
from pathlib import Path
import re

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# 1) Kill the dead-end that points users at old/expired Approve buttons
old = '''    if (!existingApproval) return null;
    if (/\\b(approve|authorize|authorise|go ahead|send|execute|start)\\b/i.test(question)) {
      return "The exact campaign preview and recipient scope are displayed above. Use the approval button on that preview to send it. If you want to change the message or recipients, tell me what to change and I will prepare a new preview.";
    }
    return null;'''

new = '''    // Never point the owner at an old/expired preview button.
    // If there is no live typed-approve path, return null so prepare + new Approve runs.
    return null;'''

if old in t:
    t = t.replace(old, new, 1)
    print("removed expired-approval pointer")
elif "Use the approval button on that preview" in t:
    t = t.replace(
        '''if (/\\b(approve|authorize|authorise|go ahead|send|execute|start)\\b/i.test(question)) {
      return "The exact campaign preview and recipient scope are displayed above. Use the approval button on that preview to send it. If you want to change the message or recipients, tell me what to change and I will prepare a new preview.";
    }''',
        "// expired / non-live preview: fall through to prepare a new Approve control",
        1,
    )
    print("removed pointer alt")
else:
    print("pointer text already gone")

# 2) Expand isClearSendCommand for "send campaign" / "continue campaign"
old_fn_end = "    if (/\\b(?:send|execute)\\s+(?:to\\s+)?(?:everyone|all|the\\s+list)\\b/i.test(q)) return true;\n    return false;"
new_fn_end = """    if (/\\b(?:send|execute)\\s+(?:to\\s+)?(?:everyone|all|the\\s+list)\\b/i.test(q)) return true;
    if (/\\b(?:send|execute|start|launch|continue)\\s+(?:the\\s+)?campaign\\b/i.test(q)) return true;
    if (/^(?:continue|resume)(?:\\s+campaign)?\\s*[.!]?$/i.test(q)) return true;
    return false;"""
if old_fn_end in t:
    t = t.replace(old_fn_end, new_fn_end, 1)
    print("isClearSend expanded")
else:
    print("WARN isClearSend end not found")

# 3) Only treat existingApproval as live if marker is still APPROVE_CAMPAIGN (not expired done)
# Harden finders that only check includes APPROVE_CAMPAIGN
t2, n = re.subn(
    r'message\.content\.includes\("\[\[APPROVE_CAMPAIGN:"\)',
    '(/\\[\\[APPROVE_CAMPAIGN:[^\\]]+\\]\\]/.test(message.content) && !/EXPIRED|DONE|APPROVED/.test(message.content))',
    t,
)
if n:
    t = t2
    print("live approval guard x", n)

# 4) Early pause/stop/continue if missing
if "HARD RULE: pause/stop" not in t and "wantsStop" not in t:
    intercept = '''
      // HARD RULE: pause/stop/continue — immediate, no approval card
      {
        const cmd = content.trim().toLowerCase();
        const wantsStop = /^(please\\s+)?(stop|halt|cancel)(\\s+(it|the\\s+campaign|sending|campaign))?\\s*[.!]?$/.test(cmd)
          || /\\b(stop|halt)\\s+(the\\s+)?(campaign|sending|execution)\\b/.test(cmd);
        const wantsPause = /^(please\\s+)?(pause|hold)(\\s+(it|the\\s+campaign|sending))?\\s*[.!]?$/.test(cmd)
          || /\\bpause\\s+(the\\s+)?(campaign|sending|execution)\\b/.test(cmd);
        const wantsResume = /^(please\\s+)?(resume|continue|unpause)(\\s+(it|the\\s+campaign|sending|campaign))?\\s*[.!]?$/.test(cmd)
          || /\\b(resume|continue)\\s+(the\\s+)?(campaign|sending|execution)\\b/.test(cmd);
        if (wantsStop || wantsPause || wantsResume) {
          let note = "";
          let ok = false;
          if (wantsStop) {
            ok = Boolean(onStopCurrentCampaign && onStopCurrentCampaign());
            note = ok ? "Campaign stopped." : "Nothing to stop right now (or stop is locked in Rex Studio Monitor).";
          } else if (wantsPause) {
            ok = Boolean(onPauseCurrentCampaign && onPauseCurrentCampaign());
            note = ok ? "Campaign paused." : "Nothing to pause right now (or pause is locked in Rex Studio Monitor).";
          } else {
            ok = onExecuteCurrentCampaign ? await onExecuteCurrentCampaign() : false;
            note = ok ? "Campaign continued." : "Could not continue. Check Elite Engine or say OK send for a fresh Approve.";
          }
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: note }]);
          await persistMessage("assistant", note);
          return;
        }
      }
'''
    needle = 'HARD RULE: "OK send"'
    if needle in t:
        t = t.replace(needle, intercept + "\n      " + needle, 1)
        print("pause/stop intercept added")
    else:
        print("WARN no HARD RULE OK send anchor")

ea.write_text(t)
print("size", ea.stat().st_size)

# Brief tighten
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "NEVER POINT TO EXPIRED APPROVAL" not in s:
    s = s.replace(
        "OK SEND MEANS SEND",
        "NEVER POINT TO EXPIRED APPROVAL\n"
        "- Never tell the owner to scroll up and press an old Approve button. If approval is missing or expired, prepare a NEW preview with a NEW approval control.\n"
        "- continue campaign / resume = resume engine if paused; otherwise prepare a fresh Approve.\n\n"
        "OK SEND MEANS SEND",
        1,
    )
    af.write_text(s)
    print("brief")
print("done")
