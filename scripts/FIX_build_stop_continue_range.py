#!/usr/bin/env python3
from pathlib import Path
import re

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# --- Fix broken else-without-block after validation soft-replace ---
# Pattern: } else\n              const validation
bad = re.compile(
    r"if \(!onValidateRecipients\) \{ /\*[^*]*\*/ \} else\s*\n(\s*)const validation = await onValidateRecipients\(\);"
)
def fix_else(m):
    indent = m.group(1)
    return (
        "if (onValidateRecipients) {\n"
        + indent
        + "const validation = await onValidateRecipients();"
    )
t2, n = bad.subn(fix_else, t)
if n:
    t = t2
    print("fixed else-const x", n)

# Also: } else if (false)\n const or similar broken
t = re.sub(
    r"\} else if \(false\)\s*\n(\s*)(importValidationSummary|const )",
    r"}\n\1\2",
    t,
)

# Generic: else\n              const validation
t2, n = re.subn(
    r"\belse\s*\n(\s*)const validation = await onValidateRecipients\(\);",
    r"if (onValidateRecipients) {\n\1const validation = await onValidateRecipients();",
    t,
)
if n:
    t = t2
    print("fixed bare else-const x", n)
    # may need closing braces - fragile; check balance later

# --- Implement missing approveActionFromCard ---
if "async function approveActionFromCard" not in t and "function approveActionFromCard" not in t:
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
        ? { ...m, content: m.content.replace(/\[\[REX_APPROVAL:[^\]]+\]\]/g, "[[REX_APPROVED:" + id + ":" + action + "]]") }
        : m
    ).concat([{ role: "assistant", content: note }]));
    await persistMessage("assistant", note);
    if (ok) toast.success(note); else toast.error(note);
  }
