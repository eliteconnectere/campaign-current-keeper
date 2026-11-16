#!/usr/bin/env python3
"""
1) Logged-in users visiting / go to /app (homepage only for logged-out / after logout).
2) Privacy / learn-more / terms Back -> /app.
3) Settings: hide Chat, Night Mode, Interface Customization, Studio-only rows unless plan allows.
"""
import re
from pathlib import Path

# ---------- 1. index.tsx redirect if session ----------
idx = Path("src/routes/index.tsx")
if idx.exists():
    t = idx.read_text(encoding="utf-8")
    if "getSession" not in t and "navigate({ to: \"/app\" })" not in t:
        # Add client redirect component wrapper
        old_imp = 'import { createFileRoute, Link } from "@tanstack/react-router";'
        new_imp = '''import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";'''
        if old_imp in t:
            t = t.replace(old_imp, new_imp, 1)
        # Wrap Landing export
        if "function Landing()" in t and "SessionGate" not in t:
            t = t.replace(
                "component: GOOGLE_REVIEW_MODE ? ReviewLanding : Landing,",
                "component: GOOGLE_REVIEW_MODE ? ReviewLanding : HomeEntry,",
                1,
            )
            gate = '''
/** Logged-in users skip marketing homepage and open the workspace. */
function HomeEntry() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setAuthed(true);
        void navigate({ to: "/app" });
      } else {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (authed || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-ink-soft">
        Opening workspace…
      </div>
    );
  }
  return <Landing />;
}

'''
            t = t.replace("function Landing()", gate + "function Landing()", 1)
            idx.write_text(t, encoding="utf-8")
            print("index: HomeEntry session redirect added")
        else:
            print("index: Landing/gate skip")
    else:
        print("index: already has session logic or similar")

# ---------- 2. Back links ----------
for path in ["src/routes/privacy.tsx", "src/routes/terms.tsx", "src/routes/learn-more.tsx"]:
    p = Path(path)
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    o = t
    t = t.replace(
        'to="/" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
        'to="/app" className="text-[12.5px] font-semibold text-brand">\n            Back to app',
    )
    t = t.replace(
        'to="/" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to Elite Connectere',
        'to="/app" className="text-sm font-semibold text-brand hover:underline">\n            ← Back to workspace',
    )
    t = t.replace('to="/">Back to app', 'to="/app">Back to app')
    if t != o:
        p.write_text(t, encoding="utf-8")
        print("back link fixed", path)
    else:
        print("back link no change", path)

# ---------- 3. Plan-gate settings rows in app.tsx ----------
app = Path("src/routes/app.tsx")
if app.exists():
    t = app.read_text(encoding="utf-8")
    o = t

    # Helpers near entitlements if missing
    if "const showChatSettings" not in t and "chatEligible" in t:
        # Insert after chatEligible definition
        m = re.search(r"const chatEligible = [^;]+;", t)
        if m:
            insert = m.group(0) + "\n  const showChatSettings = chatEligible;\n  const showStudioSettings = Boolean(entitlements?.customization || entitlements?.company);\n  const showPremiumSettings = Boolean(entitlements?.premium || entitlements?.company || chatEligible);\n"
            t = t[: m.start()] + insert + t[m.end() :]
            print("added showChatSettings / showStudioSettings flags")
        else:
            # broader
            m = re.search(r"const chatEligible[\s\S]{0,200}?false;", t)
            if m:
                insert = m.group(0) + "\n  const showChatSettings = chatEligible;\n  const showStudioSettings = Boolean(entitlements?.customization || entitlements?.company);\n  const showPremiumSettings = Boolean(entitlements?.premium || entitlements?.company || chatEligible);\n"
                t = t[: m.start()] + insert + t[m.end() :]
                print("added flags (broad)")
            else:
                print("WARN: chatEligible not found")

    def wrap_menu_row(label: str, condition: str) -> None:
        nonlocal t
        # Find MenuRow with this label - various formats
        pat = re.compile(
            rf"(<MenuRow\b[\s\S]*?label=\"{re.escape(label)}\"[\s\S]*?/>)",
            re.M,
        )
        def repl(m):
            block = m.group(1)
            if condition in block or f"{{{condition} &&" in t[max(0,m.start()-40):m.start()]:
                return block
            return f"{{{condition} && (\n                      {block}\n                    )}}"
        t2, n = pat.subn(repl, t, count=1)
        if n:
            t = t2
            print(f"gated MenuRow: {label} behind {condition}")
        else:
            print(f"WARN: MenuRow not found for {label}")

    # Premium / chat
    wrap_menu_row("Notification and Sound Management", "showPremiumSettings")
    # ProMaxx studio
    wrap_menu_row("Night Mode Light", "showStudioSettings")
    wrap_menu_row("Interface Customization", "showStudioSettings")

    # Chat settings rows if labeled
    for lab in ["Private Chat", "Chat Settings", "Chat"]:
        if f'label="{lab}"' in t:
            wrap_menu_row(lab, "showChatSettings")

    if t != o:
        app.write_text(t, encoding="utf-8")
        print("app.tsx plan gates written")
    else:
        print("app.tsx no structural change (or already gated)")

print("done")
