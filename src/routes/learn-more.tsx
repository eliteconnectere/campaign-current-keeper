import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { GOOGLE_REVIEW_MODE } from "@/lib/reviewMode";
import { REVIEW_HEAD, ReviewLearnMore } from "@/features/review/ReviewPages";

const URL = "https://eliteconnectere.site/learn-more";
const TITLE = GOOGLE_REVIEW_MODE
  ? REVIEW_HEAD.learn.title
  : "Elite Connectere Learn More — App guide, safety & rules";
const DESC = GOOGLE_REVIEW_MODE
  ? REVIEW_HEAD.learn.desc
  : "Explore Elite Connectere and Rex, the AI Workspace Agent designed to reason, create, and operate connected workspace features with user approval for consequential actions.";

export const Route = createFileRoute("/learn-more")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "https://eliteconnectere.site/icon-512.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: "https://eliteconnectere.site/icon-512.png" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: GOOGLE_REVIEW_MODE ? ReviewLearnMore : LearnMoreMasterGuide,
});

interface GuideSection {
  id: string;
  badge: string;
  title: string;
  summary: string;
  content: string[];
  examples?: { bad: string; reason: string; result: string }[];
}

const ABOUT_APP: GuideSection[] = [
  {
    id: "how-to-use",
    badge: "Getting started",
    title: "How do I use Elite Connectere?",
    summary: "A simple path from zero to your first campaign — no jargon.",
    content: [
      "Welcome to Elite Connectere — a bulk email campaign preparation, management and execution workspace powered by Rex AI. The campaign tools handle recipient lists, validation, personalisation, message generation, sender profiles, delivery pacing and campaign progress. Rex is the built-in AI Workspace Agent that works alongside those tools: describe what you want to achieve, and Rex can help plan the campaign, inspect workspace information, prepare content, review campaign details and operate connected app functions. You can use the campaign controls directly or work with Rex in natural language. The engine performs the mailing; Rex helps you direct and manage the process. For consequential operations such as sending, Rex presents the exact action for your approval before execution. Here is the usual flow.",
      "1. Create an account and open the workspace. Sign in the same way every time so your lists and profiles stay with you.",
      "2. Connect the Gmail you want to send from (Elite Engine). Only connect accounts you own and are allowed to use for outreach.",
      "3. Paste or import your recipient list. Write your subject and body before you validate.",
      "4. Tap Validate so we can clean obvious typos, dead domains, and duplicates before anything goes out.",
      "5. Set a sensible delay, confirm consent if asked, then Execute. Watch progress, pause if you need to, and check replies in Gmail later.",
      "6. Use the Guided Walkthrough (12 steps) the first time — it points at each control in order. You can turn tips off anytime under Settings.",
      "That is the heart of it. The sections below explain features, Gmail rules, and what will get a master login banned.",
    ],
  },
  {
    id: "pacing-delay",
    badge: "Our philosophy",
    title: "Yes — we intentionally make Elite slower",
    summary: "Not to frustrate you. To keep your Gmail alive so people can still reply.",
    content: [
      "Think of it this way: the real question is not “How many messages did I execute today?” The real question is “How many people replied — and is my Gmail still trusted tomorrow?”",
      "You can blast 5,000 in a rush and watch most of it sit in spam (or worse, get the account flagged). Someone who sends about 2,000 with a clean list, human pacing, and a clear message often gets more replies — and the same Gmail stays active.",
      "Mailing is not a race. Rushing does not create more revenue; it creates more spam signals. People who used other tools with millisecond-style sending often reported restricted or wiped Gmails. We do not want that ending for you.",
      "So if Elite feels “slow,” that is the product working. Protecting your reputation protects ours too.",
    ],
  },
  {
    id: "abuse-policy",
    badge: "Hard rules",
    title: "What you must not send — and what happens if you try",
    summary: "We do not soft-filter every bad word. Abuse gets the master login banned. Appeals go through Support.",
    content: [
      "Elite Connectere is built for legitimate, consented outreach — partnerships, updates, follow-ups, and professional communication people asked for.",
      "Do not use this platform for scams, advance-fee fraud, fake investment or crypto schemes, impersonation of banks or government, phishing, malware links, or any campaign designed to steal money or credentials. Do not run “get rich quick” or fake prize campaigns. Do not buy scraped lists and blast strangers who never opted in.",
      "We are not going to list every banned phrase and then play cat-and-mouse. If you choose to test the line, you learn the hard way: the master login can be suspended or permanently banned from Elite Engine. Connected Gmails that Google flags are auto-disconnected and enter the suspension ladder (5 days → 30 days → permanent Engine ban for that address). Standard Mode does not erase a master-login ban.",
      "If your account is restricted and you believe it was a mistake, open Support, submit a request, and wait for review. Do not open alternate master logins to dodge a ban — that is treated as the same abuse.",
      "Read this once. Connect only Gmails you are allowed to use. Send only to people who consented. Strategy and replies beat volume every time.",
    ],
  },
  {
    id: "gmail-profiles",
    badge: "Gmail connect",
    title: "Connecting and managing multiple Gmail accounts",
    summary: "Understand browser sign-ins, authorised Elite Engine senders, and your main Elite Connectere login before changing anything.",
    content: [
      "There are three separate layers: (1) Google accounts signed in or remembered by a browser; (2) Gmail sender profiles you have authorised inside Elite Engine; and (3) your main Elite Connectere login. An action affecting one layer does not automatically affect the other two.",
      "Our recommended approach is to install Brave and use it specifically for Elite Connectere. Download Brave from its official website: https://brave.com/download/. Open Brave, visit https://eliteconnectere.site, sign in with your existing Elite Connectere login, then choose Connect Gmail / Add more and authorise the Gmail address you want to add. You can also use another trusted browser. A separate browser has its own cookies and website sessions, so using Brave does not automatically sign you into Chrome or Safari, and signing out in Brave does not sign you out of those other browsers.",
      "When you connect a Gmail using Connect with Google, Google asks you to approve access and Elite Connectere receives an OAuth authorisation for the sending profile. The saved sender is associated with your Elite Connectere account; it does not depend on keeping the Google account signed into an open browser tab. Signing out of Google in a browser does not, by itself, delete the saved Elite Engine sender. If the authorisation is revoked, expires, or becomes unusable, Elite Engine may ask you to reconnect it.",
      "Google's account chooser uses the sign-in session and cookies in the browser where you start the connection. If it keeps showing the wrong Gmail, choose Use another account and enter the exact address you intend to connect. Check the address on Google's permission screen before approving. When many accounts have been used in one browser, switching can become confusing or the chooser may reuse a previous session. The exact behaviour varies; Google does not publish a universal fixed 10-account limit that applies to every browser and situation.",
      "If Google offers Remove from this device, that removes the selected account from the browser's remembered sign-in/chooser list in that browser. It does not delete the Google account, Gmail mailbox, messages, or the account from your phone's system settings. It also does not automatically disconnect a sender already authorised inside Elite Engine. Use it only for an account you do not need to select in that browser. If unsure, leave the account alone and use a separate browser instead.",
      "A private or Incognito window starts a separate temporary browser session and usually does not reuse the normal window's Google sign-in cookies. Open a private window, visit eliteconnectere.site, sign in to your existing Elite Connectere account, and connect the intended Gmail. When all private windows are closed, the temporary session's cookies and site data are normally cleared, so you may need to sign in again next time. This does not delete Gmail or a sender profile already saved to your Elite Connectere account.",
      "The red Sign out of Google in this browser button opens Google's own sign-out page. If you complete the sign-out, Google signs out the Google accounts in that browser session. You may need to sign in again to Gmail, YouTube, Drive, and other Google websites in that same browser. It does not delete Google accounts or mail, remove accounts from your phone, clear every other browser, sign you out of your Elite Connectere login, or revoke an OAuth permission already granted to Elite Engine. It also does not clear an Elite Engine restriction. Use it only if you are comfortable signing back in to Google in that browser.",
      "If the connection screen is stuck, first choose Use another account. If that does not work, use Brave or a private window. As a last resort, clear only eliteconnectere.site site data in the browser you are using, then reopen the site and sign in again. This signs you out of Elite Connectere in that browser but does not delete your account or its saved Gmail sender profiles. If Google's chooser itself is stuck, clearing Google's site data in that same browser may mean you need to sign in to Google again there. Avoid clearing all browsing data in your everyday browser if you want to preserve its other sessions.",
      "Each Gmail you successfully authorise is saved as a separate sending profile under the same Elite Connectere login. Adding a sender does not replace the senders already connected. Your available profile count depends on your plan. If Google says authorisation succeeded but the sender does not appear, do not keep repeating the connection; refresh the workspace once, check the sender list, then contact Support with the Gmail address and approximate time.",
      "A profile restriction inside Elite Engine is an application-level sending restriction. It is not proof that Google has suspended the entire Gmail account. If a profile disconnects automatically, check the status or reason shown in the workspace or contact Support. Possible causes include revoked or expired Google authorisation, a connection error, or an Elite Engine safety restriction. A failed send alone should not be described as a confirmed Google flag without evidence.",
      "Where Elite Engine policy records repeated flags against a connected address within the same calendar month, the published ladder is: first flag — the address is disconnected from Engine for 5 days and its monthly Engine capacity is reduced; second flag in that month — the Engine suspension extends to 30 days with a tighter capacity limit; third flag in that month — that Gmail address is permanently blocked from reconnecting to Elite Engine. These are Elite Engine restrictions on that sender's use in Engine; they do not delete the Google account or its mailbox. Do not repeatedly reconnect a restricted address to bypass a restriction; contact Support if you believe the status is wrong.",
      "Standard Mode may remain available when only one Gmail address is restricted from Elite Engine. However, Standard Mode does not override a suspension or ban on the master Elite Connectere login. A profile restriction applies to an individual sender; a master-login suspension or ban applies to the Elite Connectere account and can prevent access to the workspace and its features. Creating another login to bypass a restriction is not permitted.",
      "Scams, impersonation, phishing, malware, fake campaigns, and other abusive activity can lead to master-login enforcement. Read the abuse policy before sending. Disconnect a working sender inside Elite Engine only when you no longer intend to use it or Support advises you to do so; removing a Google sign-in from a browser and disconnecting an Elite Engine sender are different actions.",
    ],
  },
  {
    id: "guided-walkthrough",
    badge: "Tips",
    title: "Guided Walkthrough (12 steps) + optional tips",
    summary: "Mandatory order the first time. Toggle off when you already know the flow.",
    content: [
      "The Guided Walkthrough walks connect → recipients → message → validate → pace → review → execute. Validation is intentionally after list and message — empty boxes have nothing useful to clean.",
      "Tips are not meant to trap you forever. Under Settings you can turn workspace tips off, or restart the walkthrough when you want a refresher.",
      "Contextual tips only appear when the related control is on screen. They do not force every panel open at once.",
    ],
  },
];

