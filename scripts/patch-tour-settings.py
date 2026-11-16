#!/usr/bin/env python3
"""Rename Show me around, add tips on/off in Settings, deepen Gmail Learn More."""
from pathlib import Path
import re

path = Path("src/routes/app.tsx")
text = path.read_text(encoding="utf-8")
original = text

# Import setTourEnabled, tourDismissed
if "setTourEnabled" not in text:
    text = text.replace(
        'import { EliteTips, ELITE_TIPS, resetTour } from "@/features/workspace/HandTour";',
        'import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed } from "@/features/workspace/HandTour";',
    )
    print("✓ import setTourEnabled")

# Rename menu row
if 'label="Show me around"' in text:
    text = text.replace('label="Show me around"', 'label="Guided Walkthrough"')
    text = text.replace(
        'sub="Replay the step-by-step Elite guide"',
        'sub="Replay the 12-step Elite Engine guide (list → message → validate → send)"',
    )
    print("✓ renamed Show me around")

# Tips toggle near Guided Walkthrough if missing
if "Workspace tips" not in text and "Guided Walkthrough" in text:
    tip_toggle = '''                      <MenuRow
                        icon={Compass}
                        label="Workspace tips"
                        sub={typeof window !== "undefined" && tourDismissed() ? "Off — tip cards stay hidden" : "On — contextual tips while you work"}
                        onClick={() => {
                          const next = tourDismissed();
                          setTourEnabled(next);
                          toast.info(next ? "Workspace tips turned on" : "Workspace tips turned off");
                        }}
                      />
'''
    # Insert before Guided Walkthrough row
    marker = 'label="Guided Walkthrough"'
    idx = text.find(marker)
    if idx > 0:
        # find start of this MenuRow
        start = text.rfind("<MenuRow", 0, idx)
        if start > 0:
            text = text[:start] + tip_toggle + text[start:]
            print("✓ Workspace tips toggle")

# Deep-link from Gmail Learn More footer to full Learn More page
if "gmailLearnMoreOpen" in text and "/learn-more#gmail-profiles" not in text:
    # Add link inside learn more body if we have the section
    old = "Before you disconnect a working profile"
    if old in text:
        extra = '''
              <section className="rounded-xl border border-line bg-soft px-3 py-2.5">
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Abuse & master-login bans</h4>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  Scams, bank impersonation, phishing, and fake campaigns are not a soft warning — the master login can be banned. Full policy and Gmail suspension ladder live on the public Learn More page.
                </p>
                <a
                  href="/learn-more#abuse-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[12.5px] font-semibold text-brand underline"
                >
                  Open full Learn More (abuse policy)
                </a>
                <a
                  href="/learn-more#gmail-profiles"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-[12.5px] font-semibold text-brand underline"
                >
                  Gmail multi-account & flag rules
                </a>
              </section>

              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Before you disconnect a working profile</h4>'''
        text = text.replace(
            '''              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Before you disconnect a working profile</h4>''',
            extra,
            1,
        )
        print("✓ Learn More deep links in Gmail modal")

if text == original:
    print("No changes")
else:
    path.write_text(text, encoding="utf-8")
    print(f"Saved app.tsx ({len(text)} bytes)")
