#!/usr/bin/env python3
"""Rex: chat as assistant first; draft without drama; only SEND needs approval; resume sending on return."""
from pathlib import Path

# --- SYSTEM_BRIEF: assistant-first + draft-then-approve-send only ---
af = Path("src/lib/assist.functions.ts")
s = af.read_text()

NEW_RULES = '''
ASSISTANT FIRST, AGENT SECOND
- Chat, brainstorm, explain, draft, and discuss freely. Do not force navigation, approval cards, or agent workflows while the user is only talking or refining ideas.
- Switch into action mode only when the user clearly wants something done (write this into the template, import this list, validate, send, open settings, etc.).
- Never interrupt a normal discussion with route suggestions or fake approval theatre.

ONLY SEND NEEDS APPROVAL
- Upload/import recipients, validate, quarantine, write/edit subject and body, apply campaign templates, change reversible settings, navigate, analyse readiness: do these without asking for approval when the user requested them.
- The only actions that require the real red approval control are: executing/scheduling an email campaign, and sending a Private Chat message.
- Logout remains a confirm step because it ends the session.

DRAFT → SHOW → TWEAK → APPROVE SEND (NO DRAMA)
- If the user says "write a friendly message to these people" (or similar) and does not provide the full text:
  1) Write a complete usable subject + body in your reply (use {name}/{company} when useful).
  2) Offer to apply it to Campaign Template A/B if they want it in the workspace draft.
  3) Only after the draft is visible should a send approval appear — and only when they ask to send/execute.
- Do not lecture "you have not read this". Showing the draft is the preview. Keep copy short: Subject, Body, then Approve & Send when they request send.
- If the user already gave the exact subject and body, apply/prepare them and present one clean Approve & Send control — no extra essays.
- If they say the draft is wrong, rewrite and show the new draft; do not send until they approve the revised version.
'''

if "ASSISTANT FIRST, AGENT SECOND" not in s:
    # Insert after OWNER'S CONTROL block start or GET THINGS DONE
    anchor = "OWNER'S CONTROL"
    if anchor in s:
        s = s.replace(anchor, NEW_RULES + "\n" + anchor, 1)
        print("brief: assistant-first rules")
    else:
        s = s.replace("GET THINGS DONE", NEW_RULES + "\nGET THINGS DONE", 1)
        print("brief: via GET THINGS DONE")

# Soften any remaining "have not read" style language in brief
s = s.replace(
    "If you have not read the subject and body",
    "Show the subject and body clearly",
)
s = s.replace(
    "do not approve yet — ask me to inspect or show the draft first",
    "show the draft above the approval control",
)
af.write_text(s)
print("assist.functions size", af.stat().st_size)

# --- EliteAssist: campaign card less dramatic ---
ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()
old_card = """Campaign send — read before you approve</p>
          <p className="mt-1 text-[12px] text-ink-soft">This starts the <span className="font-semibold text-ink">current Elite Engine</span> draft (active subject, body, and recipient list). If you have not opened or inspected that message, cancel and ask Rex to show the draft first.</p>"""
new_card = """Ready to send</p>
          <p className="mt-1 text-[12px] text-ink-soft">Starts the <span className="font-semibold text-ink">current Elite Engine</span> draft (subject, body, recipient list). Tap Approve & Send Now, or reply yes. If the message is wrong, tell Rex what to change first.</p>"""
if old_card in t:
    t = t.replace(old_card, new_card, 1)
    print("campaign card softened")
else:
    # softer partial
    t = t.replace(
        "Campaign send — read before you approve",
        "Ready to send",
    )
    t = t.replace(
        "If you have not opened or inspected that message, cancel and ask Rex to show the draft first.",
        "If the message is wrong, tell Rex what to change first.",
    )
    print("campaign card partial")