const IN_APP_FEATURES: GuideSection[] = [
  {
    id: "two-modes",
    badge: "Sending paths",
    title: "Elite Engine + Standard Mode",
    summary: "Two ways to send. Different control. Different rules.",
    content: [
      "Elite Engine is the managed bulk-mailing path. It executes prepared campaign messages through Gmail profiles you connect with secure Google authorisation. It applies the platform's sending controls, including pacing, list hygiene, risky-address handling, duplicate protection and unsubscribe requirements. Connected profiles and daily limits are managed under your plan and the applicable account rules.",
      "Standard Mode is also designed for campaign workflows: it opens each prepared personalised message in your normal mail app, one recipient at a time. You review and press Send yourself; no Elite Engine sender connection is required.",
      "Both modes deliver the personalised messages generated from your campaign. Rex works alongside either path to help plan, prepare, review and manage the work. The delivery mode determines how the messages are sent; Rex helps you operate the workspace.",
    ],
  },
  {
    id: "delay-profiles",
    badge: "Pace & Gmail profiles",
    title: "Send delay + connected Gmail profiles",
    summary: "How fast messages leave, and which Gmail they leave from.",
    content: [
      "Delay is the pause between Elite sends. Free accounts start at a safer minimum; paid plans unlock slightly faster options. Very short 1s / 2s bursts stay closed on Elite because that pattern looks like a bot to Google.",
      "You can connect more than one Gmail. Active / standby profiles let you choose which account is sending. When a profile is exhausted or needs reconnect, the app can move to another connected profile — still under the same Elite rules.",
    ],
  },
  {
    id: "auto-prune",
    badge: "List hygiene",
    title: "Validate, Quarantine Vault + Permanent Send Protection",
    summary: "Clean the list before send, save risky rows safely, never spam the same person twice by accident.",
    content: [
      "Validate checks your pasted list for typos, dead domains, and duplicates. Bad rows should not ride on your Gmail reputation.",
      "Quarantine Vault keeps risky or unverified leads instead of throwing them away. You can export them or handle them later in Standard Mode if you choose.",
      "Permanent Send Protection blocks sending the same message to the same address again on Elite. Accidental double-sends are a common path to Report Spam. This stays on for everyone on Engine.",
    ],
    examples: [
      {
        bad: "sample@gmailll.com",
        reason: "Common typo — domain does not receive mail.",
        result: "Caught on Validate / pruned before Elite send.",
      },
      {
        bad: "name@fake-company.xyz",
        reason: "No real mail server (MX).",
        result: "Marked risky → Vault, not Elite blast.",
      },
      {
        bad: "ceo@domain.com (twice)",
        reason: "Same address pasted more than once.",
        result: "Deduped; protection blocks a second identical send.",
      },
    ],
  },
  {
    id: "templates-consent",
    badge: "Message & trust",
    title: "Templates, personalization + consent / unsubscribe",
    summary: "What people read, and how they can opt out with respect.",
    content: [
      "Templates A/B and {name} / {company} tokens help each line feel written for one person, not a blast.",
      "Before Elite sends, you confirm recipients opted in. Every Elite email includes a clear unsubscribe link.",
    ],
  },
  {
    id: "rex-ai",
    badge: "Agent Rex",
    title: "Meet Agent Rex — the workspace agent (not a generic chatbot)",
    summary: "Short overview only. Full can / cannot details live on the Agent Rex page.",
    content: [
      "Rex is the AI operating agent built into Elite Connectere's bulk email campaign and workspace platform. It works with the same campaign tools you use directly: recipient preparation, validation results, message drafting and personalisation, sender and timing checks, campaign review, monitoring and available campaign controls. You can ask Rex in natural language to help prepare a bulk campaign, inspect the relevant workspace information, explain what needs attention and guide the next step. The campaign engine handles the actual mailing; Rex helps you direct and manage it.",
      "Rex can also assist with other connected workspace features, navigation and owner-scoped tasks. Reading, analysing, drafting and routine workspace operations do not require a sending approval. Before an email campaign or Private Chat message is sent, Rex presents the exact action for your explicit approval. All actions remain subject to account permissions, plan limits and the platform's sending protections.",
      "For the full explanation of Rex's capabilities, boundaries and approval behaviour, open the Agent Rex guide.",
    ],
  },
  {
    id: "radar-chat",
    badge: "Workspace extras",
    title: "Elite Radar Hub + Private Chat (when unlocked)",
    summary: "Monitor health and talk to your team — not required for a basic send.",
    content: [
      "Elite Radar Hub is a live view around campaign health: progress, vault, and short message ideas you can apply to a template.",
      "Private Chat (on higher plans) is for people on the same workspace who need a quick private channel — separate from email campaigns.",
    ],
  },
  {
    id: "connection-sharing",
    badge: "Connection sharing",
    title: "Share workspace access (hotspot-style)",
    summary: "Invite as many members as your shared Gmail allocation can support, while keeping every person's private workspace separate.",
    content: [
      "Hotspot sharing gives invited members access to the eligible paid subscription's features under the owner's control. There is no fixed two-member cap. Each invitation must reserve at least one Gmail slot, and the owner can edit each member's allocation or revoke access.",
      "All Gmail slots come from one subscription pool. The owner's connected Gmails plus the Gmail slots reserved for every pending and active member cannot exceed the owner's plan limit. A pending invitation reserves its allocation immediately, so one member cannot be promised a slot that has already been allocated to someone else. If the plan has 75 Gmail slots and the owner uses 70, only five one-Gmail member allocations remain.",
      "Each member signs in with their own Elite Connectere account and connects their own Gmail accounts. Their Gmail authorisations, campaigns, contacts and private chat messages remain separate from the owner's. The owner can optionally share snippets; that is a separate permission and is off unless the owner enables it. Members cannot invite other people or manage the owner's subscription.",
      "Private Chat uses one Chat Energy battery for the whole shared subscription. When either the owner or an active member uses Private Chat, the same subscription-owned energy pool is updated, so activity by one person affects the percentage everyone sees. The meter drains while a Private Chat session is active and recovers while idle; it does not merge message histories or expose another person's conversations.",
      "The owner can edit the number of Gmail slots assigned to each member, with a minimum of one. Increasing an allocation is allowed only when enough unallocated slots remain. Revoking a member releases their reserved slots for the owner to reassign.",
    ],
  },
  {
    id: "best-practices",
    badge: "Habits",
    title: "What actually works day to day",
    summary: "Short checklist — strategy over volume.",
    content: [
      "Write people who already know you or clearly opted in. Scraped and purchased lists are the fastest way to spam folders and flags.",
      "If a Gmail came from another aggressive bulk tool, rest it a day or two before connecting it here.",
      "Judge the day by replies and a healthy inbox — not by how fast the counter moved.",
      "Mailing does not need to be rushed. Slow and trusted beats fast and flagged.",
    ],
  },
];

