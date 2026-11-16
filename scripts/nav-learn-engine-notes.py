from pathlib import Path

# ---- learn-more: connection sharing section ----
lm = Path("src/routes/learn-more.tsx")
if lm.exists():
    t = lm.read_text()
    if "connection-sharing" not in t:
        section = '''  {
    id: "connection-sharing",
    badge: "Connection sharing",
    title: "Share workspace access (hotspot-style)",
    summary: "Let up to two assistants use the plan under your control — not a free-for-all group.",
    content: [
      "Connection sharing works like a controlled hotspot: you paid for the plan, so only you decide who may assist. Each person signs in with their own login and connects only their own Gmails.",
      "Connection sharing is exclusively available on the top-tier Elite Studio ProMaxx plan, with a strict maximum limit of 2 connected users.",
      "When you add someone, you set how many Gmails they may connect and whether they can use your snippets. You can change limits or remove them anytime. Assistants cannot add more people.",
      "This is assistance, not a project room. Quota and reputation rules on Elite Engine still apply to every send.",
    ],
  },
'''
        # insert before best-practices in IN_APP_FEATURES
        anchor = '  {\n    id: "best-practices",'
        if anchor in t:
            t = t.replace(anchor, section + anchor, 1)
            print("learn-more section")
        else:
            print("WARN learn-more anchor")
        t = t.replace(
            'href="mailto:eliteconnectere@gmail.com"',
            'href="/support"',
            1,
        )
        t = t.replace(
            ">eliteconnectere@gmail.com</a>",
            ">Support</a>",
            1,
        )
        lm.write_text(t)
    else:
        print("learn-more already has sharing")

# ---- index footer organized links ----
idx = Path("src/routes/index.tsx")
if idx.exists():
    t = idx.read_text()
    if "Public & info" not in t and "Public & info" not in t:
        old = '''        <p className="mt-2 flex items-center justify-center gap-3 text-[11.5px] font-medium text-ink">
          <Link to="/privacy">Privacy Policy</Link>
          <span className="text-ink-soft">·</span>
          <Link to="/terms">Terms of Service</Link>
        </p>'''
        new = '''        <div className="mt-3 grid gap-3 text-left text-[11.5px] sm:grid-cols-3">
          <div>
            <p className="font-bold uppercase tracking-wider text-ink-soft">Public & info</p>
            <p className="mt-1 space-x-2 font-medium text-ink">
              <Link to="/">Home</Link>
              <Link to="/learn-more">Learn more</Link>
              <Link to="/support">Support</Link>
            </p>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wider text-ink-soft">App & auth</p>
            <p className="mt-1 space-x-2 font-medium text-ink">
              <Link to="/app">Workspace</Link>
              <Link to="/auth">Sign in</Link>
              <Link to="/reset-password">Password reset</Link>
            </p>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wider text-ink-soft">Legal & compliance</p>
            <p className="mt-1 space-x-2 font-medium text-ink">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/unsubscribe">Unsubscribe</Link>
            </p>
          </div>
        </div>'''
        if old in t:
            t = t.replace(old, new, 1)
            idx.write_text(t)
            print("index footer")
        else:
            print("WARN index footer")

# ---- privacy / terms point contact to /support ----
for path in ["src/routes/privacy.tsx", "src/routes/terms.tsx"]:
    p = Path(path)
    if not p.exists():
        continue
    c = p.read_text()
    c2 = c.replace("mailto:eliteconnectere@gmail.com", "/support")
    # Prefer Link if already imported — soft string replace is ok for href
    if c2 != c:
        p.write_text(c2)
        print("updated", path)
    else:
        print("no mailto in", path)

# ---- app: dispatch ec:gmail-connected after successful connect ----
app = Path("src/routes/app.tsx")
if app.exists():
    a = app.read_text()
    if "ec:gmail-connected" not in a:
        # common pattern after list profiles refresh
        for needle in [
            'toast.success("Gmail connected")',
            'toast.success("Gmail account connected")',
            'toast.success("Connected")',
        ]:
            if needle in a:
                a = a.replace(
                    needle,
                    needle + '; try { window.dispatchEvent(new Event("ec:gmail-connected")); } catch {}',
                    1,
                )
                print("wired gmail event via", needle)
                break
        else:
            # after connectGmailAccount success branches
            if "await connectGmailAccount" in a or "connectGmailAccount(" in a:
                print("connect present but no toast anchor — skip")
        app.write_text(a)
    else:
        print("app already has event")

print("done")