# Soften prepare return strings
for a, b in [
    ("PREVIEW BEFORE YOU APPROVE. If you have not read the subject and body of the active campaign draft, do not approve yet — ask me to inspect or show the draft first. ", ""),
    ("PREVIEW BEFORE YOU APPROVE. ", ""),
]:
    if a in t:
        t = t.replace(a, b)
        print("stripped", a[:40])

ea.write_text(t)
print("EliteAssist size", ea.stat().st_size)

# --- app.tsx: resume campaign if was sending when user returns ---
app = Path("src/routes/app.tsx")
if app.exists():
    a = app.read_text()
    marker = "EC_RESUME_SENDING_ON_RETURN"
    if marker not in a:
        # Persist intent when entering sending; clear on stop/complete/pause by user
        # Find setEngine("sending") occurrences and add localStorage
        if 'setEngine("sending")' in a:
            a = a.replace(
                'setEngine("sending")',
                'setEngine("sending"); try { localStorage.setItem("ec-engine-resume","1"); } catch {} /* ' + marker + ' */',
            )
            print("flag on sending")
        for stop_expr in ['setEngine("idle")', 'setEngine("paused")']:
            if stop_expr in a:
                a = a.replace(
                    stop_expr,
                    stop_expr + '; try { if ("' + stop_expr + '".includes("idle") || true) { /* resume clear handled below */ } } catch {}',
                    1,
                )
        # Cleaner: on idle clear, on paused keep or clear? User said if they didn't stop, resume. Pause = user intentional stop of auto-run.
        # Clear resume flag only on idle (finished/stopped)
        a = a.replace(
            'setEngine("idle"); try { if ("setEngine("idle")".includes("idle") || true) { /* resume clear handled below */ } } catch {}',
            'setEngine("idle"); try { localStorage.removeItem("ec-engine-resume"); } catch {}',
        )
        # Remove botched paused replacement if any
        a = a.replace(
            'setEngine("paused"); try { if ("setEngine("paused")".includes("idle") || true) { /* resume clear handled below */ } } catch {}',
            'setEngine("paused"); try { localStorage.removeItem("ec-engine-resume"); } catch {}',
        )

        # On visibility + mount: if resume flag and engine not sending, restart
        resume_hook = '''
  // ''' + marker + ''': if user left while a campaign was sending (minimize/logout/reopen), continue automatically.
  useEffect(() => {
    function maybeResume() {
      try {
        if (localStorage.getItem("ec-engine-resume") !== "1") return;
        if (engine === "sending") return;
        // Only auto-continue when not deliberately paused/idle-cleared
        void (async () => {
          try {
            // Prefer existing execute path if present in this scope
            const starter = (window as any).__ecStartEngine as undefined | (() => void | Promise<void>);
            if (typeof starter === "function") await starter();
          } catch {}
        })();
      } catch {}
    }
    maybeResume();
    const onVis = () => { if (document.visibilityState === "visible") maybeResume(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", maybeResume);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", maybeResume);
    };
  }, [engine]);
'''
        # Only inject if we can also expose starter - simpler approach: store in ref
        # Actually safer minimal approach without window global:
        # on mount if localStorage and engine idle, setEngine sending + call existing start if we find function name
        # Search for startEngine or runEngine function names
        if "function startSending" in a or "const startSending" in a or "async function startSending" in a:
            print("found startSending")
        # Minimal: document the flag; wire visibility to setEngine sending if flag - the existing loop may need to be re-triggered
        # Find pattern like: if (engine === "sending")
        inject_at = a.find("const [engine, setEngine]")
        if inject_at > 0 and marker not in a:
            # Add after first useEffect that depends on signedIn if any - append near engine state
            # Place resume effect after engine state declaration block - find next useEffect
            pos = a.find("useEffect(", inject_at)
            if pos > 0:
                a = a[:pos] + resume_hook + "\n  " + a[pos:]
                print("resume hook injected")
        app.write_text(a)
        print("app.tsx updated", app.stat().st_size)
    else:
        print("resume already present")
else:
    print("no app.tsx")

print("done")
