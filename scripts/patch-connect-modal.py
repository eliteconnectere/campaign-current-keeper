#!/usr/bin/env python3
"""Gmail connect modal + Learn More (multi-account + penalty policy)."""
from pathlib import Path
import re

path = Path("src/routes/app.tsx")
text = path.read_text(encoding="utf-8")
original = text

# ---------------------------------------------------------------------------
# State: gmailLearnMoreOpen
# ---------------------------------------------------------------------------
if "gmailLearnMoreOpen" not in text:
    m = re.search(r"const \[connectMethodOpen, setConnectMethodOpen\] = useState\(false\);", text)
    if m:
        text = (
            text[: m.end()]
            + "\n  const [gmailLearnMoreOpen, setGmailLearnMoreOpen] = useState(false);"
            + text[m.end() :]
        )
        print("✓ gmailLearnMoreOpen state")
    else:
        m2 = re.search(r"const \[gmailBusy, setGmailBusy\] = useState\(false\);", text)
        if m2:
            text = (
                text[: m2.end()]
                + "\n  const [connectMethodOpen, setConnectMethodOpen] = useState(false);"
                + "\n  const [gmailLearnMoreOpen, setGmailLearnMoreOpen] = useState(false);"
                + text[m2.end() :]
            )
            print("✓ connectMethodOpen + gmailLearnMoreOpen state")

new_modals = r'''
      {connectMethodOpen && !gmailLearnMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-6 sm:items-center sm:pb-0">
          <div className="flex max-h-[min(92dvh,640px)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl animate-scale-in">
            <div className="shrink-0 border-b border-line px-4 py-3">
              <p className="text-[15px] font-bold text-ink">Connect Gmail profile</p>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
                Authorise a sending profile with Google. Tokens are stored securely on the server so campaigns keep running without an open browser tab.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <button
                type="button"
                disabled={gmailBusy}
                onClick={() => {
                  setConnectMethodOpen(false);
                  void connectGmail();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                Connect with Google
              </button>

              <button
                type="button"
                onClick={() => setGmailLearnMoreOpen(true)}
                className="mt-2.5 w-full text-center text-[12.5px] font-semibold text-brand underline-offset-2 hover:underline"
              >
                Learn More — multi-account & safety rules
              </button>

              <div className="mt-3 rounded-xl border border-line bg-soft px-3 py-3">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-ink">Managing Multiple Gmail Profiles?</p>
                    <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">
                      Google caps active browser sign-ins at 10 accounts. If Chrome blocks you or shows a "maximum accounts reached" error, open Learn More for the full guide — or use Incognito / clear browser Google sessions below.
                    </p>
                    <a
                      href="https://accounts.google.com/Logout"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-brand/30 bg-white px-3 py-2.5 text-center text-[12.5px] font-semibold text-brand shadow-sm active:bg-brand-soft"
                    >
                      Clear Browser Google Sessions
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-line px-4 py-2.5">
              <button
                type="button"
                onClick={() => setConnectMethodOpen(false)}
                className="w-full py-2 text-[12.5px] font-semibold text-ink-soft"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {gmailLearnMoreOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 px-3 pb-4 sm:items-center sm:pb-0">
          <div className="flex max-h-[min(94dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl animate-scale-in">
            <div className="shrink-0 border-b border-line px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Elite Engine</p>
              <h3 className="text-[16px] font-bold leading-snug text-ink">Managing Multiple Gmail Profiles in Elite Engine</h3>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">How Elite Engine Works</h4>
                <p className="mt-1.5">
                  When you connect an account using <span className="font-semibold text-ink">Connect with Google</span>, Elite Connectere securely receives an OAuth authorization token. Once connected, your account stays active in your campaign pool — even if you sign out of Google in your browser later. Tokens are stored encrypted on our servers so campaigns can continue without an open browser session.
                </p>
                <p className="mt-2">
                  Choose your <span className="font-semibold text-ink">best, most trusted Gmail</span> for each connection. Connecting is not always easy to repeat if Google limits permissions, so prefer accounts you own and use regularly for legitimate outreach.
                </p>
              </section>

              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Google's 10-Account Limit Explained</h4>
                <p className="mt-1.5">
                  Google limits active signed-in accounts to about 10 per browser session. If Google blocks you from adding another profile:
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                  <li>Open Google's Account Manager screen in the browser.</li>
                  <li>
                    Tap <span className="font-semibold text-ink">Remove from this device</span> on any account you are not currently linking. This only clears local browser sign-in cookies — it does <span className="font-semibold text-ink">not</span> delete your Gmail account or affect the account on your phone.
                  </li>
                  <li>Return to Elite Connectere and tap <span className="font-semibold text-ink">Connect with Google</span> to add your new profile.</li>
                </ol>
              </section>

              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Alternative Quick Fixes</h4>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-4">
                  <li>
                    <span className="font-semibold text-ink">Incognito / Private window:</span> Open Elite Connectere inside an Incognito tab to bypass browser account limits without disturbing your active logins.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">Direct session reset:</span> Use the button below to log out of all browser Google accounts and clear session locks, then connect again.
                  </li>
                </ul>
              </section>

              <section className="rounded-xl border border-brand/25 bg-brand-soft/40 px-3 py-2.5">
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">If a Gmail disconnects on its own</h4>
                <p className="mt-1.5">
                  Any Gmail that is removed <span className="font-semibold text-ink">automatically without your confirmation</span> was flagged by Google (for example, a refused send). That is not a random app glitch.
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-4">
                  <li>
                    <span className="font-semibold text-ink">1st flag in a calendar month:</span> the profile is disconnected, suspended from Elite Engine for <span className="font-semibold text-ink">5 days</span>, and monthly capacity is reduced.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">2nd flag in the same month:</span> suspension extends to <span className="font-semibold text-ink">30 days</span> with a tighter capacity cap.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">3rd flag in the same month:</span> the address is <span className="font-semibold text-ink">permanently blocked</span> from connecting on Elite Engine. Standard Mode remains available.
                  </li>
                </ul>
                <p className="mt-2">
                  Standard Mode (mailto) is not affected by these Engine suspensions. Always connect Gmail accounts you are allowed to use for outreach, keep pacing sensible, and avoid lists that produce high bounce or spam complaints.
                </p>
              </section>

              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Before you disconnect a working profile</h4>
                <p className="mt-1.5">
                  Manually disconnecting a healthy Gmail is allowed, but reconnecting can be harder if Google shows permission or account-picker limits. Prefer keeping stable profiles in the pool and only remove accounts you no longer intend to use for campaigns.
                </p>
              </section>
            </div>

            <div className="shrink-0 space-y-2 border-t border-line px-4 py-3">
              <a
                href="https://accounts.google.com/Logout"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-center text-[13px] font-semibold text-white"
              >
                Log out of all browser Google accounts
              </a>
              <button
                type="button"
                onClick={() => setGmailLearnMoreOpen(false)}
                className="w-full rounded-xl border border-line py-2.5 text-[13px] font-semibold text-ink"
              >
                Back to Connect
              </button>
            </div>
          </div>
        </div>
      )}
'''

