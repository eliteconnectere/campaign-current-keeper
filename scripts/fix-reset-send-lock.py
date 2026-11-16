#!/usr/bin/env python3
"""Reset must clear client send locks so a new campaign can run."""
from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

old_reset = """function resetWorkspace() {
    setRecipients([]);
    setRaw("");
    setValidated(false);
    setEditing(true);
    setGenerated([]);
    setScout(false);
    setEngine("idle");
      setNextInSec(null);
    setCleanupHandled(false);
  }"""

new_reset = """function resetWorkspace() {
    setRecipients([]);
    setRaw("");
    setValidated(false);
    setEditing(true);
    setGenerated([]);
    setScout(false);
    setEngine("idle");
    setNextInSec(null);
    setCleanupHandled(false);
    // Clear client-side send locks so a new campaign (new body/subject) can run.
    // Server Permanent Send Protection still blocks the EXACT same message only.
    sentRecipientEmailsRef.current = new Set();
    setSentRecipientEmails([]);
  }"""

if old_reset in t:
    t = t.replace(old_reset, new_reset, 1)
    print("OK resetWorkspace")
else:
    print("WARN resetWorkspace pattern not found")

# Pause/stop log was misleading
old_stop = """                    onClick={() => {
                      setEngine("idle");
                      setScout(false);
                      // Sent recipients stay locked so a reset can never re-send them.
                      log("Campaign stopped — sent recipients stay locked and will not be sent again");
                    }}"""

new_stop = """                    onClick={() => {
                      setEngine("idle");
                      setScout(false);
                      log("Campaign paused. Tap Reset before a full new run, or Execute to continue remaining unsent rows.");
                    }}"""

if old_stop in t:
    t = t.replace(old_stop, new_stop, 1)
    print("OK pause log")
else:
    # softer
    if "sent recipients stay locked and will not be sent again" in t:
        t = t.replace(
            "Campaign stopped — sent recipients stay locked and will not be sent again",
            "Campaign paused. Use Reset to clear locks, then Execute for a new run",
        )
        print("OK soft pause string")
    else:
        print("WARN pause log not found")

# startCampaign: do NOT block forever via lifetime sentRecipientEmails set.
# Only block rows marked sent in the CURRENT generated list (this run).
old_done = """    const doneEmails = new Set(
      generatedRef.current.filter((g) => g.sent).map((g) => g.email.trim().toLowerCase())
    );
    for (const e of sentRecipientEmailsRef.current) doneEmails.add(e);
    const inRange = generated.filter((g) => g.id >= from && g.id <= to);
    if (inRange.length === 0) {
      toast.error("No recipients found in selected range.");
      return;
    }
    const unsentInRange = inRange.filter((g) => !doneEmails.has(g.email.trim().toLowerCase()));
    if (unsentInRange.length === 0) {
      toast.info("Cannot send: this range already finished. Tap Reset, or change subject/body, then Execute again.");
      showErrorGuide({
        title: "This range already finished",
        body: "Elite blocked a second run of the same finished list so you do not spam the same people by accident.",
        steps: [
          "Tap Reset (next to Execute) to clear Sent marks for this run.",
          "Or change the subject / message body if this is a new outreach.",
          "Or change From–To to addresses not yet marked Sent.",
          "Then tap Execute Campaign again.",
        ],
      });
      return;
    }"""

new_done = """    // Only the current generated list "sent" flags block a continue.
    // Lifetime history is for stats — Reset clears it. Server still dedupes exact same message.
    const doneEmails = new Set(
      generatedRef.current.filter((g) => g.sent).map((g) => g.email.trim().toLowerCase())
    );
    const inRange = generated.filter((g) => g.id >= from && g.id <= to);
    if (inRange.length === 0) {
      toast.error("No recipients found in selected range.");
      return;
    }
    const unsentInRange = inRange.filter((g) => !doneEmails.has(g.email.trim().toLowerCase()));
    if (unsentInRange.length === 0) {
      toast.info("This run already finished every row in the range. Tap Reset, rebuild the list, then Execute for a new campaign.");
      showErrorGuide({
        title: "This run is finished",
        body: "Every address in this range was already marked sent in the current list. Reset clears those marks so you can start a new campaign (new message is allowed; the server still blocks the exact same message only).",
        steps: [
          "Tap Reset (clears Sent marks and the old lock list).",
          "Paste or load your list again if the list was cleared.",
          "Update subject/body if this is a new outreach.",
          "Tap Execute Campaign.",
        ],
      });
      return;
    }"""

if old_done in t:
    t = t.replace(old_done, new_done, 1)
    print("OK startCampaign lock")
else:
    print("WARN startCampaign block not found exact")

p.write_text(t, encoding="utf-8")
print("written", p)
