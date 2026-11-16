#!/usr/bin/env python3
"""Make Permanent Send Protection messaging unmistakable for users."""
from pathlib import Path

path = Path("src/routes/app.tsx")
text = path.read_text(encoding="utf-8")
original = text

replacements = [
    (
        'log(`Skipped ${next.email} — this exact message was already sent.`);',
        'log(`Skipped ${next.email} — same message already delivered to this address. It cannot send again unless you change the subject or body.`);',
    ),
    (
        'toast.info(`${done} already sent — continuing from #${firstPending}.`);',
        'toast.info(`${done} already got this exact message — skipping them. Continuing from #${firstPending}. Change subject/body to message them again.`);',
    ),
]

for a, b in replacements:
    if a in text:
        text = text.replace(a, b)
        print("✓", b[:60], "...")
    else:
        print("· miss", a[:50])

# Protection label block — broaden match
old_bits = [
    (
        'Permanent Send Protection',
        None,  # handled in block replace
    )
]

# Common description patterns
subs = [
    (
        "Shields your campaigns from accidental duplicate sends to the same recipient across all Gmail rotations.",
        "Always on. The exact same subject + body cannot go to the same person twice on Elite Engine — no matter which Gmail you use. To reach them again, change the message (subject or body). Reset only clears the screen; it does not unlock the same letter.",
    ),
    (
        "Blocks duplicate sends to the same recipient with the same message permanently across Gmail rotations.",
        "Always on. The exact same subject + body cannot go to the same person twice on Elite Engine — no matter which Gmail you use. To reach them again, change the message (subject or body). Reset only clears the screen; it does not unlock the same letter.",
    ),
]
for a, b in subs:
    if a in text:
        text = text.replace(a, b)
        print("✓ protection description")

# Empty-range / all already sent toasts
for a, b in [
    (
        "All ${sentCount} in this list were already sent. Tap Reset to start a new campaign.",
        "All ${sentCount} already received this exact message. It will not send again. Change the subject or body for a new message, or use a different list. Reset only clears the workspace screen.",
    ),
    (
        "`${sentCount} already sent. Tap Validate — sending continues from the next ${left} unsent.`",
        "`${sentCount} already got this exact message (skipped on purpose). Validate / Execute continues with the next ${left} unsent. Change subject or body to message the others again.`",
    ),
]:
    if a in text:
        text = text.replace(a, b)
        print("✓ all-sent / partial toast")

# End-of-run style if present
if "Cannot send: All recipients" in text:
    text = text.replace(
        "Cannot send: All recipients in this range were already sent! Permanent Send Protection locked these addresses to prevent duplicate sends.",
        "Cannot send: everyone in this range already got this exact message. Same letter cannot go out again. Change subject or body, or pick a different range/list.",
    )
    print("✓ cannot-send banner")

if text == original:
    print("No changes — checking alternate strings...")
    # soft search
    for s in ["already sent", "Permanent Send", "duplicate"]:
        print(s, text.count(s))
else:
    path.write_text(text, encoding="utf-8")
    print(f"Saved app.tsx ({len(text)} bytes)")
