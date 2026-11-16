import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GOOGLE_REVIEW_MODE } from "@/lib/reviewMode";
import { REVIEW_HEAD, ReviewLanding } from "@/features/review/ReviewPages";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceDisplaySession } from "@/features/workspace/offline-session";
import {
  Mail,
  Globe,
  Youtube,
  Instagram,
  Facebook,
  Send,
  ShieldCheck,
  ListChecks,
  BadgeCheck,
  PenLine,
  Layers,
  Rocket,
  ArrowRight,
  ArrowDown,
} from "lucide-react";

const URL = "https://eliteconnectere.site/";
const TITLE = GOOGLE_REVIEW_MODE ? REVIEW_HEAD.home.title : "Elite Connectere — AI-Powered Campaign Workspace with Rex";
const DESC = GOOGLE_REVIEW_MODE ? REVIEW_HEAD.home.desc :
  "Elite Connectere is an AI-powered outreach workspace with Rex, an AI Workspace Agent designed to reason, create, and operate connected app features with approval for consequential actions.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:image", content: "https://eliteconnectere.site/icon-512.png" },
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "google-site-verification", content: "VFwjI5_OReIQtWS2Pxc7ftZ-tZCwQhHcHiQuPQgaXXM" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: "https://eliteconnectere.site/icon-512.png" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Elite Connectere",
          url: URL,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: DESC,
        }),
      },
    ],
  }),
  component: GOOGLE_REVIEW_MODE ? ReviewLanding : HomeEntry,
});

const STEPS = [
  { icon: ListChecks, t: "Build", d: "Paste or import your recipient list with names and companies." },
  { icon: BadgeCheck, t: "Validate", d: "Every address is checked and sorted into Valid, Duplicate and Risky — you decide what to remove." },
  { icon: PenLine, t: "Personalise", d: "Write one template with {name} and {company}; each recipient gets their own version." },
  { icon: Layers, t: "Generate", d: "Elite Connectere builds a ready-to-send message for every valid recipient." },
  { icon: Rocket, t: "Deliver", d: "Send through your own mail app (Standard) or through your connected Gmail accounts (Elite Engine) at the delay you choose." },
];

