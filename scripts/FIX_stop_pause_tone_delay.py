#!/usr/bin/env python3
from pathlib import Path
import re

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()

# 1) Direct campaign control without missing approveActionFromCard
old_control = '''      const controlMatch = rawReply.match(/\\[\\[REX_CONTROL_CAMPAIGN:(pause|resume|stop)\\]\\]/i);
      if (controlMatch) {
        const action = controlMatch[1]!.toLowerCase() as "pause" | "resume" | "stop";
        const id = "action-" + crypto.randomUUID();
        actionApprovalIds.current.set(id, action);
        setBusy(false);
        await approveActionFromCard(id);
        return;
      }'''

# Flexible match in case whitespace differs
m = re.search(
    r"const controlMatch = rawReply\.match\(/\\\[\\\[REX_CONTROL_CAMPAIGN:\(pause\|resume\|stop\)\\\]\\\]/i\);\s*"
    r"if \(controlMatch\) \{[\s\S]*?return;\s*\}",
    t,
)
new_control = '''      const controlMatch = rawReply.match(/\\[\\[REX_CONTROL_CAMPAIGN:(pause|resume|stop)\\]\\]/i);
      if (controlMatch) {
        const action = controlMatch[1]!.toLowerCase() as "pause" | "resume" | "stop";
        let ok = false;
        let note = "";
        if (action === "pause") {
          ok = Boolean(onPauseCurrentCampaign && onPauseCurrentCampaign());
          note = ok ? "Campaign paused." : "Could not pause (no active send, or pause is locked by Rex Monitor in Studio).";
        } else if (action === "stop") {
          ok = Boolean(onStopCurrentCampaign && onStopCurrentCampaign());
          note = ok ? "Campaign stopped." : "Could not stop (no active campaign, or stop is locked by Rex Monitor in Studio).";
        } else {
          // resume = start again
          if (onExecuteCurrentCampaign) {
            ok = await onExecuteCurrentCampaign();
          }
          note = ok ? "Campaign resumed." : "Could not resume. Check Elite Engine readiness.";
        }
        const reply = note;
        setLastSource("local");
        setSuggests([]);
        setMsgs([...next, { role: "assistant", content: reply }]);
        await persistMessage("assistant", reply);
        return;
      }'''

if m:
    t = t[: m.start()] + new_control + t[m.end() :]
    print("controlMatch path fixed")
elif "approveActionFromCard" in t:
    t = t.replace("await approveActionFromCard(id);", """{
          let ok = false;
          let note = "";
          if (action === "pause") { ok = Boolean(onPauseCurrentCampaign && onPauseCurrentCampaign()); note = ok ? "Campaign paused." : "Could not pause."; }
          else if (action === "stop") { ok = Boolean(onStopCurrentCampaign && onStopCurrentCampaign()); note = ok ? "Campaign stopped." : "Could not stop."; }
          else { ok = onExecuteCurrentCampaign ? await onExecuteCurrentCampaign() : false; note = ok ? "Campaign resumed." : "Could not resume."; }
          setLastSource("local"); setSuggests([]);
          setMsgs([...next, { role: "assistant", content: note }]);
          await persistMessage("assistant", note);
        }""")
    print("approveActionFromCard inlined")
else:
    print("WARN controlMatch not found")

# 2) Early intercept: stop/pause/resume by plain language — no AI, no card
if "HARD RULE: pause/stop" not in t:
    intercept = '''
      // HARD RULE: pause/stop/resume — immediate, no approval card
      {
        const cmd = content.trim().toLowerCase();
        const wantsStop = /^(please\\s+)?(stop|halt|cancel)(\\s+(it|the\\s+campaign|sending|campaign))?\\s*[.!]?$/.test(cmd)
          || /\\b(stop|halt)\\s+(the\\s+)?(campaign|sending|execution)\\b/.test(cmd);
        const wantsPause = /^(please\\s+)?(pause|hold)(\\s+(it|the\\s+campaign|sending))?\\s*[.!]?$/.test(cmd)
          || /\\bpause\\s+(the\\s+)?(campaign|sending|execution)\\b/.test(cmd);
        const wantsResume = /^(please\\s+)?(resume|continue|unpause)(\\s+(it|the\\s+campaign|sending))?\\s*[.!]?$/.test(cmd)
          || /\\b(resume|continue)\\s+(the\\s+)?(campaign|sending)\\b/.test(cmd);
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
            note = ok ? "Campaign resumed." : "Could not resume. Check Elite Engine.";
          }
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: note }]);
          await persistMessage("assistant", note);
          return;
        }
      }
'''
    # insert after HARD RULE OK send block if present, else after setBusy try
    if 'HARD RULE: "OK send"' in t or "HARD RULE: \"OK send\"" in t:
        # after the whole isClearSendCommand block is hard - insert at start of try after setBusy
        needle = "setBusy(true);\n    setSuggests([]);\n    try {"
        if needle in t and "HARD RULE: pause/stop" not in t:
            t = t.replace(needle, "setBusy(true);\n    setSuggests([]);\n    try {" + intercept, 1)
            print("pause/stop intercept added")
    else:
        needle = "setBusy(true);\n    setSuggests([]);\n    try {"
        if needle in t:
            t = t.replace(needle, "setBusy(true);\n    setSuggests([]);\n    try {" + intercept, 1)
            print("pause/stop intercept added alt")

