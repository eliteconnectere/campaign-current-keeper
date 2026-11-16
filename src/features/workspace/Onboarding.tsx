import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Mail,
  Send,
  Zap,
  ShieldCheck,
  ListChecks,
  Sparkles,
  Rocket,
  ChevronRight,
} from "lucide-react";

const TERMS_SUMMARY = [
  [
    "1. Using Elite Connectere",
     "Elite Connectere is an AI-powered outreach workspace. Rex is its AI Workspace Agent, designed to understand natural-language instructions, reason across supported workspace features, prepare work, and use connected application tools. For consequential actions such as sending, scheduling, publishing, deleting, or changing important settings, the intended experience is to show you the exact action and wait for your deliberate approval before the application executes it. You remain responsible for the messages you send and for having a lawful basis to contact each recipient.",
  ],
  [
    "2. Standard Mode",
    "Standard Mode builds personalised messages and hands them to the mail application already installed on your device. Nothing is delivered by us in this mode — your own mail app sends the message from your own address.",
  ],
  [
    "3. Elite Engine",
    "Elite Engine delivers messages from the Google accounts you authorise. You may connect up to 10 Gmail sending profiles. Each connected address carries its own randomised daily allowance of between 360 and 420 messages.",
  ],
  [
    "4. Sending limits",
    "Daily allowances and cooldowns are held against the Gmail address itself. Clearing the app, erasing your data, changing device or reconnecting the same address does not reset an allowance or shorten a cooldown.",
  ],
  [
    "5. Acceptable use",
    "Unsolicited bulk mail, spam, harassment, deception, malware, scraped or purchased lists used without a lawful basis, and any attempt to bypass sending limits are prohibited and may end your access without notice.",
  ],
  [
    "6. Your content",
    "Your recipients, templates, notes and campaigns belong to you. We do not sell them, and we do not use them to send anything you did not ask us to send. When you ask Rex about your campaign, relevant details from your own signed-in workspace may be processed by our AI provider to generate its response.",
  ],
  [
     "7. Rex AI Workspace Agent",
     "Rex is the AI Workspace Agent inside Elite Connectere. It is intended to reason, plan, draft, recommend, and operate connected workspace tools. The exact operations available depend on the tools enabled in the live app; not every feature is yet callable through chat. For supported consequential actions, Rex should show the exact details and wait for your approval before application code executes the action. The conversation and relevant workspace context may be processed by Google's Gemini API. Rex does not receive general access to your Gmail inbox or another user's private workspace. AI output may be inaccurate, so review content and proposed actions before approving them.",
  ],
  [
    "8. Availability and liability",
    "The service is provided as is. Delivery depends on Google and on the recipient's provider, so no delivery, inbox placement or response can be guaranteed. To the extent permitted by law, liability is limited to the amount you paid for the service.",
  ],
  [
    "9. Contact",
    "For anything concerning Elite Connectere itself — questions, issues, complaints or disputes — contact eliteconnectere@gmail.com or +234 906 412 9297. Elite Connectere was created by The Bloodline💯; creator-specific inquiries may go to thebloodline.black@gmail.com.",
  ],
] as const;