'''
    # insert before approveCampaignFromCard if exists
    if "async function approveCampaignFromCard" in t:
        t = t.replace("async function approveCampaignFromCard", impl + "\n  async function approveCampaignFromCard", 1)
        print("approveActionFromCard defined")
    else:
        t = t.replace("async function approveHotspotInvite", impl + "\n  async function approveHotspotInvite", 1)
        print("approveActionFromCard near hotspot")

# --- Expand pause/stop/resume intercept for "continue campaign" ---
old_resume = r"const wantsResume = /\^\(please\\s\+\)\?\(resume\|continue\|unpause\)"
# broaden by replacing the wantsResume block
if "continue campaign" not in t.lower() or True:
    # Replace wantsResume regex lines if present
    t = re.sub(
        r"const wantsResume = [^;]+;",
        r'''const wantsResume = /^(please\s+)?(resume|continue|unpause)(\s+(it|the\s+campaign|sending|campaign))?\s*[.!]?$/i.test(cmd)
          || /\b(resume|continue)\s+(the\s+)?(campaign|sending|execution)\b/i.test(cmd)
          || /^(continue|resume)\s+campaign\s*[.!]?$/i.test(cmd);''',
        t,
        count=1,
    )
    print("wantsResume expanded")

# --- Send campaign: always run prepare pipeline (same as OK send), never point to expired button ---
# Expand isClearSendCommand
if "send campaign" not in t.split("isClearSendCommand")[1][:800] if "isClearSendCommand" in t else True:
    t = t.replace(
        "if (/\\b(?:send|execute)\\s+(?:to\\s+)?(?:everyone|all|the\\s+list)\\b/i.test(q)) return true;",
        "if (/\\b(?:send|execute)\\s+(?:to\\s+)?(?:everyone|all|the\\s+list)\\b/i.test(q)) return true;\n"
        "    if (/\\b(?:send|execute|start|launch|continue)\\s+(?:the\\s+)?campaign\\b/i.test(q)) return true;\n"
        "    if (/^(continue|resume)(\\s+campaign)?\\s*[.!]?$/i.test(q) && /campaign|send|execute/.test(q)) return true;",
        1,
    )
    print("isClearSend expanded")

# When existing approval is expired, don't tell user to use it — create new one (already in HARD RULE OK send if no match)
# Harden existingApproval: only use if marker is APPROVE not EXPIRED
t = t.replace(
    "message.role === \"assistant\" && message.content.includes(\"[[APPROVE_CAMPAIGN:\")",
    "message.role === \"assistant\" && message.content.includes(\"[[APPROVE_CAMPAIGN:\") && !message.content.includes(\"[[APPROVE_CAMPAIGN_EXPIRED\")",
)
# better: check live marker only
t = re.sub(
    r"message\.content\.includes\(\"\[\[APPROVE_CAMPAIGN:\"\)",
    'message.content.includes("[[APPROVE_CAMPAIGN:") && !/\[\[APPROVE_CAMPAIGN_EXPIRED|EXPIRED\]\]/.test(message.content)',
    t,
)
print("approval expired guard")

ea.write_text(t)

# --- Range control via onUpdateWorkspaceSetting ---
app = Path("src/routes/app.tsx")
a = app.read_text()
if 'settingKey === "campaign.range"' not in a:
    needle = 'if (settingKey === "campaign.delay")'
    if needle in a:
        block = '''if (settingKey === "campaign.range") {
              // value "from-to" e.g. "1-10" or "1,10"
              const parts = String(settingValue).split(/[-,\\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 1);
              if (parts.length < 2) return false;
              const a = Math.min(parts[0]!, parts[1]!);
              const b = Math.max(parts[0]!, parts[1]!);
              setFrom(a);
              setTo(b);
              return true;
            }
            if (settingKey === "campaign.delay")'''
        a = a.replace(needle, block, 1)
        print("range wired")
    else:
        # add near campaign.delay insert point
        print("WARN no campaign.delay to extend")
app.write_text(a)

# EliteAssist intercept for range: "send only 1 to 10" / "range 1-5"
ea_t = ea.read_text()
if "HARD RULE: range" not in ea_t:
    range_i = '''
      // HARD RULE: range — set recipient from-to without approval
      {
        const rm = content.trim().match(/\\b(?:range|from)\\s*[:=]?\\s*(\\d+)\\s*(?:-|to|–|—)\s*(\\d+)\\b/i)
          || content.trim().match(/\\b(?:send|use|limit)\\s+(?:only\\s+)?(\\d+)\\s*(?:-|to)\s*(\\d+)\\b/i);
        if (rm && onUpdateWorkspaceSetting) {
          const ok = onUpdateWorkspaceSetting("campaign.range", rm[1] + "-" + rm[2]);
          const note = ok
            ? ("Recipient range set to " + rm[1] + "–" + rm[2] + ".")
            : "Could not set range. Use numbers like range 1-10.";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: note }]);
          await persistMessage("assistant", note);
          return;
        }
      }
'''
    if "HARD RULE: pause/stop" in ea_t:
        ea_t = ea_t.replace("// HARD RULE: pause/stop", range_i + "\n      // HARD RULE: pause/stop", 1)
        print("range intercept")
    ea.write_text(ea_t)

# Brief: never point to expired approval; continue = resume engine or new approve
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "NEVER POINT TO EXPIRED APPROVAL" not in s:
    s = s.replace(
        "PAUSE STOP RESUME",
        "NEVER POINT TO EXPIRED APPROVAL\n"
        "- If the owner says send / send campaign / continue and a previous Approve button expired or was used, prepare a NEW preview with a NEW [[APPROVE_CAMPAIGN:...]] marker. Never tell them to scroll up and press an old button.\n"
        "- continue campaign / resume = resume engine if paused; if nothing running, prepare fresh Approve.\n"
        "PAUSE STOP RESUME",
        1,
    )
    af.write_text(s)
    print("brief")

print("assist size", ea.stat().st_size)
print("done")
