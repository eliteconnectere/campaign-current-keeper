#!/usr/bin/env python3
"""Safe in-place patches for app.tsx — never rewrite the whole file."""
from pathlib import Path
import re

path = Path("src/routes/app.tsx")
text = path.read_text(encoding="utf-8")
original = text

# ---------------------------------------------------------------------------
# 1) log(): finish = repeating alarm; other kinds = short notification
# ---------------------------------------------------------------------------
log_pattern = re.compile(
    r"if \(kind\) \{\s*showSystemNotification\([\s\S]*?vibrate\([^\n]+\);\s*\}",
    re.M,
)
new_log_block = '''if (kind) {
        showSystemNotification("Elite Connectere", msg, settings.notifications[kind]);
        // Finish campaign = repeating alarm. Start / other events = short notification tone.
        if (kind === "campaignCompleted") {
          playAlarmRingtone(settings.alarmRingtone || settings.notificationSound, settings.sounds !== false);
          vibrate([80, 40, 80, 40, 80], settings.vibration !== false);
        } else {
          playSound(settings.notificationSound, settings.sounds !== false);
          vibrate([55, 45, 55], settings.vibration !== false);
        }
      }'''

if log_pattern.search(text):
    text = log_pattern.sub(new_log_block, text, count=1)
    print("✓ log() finish=alarm, other=notification")
else:
    print("· log() block not matched")

# ---------------------------------------------------------------------------
# 2) stop(): mark finished vs paused
# ---------------------------------------------------------------------------
old_stop_simple = '''    const stop = (msg?: string) => {
      setEngine("idle");
      setScout(false);
      if (msg) log(msg);
    };'''
old_stop_done = '''    const stop = (msg?: string) => {
      setEngine("idle");
      setScout(false);
      if (msg) {
        const finished = /finished|complete/i.test(msg);
        log(msg, finished ? "campaignCompleted" : "campaignPaused");
      }
    };'''
if old_stop_simple in text:
    text = text.replace(old_stop_simple, old_stop_done, 1)
    print("✓ stop() wires campaignCompleted")
elif old_stop_done in text:
    print("· stop() already wired")
else:
    print("· stop() anchor missing")

# ---------------------------------------------------------------------------
# 3) On campaign START: short notification only (never the long alarm)
# ---------------------------------------------------------------------------
if "// Short notification on start" not in text:
    anchor = '''    setEngine("sending");
    setScout(true);
  }'''
    if anchor in text:
        text = text.replace(
            anchor,
            '''    setEngine("sending");
    setScout(true);
    // Short notification on start — finish uses the long repeating alarm instead.
    if (settings.sounds !== false) {
      playSound(settings.notificationSound, true);
    }
  }''',
            1,
        )
        print("✓ start plays short notification sound")
    else:
        print("· startCampaign anchor missing")
else:
    print("· start sound already present")

# ---------------------------------------------------------------------------
# 4) Labels
# ---------------------------------------------------------------------------
text = text.replace("Connected Google Profiles", "Connected Gmail Profiles")
text = text.replace("Connect a Gmail account", "Connect Gmail profile")
text = text.replace("Link another Gmail profile", "Connect Gmail profile")
text = text.replace("Sign in to connect Gmail", "Sign in to connect Gmail profile")

# ---------------------------------------------------------------------------
# 5) Connect method state
# ---------------------------------------------------------------------------
if "connectMethodOpen" not in text:
    m = re.search(r"const \[gmailBusy, setGmailBusy\] = useState\(false\);", text)
    if m:
        text = text[: m.end()] + "\n  const [connectMethodOpen, setConnectMethodOpen] = useState(false);" + text[m.end() :]
        print("✓ connectMethodOpen state added")

if "setConnectMethodOpen(true)" not in text:
    text = text.replace(
        '''                  <button data-tour="connect"
                    onClick={connectGmail}
                    disabled={gmailBusy}''',
        '''                  <button data-tour="connect"
                    onClick={() => {
                      if (!signedIn) {
                        void connectGmail();
                        return;
                      }
                      setConnectMethodOpen(true);
                    }}
                    disabled={gmailBusy}''',
        1,
    )
    text = text.replace(
        '''                      <button
                        onClick={connectGmail}
                        disabled={gmailBusy}
                        className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-[12.5px] font-semibold text-brand disabled:opacity-40"
                      >''',
        '''                      <button
                        onClick={() => setConnectMethodOpen(true)}
                        disabled={gmailBusy}
                        className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-[12.5px] font-semibold text-brand disabled:opacity-40"
                      >''',
        1,
    )
    print("✓ Connect buttons open method sheet")

# ---------------------------------------------------------------------------
# 6) Connect modal: Google OAuth ONLY + Chrome notice (no Manual)
# ---------------------------------------------------------------------------
new_modal = '''
      {connectMethodOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-line bg-white p-4 shadow-xl">
            <p className="text-[15px] font-bold text-ink">Connect Gmail profile</p>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
              Authorise a sending profile with Google. You can pick which Google account to use on the next screen.
            </p>
            <button
              type="button"
              disabled={gmailBusy}
              onClick={() => {
                setConnectMethodOpen(false);
                void connectGmail();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              Connect with Google
            </button>
            <div className="mt-3 rounded-xl border border-line bg-soft/70 px-3 py-2.5 text-[11.5px] leading-snug text-ink-soft">
              <p className="font-bold text-ink">Notice for Chrome Users</p>
              <p className="mt-1">
                Google limits active logged-in browser accounts to 10. If Chrome blocks you from adding another account or displays a maximum account limit error:
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                <li>Open an Incognito / Private window in your browser.</li>
                <li>Log into Elite Connectere inside that Incognito tab.</li>
                <li>Click 'Connect with Google' to add your sending profile without logging out of your active accounts.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => setConnectMethodOpen(false)}
              className="mt-2 w-full py-2 text-[12.5px] font-semibold text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
'''

modal_re = re.compile(
    r"\{connectMethodOpen && \([\s\S]*?\)\}\s*(?=\{adminOpen &&|\{radarOpen &&|<ErrorGuideHost)",
    re.M,
)
if modal_re.search(text):
    text = modal_re.sub(new_modal.strip() + "\n\n      ", text, count=1)
    print("✓ Replaced connect modal (Google only + Chrome notice)")
elif "Manual / troubleshooting" in text:
    text = re.sub(
        r"\s*<button[\s\S]*?Manual / troubleshooting\s*</button>",
        "",
        text,
        count=1,
    )
    print("✓ Removed Manual button")
elif "Notice for Chrome Users" not in text and "connectMethodOpen" in text:
    marker = "{adminOpen &&"
    if marker in text:
        text = text.replace(marker, new_modal + "\n      {adminOpen &&", 1)
        print("✓ Injected connect modal")

if "Manual / troubleshooting" in text:
    text = re.sub(
        r"\s*<button[\s\S]*?Manual / troubleshooting\s*</button>",
        "",
        text,
        count=1,
    )
    print("✓ Stripped remaining Manual button")

if text == original:
    print("No changes written")
else:
    path.write_text(text, encoding="utf-8")
    print(f"Saved app.tsx ({len(text)} bytes)")
