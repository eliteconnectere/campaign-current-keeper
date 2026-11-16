#!/usr/bin/env python3
from pathlib import Path
import shutil
import re

src = Path("src/routes/rex.index.tsx")
dst = Path("src/routes/rex/index.tsx")
if src.exists():
    dst.parent.mkdir(parents=True, exist_ok=True)
    text = src.read_text()
    # TanStack route id for folder index
    text = text.replace('createFileRoute("/rex/")', 'createFileRoute("/rex/")')
    dst.write_text(text)
    src.unlink(missing_ok=True)
    print("wrote rex/index.tsx")
elif not dst.exists() and Path("src/routes/rex.index.tsx").exists():
    pass
else:
    print("rex page state", dst.exists(), src.exists())

idx = Path("src/routes/index.tsx")
if idx.exists():
    t = idx.read_text()
    t = t.replace(
        "rotates between up to 10 profiles",
        "rotates between connected Gmail profiles (plan limits apply; higher plans support up to 75 profiles)",
    )
    t = t.replace("up to 10 Gmail", "up to 75 Gmail")
    t = t.replace("up to 10 profiles", "up to 75 profiles (by plan)")
    t = t.replace('to="/learn-more" hash="rex-ai"', 'to="/rex"')
    idx.write_text(t)
    print("index ok")

for name in ("terms.tsx", "privacy.tsx"):
    p = Path("src/routes") / name
    if not p.exists():
        continue
    t = p.read_text()
    t2, n = re.subn(
        r"(Last updated|Last Updated|Effective date|Effective Date)\s*[:\-]\s*[^<\n]+",
        r"\1: 9 November 2026",
        t,
        count=5,
        flags=re.I,
    )
    if n == 0 and "9 November 2026" not in t2:
        t2 = t2.replace(
            "</h1>",
            "</h1>\n          <p className=\"mt-1 text-[12px] text-ink-soft\">Last updated: 9 November 2026</p>",
            1,
        )
        print(name, "date injected")
    else:
        print(name, "dates", n)
    t2 = t2.replace("up to 10 Gmail", "up to 75 Gmail (by plan)")
    t2 = t2.replace("up to 10 profiles", "up to 75 profiles (by plan)")
    t2 = t2.replace('to="/learn-more" hash="rex-ai"', 'to="/rex"')
    if "Agent Rex" not in t2:
        note = (
            "\n          <section className=\"mt-6 space-y-2\">\n"
            "            <h2 className=\"text-lg font-bold\">Agent Rex</h2>\n"
            "            <p className=\"text-[13px] leading-relaxed text-ink-soft\">"
            "Agent Rex is Elite Connectere's in-product workspace agent. It may navigate registered features, "
            "prepare campaign work, and perform actions you authorize with in-chat approval. "
            "It does not get general access to your Gmail inbox. Full can/cannot guide: "
            "<a href=\"/rex\" className=\"font-semibold text-brand underline\">eliteconnectere.site/rex</a>."
            "</p>\n          </section>\n"
        )
        if "</main>" in t2:
            t2 = t2.replace("</main>", note + "</main>", 1)
        else:
            t2 += note
    p.write_text(t2)

lm = Path("src/routes/learn-more.tsx")
if lm.exists():
    t = lm.read_text()
    t = t.replace("up to 10 Gmail", "up to 75 Gmail (by plan)")
    t = t.replace("up to 10 profiles", "up to 75 profiles (by plan)")
    t = t.replace('to="/learn-more" hash="rex-ai"', 'to="/rex"')
    if "full Agent Rex guide" not in t:
        if 'id="rex-ai"' in t:
            pos = t.find('id="rex-ai"')
            gt = t.find(">", pos)
            insert = (
                ">\n"
                '          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">'
                "Agent Rex is Elite Connectere's workspace agent: navigate the app, prepare campaigns, "
                "inspect drafts with approval, monitor the current campaign, and share hotspot access when you approve. "
                "It is not a generic chatbot. "
                '<a href="/rex" className="font-semibold text-brand underline">Read the full Agent Rex guide</a> '
                "(eliteconnectere.site/rex). Last updated 9 November 2026.</p"
            )
            t = t[:gt] + insert + t[gt + 1 :]
            print("learn-more blurb")
        else:
            t = t.replace(
                "Rex AI",
                "Agent Rex",
                2,
            )
            if "/rex" not in t:
                t = t.replace(
                    "</main>",
                    '<p className="mt-6 text-[13px]">Full Agent Rex guide: <a className="text-brand underline" href="/rex">/rex</a></p></main>',
                    1,
                )
    lm.write_text(t)
    print("learn-more ok")

dyk = Path("src/features/workspace/DidYouKnow.tsx")
if dyk.exists() and "rex-agent-nav" not in dyk.read_text():
    t = dyk.read_text()
    extra = """
  {
    id: "rex-agent-nav",
    title: "Did you know Agent Rex can do this for you?",
    body: "Ask Rex to take you to Settings, Erase Data, Snippets, Vault, Tracker, or Campaign Monitor. It opens the real screen — not a generic chat answer.",
    place: "settings",
  },
  {
    id: "rex-agent-inspect",
    title: "Did you know Agent Rex can do this for you?",
    body: "Ask what message you are sending right now. After you approve the inspect control, Rex can read your live subject and body safely.",
  },
  {
    id: "rex-agent-hotspot",
    title: "Did you know Agent Rex can do this for you?",
    body: "Share Hotspot access from chat: give the email (and Gmail seat limit if you want). Approve once and Rex invites them — or open Hotspot manually.",
    place: "hotspot",
  },
  {
    id: "rex-agent-monitor",
    title: "Did you know Agent Rex can do this for you?",
    body: "Turn on Campaign Monitor in Rex Studio for the current run only. Rex can keep it going across leave or logout until you turn Monitor off in Studio.",
    place: "rex-monitor",
  },
  {
    id: "rex-agent-guide",
    title: "Did you know Agent Rex can do this for you?",
    body: "Rex is an agent inside Elite Connectere, not a plain assistant. Full can / cannot list: eliteconnectere.site/rex",
  },
"""
    t = t.replace(
        "export const DID_YOU_KNOW_TIPS: DidYouKnowTip[] = [",
        "export const DID_YOU_KNOW_TIPS: DidYouKnowTip[] = [" + extra,
        1,
    )
    dyk.write_text(t)
    print("dyk ok")

sp = Path("src/routes/support.tsx")
if sp.exists():
    t = sp.read_text().replace('to="/learn-more" hash="rex-ai"', 'to="/rex"')
    sp.write_text(t)

print("done")
