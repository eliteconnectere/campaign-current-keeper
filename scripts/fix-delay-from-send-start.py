#!/usr/bin/env python3
"""
Bug: startedAt was set AFTER Gmail returned, so wait = full delay + network time.
With ~2s API latency, 3s delay felt like ~5s.

Fix: set startedAt at the START of each send attempt; waitThen still targets
startedAt + delay*1000 so gap between sends matches selected seconds.
"""
from pathlib import Path

path = Path("src/routes/app.tsx")
code = path.read_text(encoding="utf-8")
orig = code

# Mark start of send BEFORE await sendGmailMessage
old = """      sendLockRef.current = true;
      claimedRef.current.add(key);
"""

# Need more unique context - include what's unique near send
needle = """      sendLockRef.current = true;
      claimedRef.current.add(key);
"""

if "startedAt = performance.now();\n      claimedRef" in code or "PACE_FROM_SEND_START" in code:
    print("Already paced from send start or marker present")
else:
    # Insert startedAt reset right before send lock / claim so clock starts before network
    # Prefer right before await sendGmailMessage
    await_marker = "await sendGmailMessage({"
    if await_marker in code and code.count(await_marker) >= 1:
        # only the campaign loop one - find the one after claimedRef.current.add
        idx = code.find("claimedRef.current.add(key);")
        if idx > 0:
            # find await sendGmailMessage after this
            aidx = code.find(await_marker, idx)
            if aidx > 0:
                insert = "      // PACE_FROM_SEND_START: wall-clock interval begins here (not after Gmail returns)\n      startedAt = performance.now();\n      "
                code = code[:aidx] + insert + code[aidx:]
                print("Inserted startedAt before await sendGmailMessage")
            else:
                print("ERROR: await sendGmailMessage not after claim")
        else:
            print("ERROR: claimedRef add not found")
    else:
        print("ERROR: await sendGmailMessage not found")

# Remove post-success startedAt reset so we don't restart the clock after network
# Keep waitThen() but do not reset startedAt on success
old_success = """        startedAt = performance.now();
        waitThen();
        return;
      }

      if (result.reason === "already_sent") {
"""

new_success = """        // do not reset startedAt — interval is from send start (PACE_FROM_SEND_START)
        waitThen();
        return;
      }

      if (result.reason === "already_sent") {
"""

if old_success in code:
    code = code.replace(old_success, new_success, 1)
    print("Removed post-success startedAt reset")
else:
    # softer: only first success waitThen block
    import re
    code2, n = re.subn(
        r"(if \(result\.ok\) \{[\s\S]*?rotated[\s\S]*?)\n\s*startedAt = performance\.now\(\);\n\s*waitThen\(\);",
        r"\1\n        waitThen();",
        code,
        count=1,
    )
    if n:
        code = code2
        print("Removed startedAt before waitThen on success (regex)")
    else:
        print("NOTE: could not strip success startedAt — check manually")

# For already_sent skip, keep short pace from now is OK or use same waitThen without reset
# already_sent currently sets startedAt then waitThen - that waits full delay from skip moment which is fine

if code != orig:
    path.write_text(code, encoding="utf-8")
    print("Wrote app.tsx")
else:
    print("No change")

print("Done")