const HASH_ALIASES: Record<string, string> = {
  "strategy-not-volume": "pacing-delay",
  "duplicate-protection": "auto-prune",
  "delay-profiles": "delay-profiles",
  abuse: "abuse-policy",
  ban: "abuse-policy",
  multiaccount: "gmail-profiles",
  tips: "guided-walkthrough",
};

function SectionCard({ sec }: { sec: GuideSection }) {
  return (
    <article
      id={sec.id}
      className="scroll-mt-24 rounded-2xl border border-line bg-card p-6 shadow-sm transition hover:shadow-md sm:p-8"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-brand-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-brand">
          {sec.badge}
        </span>
      </div>
      <h3 className="mt-3 text-xl font-bold text-ink sm:text-2xl">{sec.title}</h3>
      <p className="mt-2 text-sm font-medium leading-relaxed text-ink/90 sm:text-base">{sec.summary}</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
        {sec.content.map((paragraph, idx) => {
          const parts = paragraph.split(/(https?:\/\/[^\s]+)/g);
          return (
            <p key={idx}>
              {parts.map((part, i) =>
                /^https?:\/\//.test(part) ? (
                  <a key={i} href={part} className="font-semibold text-brand underline underline-offset-2">{part.replace(/^https?:\/\//, "")}</a>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>
          );
        })}
      </div>
      {sec.examples && (
        <div className="mt-6 rounded-xl border border-line/60 bg-soft/50 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Examples</h4>
          <div className="mt-3 divide-y divide-line/40">
            {sec.examples.map((ex, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 py-2.5 text-xs first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <code className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono font-semibold text-red-500">
                    {ex.bad}
                  </code>
                  <span className="ml-2 text-ink-soft">— {ex.reason}</span>
                </div>
                <span className="shrink-0 font-medium text-emerald-600 sm:text-right">✓ {ex.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function LearnMoreMasterGuide() {
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    let id = (hash || (typeof window !== "undefined" ? window.location.hash : "") || "").replace(/^#/, "");
    if (!id) return;
    const alias = HASH_ALIASES[id];
    if (alias) id = alias;
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-brand/40");
        window.setTimeout(() => el.classList.remove("ring-2", "ring-brand/40"), 1800);
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <main className="min-h-screen bg-canvas text-ink antialiased">
      <header className="sticky top-0 z-20 border-b border-line bg-card/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/app" className="text-sm font-semibold text-brand hover:underline">
            ← Back to workspace
          </Link>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            Learn more
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Elite Connectere — Learn more
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
          Part 1: how the app works, Gmail rules, and hard abuse policy. Part 2: features inside the
          workspace and why they exist. Links from Connect Gmail → Learn More jump straight to the
          matching section.
        </p>

        <nav className="mt-8 space-y-3 text-[12px]">
          <div>
            <p className="mb-1.5 font-bold uppercase tracking-wider text-ink-soft">Part 1 · About the app</p>
            <div className="flex flex-wrap gap-2">
              {ABOUT_APP.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="rounded-full border border-line bg-card px-3 py-1 font-semibold text-ink hover:border-brand hover:text-brand"
                >
                  {sec.badge}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-bold uppercase tracking-wider text-ink-soft">Part 2 · Features inside the app</p>
            <div className="flex flex-wrap gap-2">
              {IN_APP_FEATURES.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="rounded-full border border-line bg-card px-3 py-1 font-semibold text-ink hover:border-brand hover:text-brand"
                >
                  {sec.badge}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div id="part-about" className="mt-12 scroll-mt-24">
          <h2 className="text-lg font-bold text-brand">Part 1 · About the app</h2>
          <p className="mt-1 text-sm text-ink-soft">What Elite Connectere is, how to start, and the hard rules.</p>
          <div className="mt-6 space-y-8">
            {ABOUT_APP.map((sec) => (
              <SectionCard key={sec.id} sec={sec} />
            ))}
          </div>
        </div>

        <div id="part-features" className="mt-16 scroll-mt-24">
          <h2 className="text-lg font-bold text-brand">Part 2 · Features inside the app</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Related tools are joined in one section. Each block says what it does and why we built it.
          </p>
          <div className="mt-6 space-y-8">
            {IN_APP_FEATURES.map((sec) => (
              <SectionCard key={sec.id} sec={sec} />
            ))}
          </div>
        </div>

        <footer className="mt-12 rounded-2xl border border-line bg-soft/40 p-6 text-center text-xs text-ink-soft">
          <p>
            Questions or appeals? Use{" "}
            <a href="/support" className="font-semibold text-brand underline">
              Support
            </a>
            — do not send policy questions only to a random inbox thread.
          </p>
          <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link to="/" className="font-semibold text-brand underline">Homepage</Link>
            <Link to="/privacy" className="font-semibold text-brand underline">Privacy Policy</Link>
            <Link to="/terms" className="font-semibold text-brand underline">Terms of Service</Link>
            <Link to="/rex" className="font-semibold text-brand underline">Meet Agent Rex</Link>
          </nav>
        </footer>
      </section>
    </main>
  );
}