export function Onboarding({ onAccept }: { onAccept: () => void }) {
  const [page, setPage] = useState(0);
  const [atBottom, setAtBottom] = useState(false);
  const panel = useRef<HTMLDivElement | null>(null);

  function onScroll() {
    const el = panel.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setAtBottom(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto px-5 py-6">
        {page === 0 && (
          <div className="flex flex-1 animate-fade-in flex-col items-center justify-center text-center">
            <div className="flex size-16 animate-scale-in items-center justify-center rounded-full bg-ink">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand">
                <Mail className="size-5 text-white" />
              </div>
            </div>
            <h1 className="mt-4 text-[24px] font-bold tracking-tight">
              <span className="text-ink">Elite </span>
              <span className="text-brand">Connectere</span>
            </h1>
            <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.18em] text-ink-soft">
              AI-Powered Campaign Workspace · Meet Rex
            </p>
            <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-ink-soft">
               Work across your Elite Connectere workspace with Rex, your AI Workspace Agent. Prepare recipient lists, personalise messages and deliver through your own mail app or authorised Gmail profiles. Rex operates routine workspace tools directly and asks for approval only before sending email campaigns or Private Chat messages.
            </p>
          </div>
        )}

        {page === 1 && (
          <div className="flex-1 animate-fade-in">
            <h2 className="text-[20px] font-bold text-ink">Two ways to deliver</h2>
            <div className="mt-3 rounded-2xl border border-line p-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <Send className="size-4 text-brand" /> Standard
              </p>
              <ul className="mt-1.5 space-y-1 text-[12.5px] leading-snug text-ink-soft">
                <li>Uses the mail application on your device</li>
                <li>Personalised messages prepared for you, ready to send</li>
                <li>Sends from your normal email client</li>
              </ul>
            </div>
            <div className="mt-2.5 rounded-2xl border border-brand/25 bg-brand-soft p-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-brand">
                <Zap className="size-4" /> Elite Engine
              </p>
              <ul className="mt-1.5 space-y-1 text-[12.5px] leading-snug text-brand/90">
                <li>Delivers in-app from the Gmail profiles you authorise</li>
                <li>Queues campaigns and personalises every message</li>
                <li>Up to 10 sending profiles with automatic rotation</li>
                <li>Each profile keeps its own daily allowance</li>
              </ul>
            </div>
          </div>
        )}

        {page === 2 && (
          <div className="flex-1 animate-fade-in">
            <h2 className="text-[20px] font-bold text-ink">How it works</h2>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              Build → Validate → Personalize → Generate → Deliver
            </p>
            <ul className="mt-3 space-y-2">
              {(
                [
                  [Mail, "Build", "Paste or import your recipients, or use Smart Fill."],
                  [ListChecks, "Validate", "Clean the list into valid, invalid and risky."],
                  [Sparkles, "Personalize", "Names and companies drop into your templates."],
                  [ShieldCheck, "Generate", "Two rotating messages keep your copy varied."],
                  [Rocket, "Deliver", "Choose Standard or Elite Engine and watch progress."],
                ] as [typeof Mail, string, string][]
              ).map(([Icon, title, text]) => (
                <li key={title} className="flex gap-2.5 rounded-xl border border-line px-3 py-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    <span className="block text-[13px] font-semibold text-ink">{title}</span>
                    <span className="block text-[12px] leading-snug text-ink-soft">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {page === 3 && (
          <div className="flex flex-1 animate-fade-in flex-col">
            <h2 className="text-[20px] font-bold text-ink">Terms &amp; Privacy</h2>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
              Read to the bottom to continue. The full{" "}
              <Link to="/terms" className="font-semibold text-brand">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="font-semibold text-brand">
                Privacy Policy
              </Link>{" "}
              stay available inside the app.
            </p>
            <div
              ref={panel}
              onScroll={onScroll}
              className="mt-2.5 h-[46vh] overflow-y-auto rounded-2xl border border-line p-3.5"
            >
              {TERMS_SUMMARY.map(([title, text]) => (
                <div key={title} className="mb-3 last:mb-0">
                  <p className="text-[13px] font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{text}</p>
                </div>
              ))}
              <p className="mt-2 text-[12px] font-semibold text-brand">
                You have reached the end. Accepting confirms you agree to the Terms of Service and
                the Privacy Policy.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= page ? "bg-brand" : "bg-line"
              }`}
            />
          ))}
        </div>

        {page < 3 ? (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-ink py-3 text-[13.5px] font-semibold text-white"
          >
            Next <ChevronRight className="size-4" />
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setPage(0);
                setAtBottom(false);
              }}
              className="flex-1 rounded-full border border-line py-3 text-[13.5px] font-semibold text-ink"
            >
              Decline
            </button>
            <button
              onClick={onAccept}
              disabled={!atBottom}
              className="flex-[1.4] rounded-full bg-brand py-3 text-[13.5px] font-semibold text-white disabled:opacity-40"
            >
              Accept &amp; Continue
            </button>
          </div>
        )}
        <p className="mt-3 text-center text-[11px] text-ink-soft">
          Created by The Bloodline&#128175;
        </p>
      </div>
    </div>
  );
}