# Replace existing connectMethodOpen modal block(s)
modal_re = re.compile(
    r"\{connectMethodOpen &&[\s\S]*?\)\}\s*(?=\{adminOpen &&|\{radarOpen &&|\{gmailLearnMoreOpen &&|<ErrorGuideHost)",
    re.M,
)
learn_re = re.compile(
    r"\{gmailLearnMoreOpen &&[\s\S]*?\)\}\s*(?=\{adminOpen &&|\{radarOpen &&|<ErrorGuideHost)",
    re.M,
)

if learn_re.search(text):
    text = learn_re.sub("", text)
    print("✓ cleared old learn more block")

if modal_re.search(text):
    text = modal_re.sub(new_modals.strip() + "\n\n      ", text, count=1)
    print("✓ replaced connect + learn more modals")
elif "{adminOpen &&" in text:
    text = text.replace("{adminOpen &&", new_modals + "\n      {adminOpen &&", 1)
    print("✓ injected modals before admin")
else:
    print("· injection point missing")

# Ensure Info is imported
if "Info className=" in text and "\n  Info," not in text and "  Info," not in text:
    if "ExternalLink," in text:
        text = text.replace("ExternalLink,", "ExternalLink,\n  Info,", 1)
        print("✓ Info import")

if text == original:
    print("No changes")
else:
    path.write_text(text, encoding="utf-8")
    print(f"Saved app.tsx ({len(text)} bytes)")