/** If already signed in, open workspace — homepage is only for logged-out / after logout. */
function HomeEntry() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getWorkspaceDisplaySession().then((session) => {
      if (cancelled) return;
      if (session) {
        setAuthed(true);
        void navigate({ to: "/app" });
      } else {
        setReady(true);
      }
    }).catch(() => {
      if (!cancelled) setReady(true);
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

function Landing() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <header className="border-b border-line px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-ink">
              <div className="flex size-5 items-center justify-center rounded-[6px] bg-brand">
                <Mail className="size-3 text-primary-foreground" />
              </div>
            </div>
            <span className="text-[15px] font-semibold text-ink">
              Elite <span className="text-brand">Connectere</span>
            </span>
          </div>
          <Link to="/auth" className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <section className="py-8 sm:py-12">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-brand">AI-powered campaign workspace</p>
          <h1 className="mt-2 text-[26px] font-bold leading-tight text-ink sm:text-[34px]">
            Prepare and execute personalised bulk email campaigns with Rex AI
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
            Elite Connectere brings bulk email campaign preparation, personalisation, management and
            execution together with Rex, your built-in AI Workspace Agent. Build a campaign for a large
            recipient list, validate addresses, create individually personalised messages, review the
            results and deliver through your own authorised mail accounts. You can manage the campaign
            yourself or ask Rex to help plan, prepare, inspect and operate the connected campaign tools
            using natural-language instructions. The campaign engine performs the mailing; Rex helps
            you work with it across the workspace. For consequential actions such as sending, scheduling,
            publishing, deleting or changing important settings, Rex presents the exact action for your
            approval before the application executes it.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Elite Engine supports multi-account bulk delivery through Gmail profiles you connect with
            Google sign-in. Eligible higher plans support up to 75 profiles. The engine manages available
            sender profiles and their applicable daily limits, helping a campaign continue through another
            available connected profile when the current one reaches its limit.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/app" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground">
              Launch Workspace <ArrowRight className="size-4" />
            </Link>
            <Link to="/auth" className="rounded-xl border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink">
              Sign in
            </Link>
          </div>
        </section>

        <section className="py-6" aria-labelledby="rex-ai">
          <div className="card-shell border-brand/40 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Meet Rex</p>
            <h2 id="rex-ai" className="mt-1 text-[19px] font-bold text-ink">Meet Rex — your AI Workspace Agent</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              Rex and the campaign engine are designed to work as one system. The campaign workspace provides the tools for bulk recipient lists, validation, personalisation, message generation, sender profiles, delivery pacing and campaign monitoring. Rex is the AI operating agent that helps you use those tools: describe the campaign or task in ordinary language, and Rex can reason across available workspace information, inspect relevant campaign details, prepare content, guide configuration and operate registered app functions. The mailing engine executes the campaign; Rex makes the process easier to direct and manage.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              Rex can help with routine reading, navigation, drafting, campaign preparation, review and other owner-scoped workspace tasks without unnecessary approval prompts. It asks for your explicit approval before sending an email campaign (including a scheduled send) or a Private Chat message. The app checks permissions, ownership, sending limits and readiness before carrying out each operation.
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-soft">
              Conversation content and relevant workspace context may be processed by Google's Gemini AI service to generate Rex responses. Rex only receives data and tools made available by Elite Connectere; it does not gain general access to your Gmail inbox or another user's workspace.{" "}
              <Link to="/privacy" className="font-semibold text-brand underline">Read the Privacy Policy</Link>.
            </p>
            <Link to="/rex" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand">
              Learn more about Rex <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="py-6" aria-labelledby="ways">
          <h2 id="ways" className="text-[19px] font-bold text-ink">Bulk campaign delivery: two ways to send</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="card-shell p-4">
              <h3 className="text-[15px] font-bold text-ink">Standard</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                For a prepared bulk campaign, Standard opens each personalised recipient message in your
                own mail app, one after another, at your chosen delay. No Gmail sender connection is
                needed; you review and press send for each message.
              </p>
            </div>
            <div className="card-shell border-brand/40 p-4">
              <h3 className="text-[15px] font-bold text-brand">Elite Engine</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Executes bulk campaigns through Gmail accounts you connect with Google sign-in. It sends
                the messages you prepare, manages connected sender profiles and applicable daily limits,
                and supports up to 75 profiles on eligible higher plans.
              </p>
            </div>
          </div>
        </section>

        <section className="py-6" aria-labelledby="flow">
          <h2 id="flow" className="text-[19px] font-bold text-ink">From bulk campaign preparation to delivery</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            You can run this workflow through the campaign controls or work with Rex in natural language.
            Rex helps prepare and manage the work; Elite Connectere's campaign tools handle the recipient
            processing and delivery.
          </p>
          <ol className="mt-3 space-y-1">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <div className="card-shell flex gap-3 p-3.5">
                  <s.icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  <div>
                    <h3 className="text-[14px] font-bold text-ink">{i + 1}. {s.t}</h3>
                    <p className="text-[12.5px] leading-relaxed text-ink-soft">{s.d}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && <ArrowDown className="mx-auto my-1 size-4 text-ink-soft" aria-hidden />}
              </li>
            ))}
          </ol>
        </section>

        <section className="py-6">
          <div className="card-shell flex gap-3 p-4">
            <ShieldCheck className="size-5 shrink-0 text-brand" aria-hidden />
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              Google user data is used only to send the emails you create, from the Gmail account you
              connect. It is never sold or used for advertising. Read our{" "}
              <Link to="/privacy" className="font-semibold text-brand">Privacy Policy</Link>.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-xl border-t border-line px-4 py-3.5 text-center">
        <p className="text-[12px] text-ink-soft">Elite Connectere · AI-powered campaign workspace with Rex</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] font-medium text-ink">
          <a href="https://eliteconnectere.site" className="inline-flex items-center gap-1" aria-label="Elite Connectere website"><Globe className="size-3.5 text-brand" /> Website</a>
          <a href="https://www.youtube.com/@Eliteconnectere" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" aria-label="Elite Connectere on YouTube"><Youtube className="size-3.5 text-brand" /> YouTube</a>
          <a href="https://www.instagram.com/eliteconnectere" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" aria-label="Elite Connectere on Instagram"><Instagram className="size-3.5 text-brand" /> Instagram</a>
          <a href="https://www.facebook.com/EliteConnectere" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" aria-label="Elite Connectere on Facebook"><Facebook className="size-3.5 text-brand" /> Facebook</a>
          <a href="https://t.me/Eliteconnectere" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" aria-label="Elite Connectere on Telegram"><Send className="size-3.5 text-brand" /> Telegram</a>
        </p>
        <div className="mt-3 grid gap-3 text-left text-[11.5px] sm:grid-cols-3">
          <div>
            <p className="font-bold uppercase tracking-wider text-ink-soft">Public & info</p>
            <p className="mt-1 space-x-2 font-medium text-ink">
              <Link to="/">Home</Link>
              <Link to="/rex">Meet Rex AI</Link>
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
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/unsubscribe">Unsubscribe</Link>
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">Created by The Bloodline&#128175;</p>
      </footer>
    </div>
  );
}
