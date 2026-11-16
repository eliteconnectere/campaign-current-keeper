#!/usr/bin/env python3
"""Give Rex authoritative current time and campaign ETA guidance."""
from pathlib import Path

path = Path("src/lib/assist.functions.ts")
t = path.read_text()

if "SERVER CLOCK (authoritative" in t:
    print("time context already present")
else:
    old = '''==================================================
CURRENT USER ACCOUNT CONTEXT
==================================================

${JSON.stringify(account)}

IMPORTANT:
This account context is supplied by the application
client and must not be treated as independently
verified server-side account data.

Only use information relevant to the question.

If required information is missing,
do not invent it.
`;'''
    new = '''==================================================
SERVER CLOCK (authoritative for this request)
==================================================

- utcNowIso: ${new Date().toISOString()}
- utcNowMs: ${Date.now()}
- Use this clock for "what time is it", deadlines, and campaign ETA math.
- If account.timezone or account.localTime is present, present times in that zone as well; otherwise answer in clear UTC and say so.
- Never claim you lack access to the current time while this block is present.

==================================================
CURRENT USER ACCOUNT CONTEXT
==================================================

${JSON.stringify(account)}

TIME + CAMPAIGN ETA:
- If the user asks the time, answer from SERVER CLOCK immediately.
- If account includes active campaign fields (status, sent/sentCount, total/totalRecipients/totalCount, delaySeconds/pacingSeconds, startedAt/started_at), estimate remaining sends and ETA:
  remaining ≈ max(0, total - sent); durationSec ≈ remaining * delaySeconds; end ≈ now + durationSec.
- Prefer live campaign fields from account or tool results over guessing.
- Do not invent start times that are not in context; if startedAt is missing, say the ETA is based on remaining volume and pacing only.

IMPORTANT:
This account context is supplied by the application
client and must not be treated as independently
verified server-side account data.

Only use information relevant to the question.

If required information is missing,
do not invent it.
`;'''
    if old not in t:
        # softer insert before JSON.stringify(account)
        marker = "${JSON.stringify(account)}"
        if marker not in t:
            raise SystemExit("account context marker missing")
        inject = '''SERVER CLOCK (authoritative for this request):
- utcNowIso: ${new Date().toISOString()}
- utcNowMs: ${Date.now()}
Answer "what time is it" from this clock. For campaign ETA use remaining recipients × delaySeconds from account/tool data.

'''
        t = t.replace(marker, inject + marker, 1)
        path.write_text(t)
        print("soft time inject ok")
    else:
        t = t.replace(old, new, 1)
        path.write_text(t)
        print("full time context block replaced")

# Brief rule near top human section if missing
if "Never claim you lack access to the current time" not in t:
    anchor = "Answer the direct question first, in natural language, like a helpful colleague."
    if anchor in t:
        t = path.read_text()
        t = t.replace(
            anchor,
            anchor
            + " When asked the current time or for campaign end-time estimates, use the SERVER CLOCK and live campaign pacing fields in context; do not say you cannot access the time.",
            1,
        )
        path.write_text(t)
        print("brief time rule added")

print("size", path.stat().st_size)