# 3) Delay commands early: "set delay to 5" / "delay 3 seconds"
if "HARD RULE: delay" not in t:
    delay_i = '''
      // HARD RULE: delay — set send interval (3–8 seconds) without approval
      {
        const dm = content.trim().match(/\\b(?:set\\s+)?(?:delay|interval|gap)\\s*(?:to\\s*|[=:]\\s*)?(\\d)\\s*(?:s|sec|secs|seconds)?\\b/i)
          || content.trim().match(/\\b(\\d)\\s*(?:s|sec|secs|seconds)\\s+(?:delay|interval|gap)\\b/i);
        if (dm && onUpdateWorkspaceSetting) {
          const sec = Number(dm[1]);
          if (sec >= 3 && sec <= 8) {
            const ok = onUpdateWorkspaceSetting("campaign.delay", String(sec));
            const note = ok
              ? ("Send delay set to " + sec + " seconds between emails.")
              : ("Could not set delay to " + sec + "s. Use 3–8 only.");
            setLastSource("local");
            setSuggests([]);
            setMsgs([...next, { role: "assistant", content: note }]);
            await persistMessage("assistant", note);
            return;
          }
        }
      }
'''
    if "HARD RULE: pause/stop" in t:
        t = t.replace("// HARD RULE: pause/stop", delay_i + "\n      // HARD RULE: pause/stop", 1)
        print("delay intercept added")
    elif "setBusy(true);\n    setSuggests([]);\n    try {" in t:
        t = t.replace("setBusy(true);\n    setSuggests([]);\n    try {", "setBusy(true);\n    setSuggests([]);\n    try {" + delay_i, 1)
        print("delay intercept alt")

ea.write_text(t)
print("assist", ea.stat().st_size)

# 4) app.tsx — campaign.delay via onUpdateWorkspaceSetting
app = Path("src/routes/app.tsx")
a = app.read_text()
if 'settingKey === "campaign.delay"' not in a:
    # inject at start of onUpdateWorkspaceSetting callback body
    needle = 'onUpdateWorkspaceSetting={(settingKey, settingValue) => {\n            const booleanKeys = new Set(['
    insert = '''onUpdateWorkspaceSetting={(settingKey, settingValue) => {
            if (settingKey === "campaign.delay") {
              const sec = Number(settingValue);
              if (![3, 4, 5, 6, 7, 8].includes(sec)) return false;
              setDelay(sec);
              try { delayRef.current = sec; } catch {}
              return true;
            }
            const booleanKeys = new Set(['''
    if needle in a:
        a = a.replace(needle, insert, 1)
        print("campaign.delay wired")
    else:
        print("WARN onUpdateWorkspaceSetting needle")
app.write_text(a)

# 5) SYSTEM_BRIEF — personality + campaign copy serious
af = Path("src/lib/assist.functions.ts")
s = af.read_text()
if "CAMPAIGN COPY IS SERIOUS" not in s:
    note = '''
CAMPAIGN COPY IS SERIOUS
- When drafting subject/body for email campaigns, write professional serious copy. Do NOT add emojis unless the owner explicitly asks for them.
- Chat personality (balanced / professional / friendly / direct) applies to how you talk TO the owner in Rex chat — not to outbound campaign emails unless they request a style.
- friendly chat: warm, light emojis OK in chat only.
- direct chat: short answers, no fluff.
- professional chat: polished, minimal emojis.
- balanced chat: clear and natural.
PAUSE STOP RESUME
- pause / stop / resume the current campaign immediately when asked. No approval card. No approveActionFromCard.
- Emit [[REX_CONTROL_CAMPAIGN:pause]] or stop or resume only as a machine marker; the app executes directly.
DELAY
- Owner may set send delay 3–8 seconds ("set delay to 5"). Confirm after change.
'''
    if "WORKSPACE AUTHORITY" in s:
        s = s.replace("WORKSPACE AUTHORITY", note + "\nWORKSPACE AUTHORITY", 1)
    else:
        s = s.replace("OWNER'S CONTROL", note + "\nOWNER'S CONTROL", 1)
    af.write_text(s)
    print("brief")
print("done")
