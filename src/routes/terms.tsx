import { createFileRoute, Link } from "@tanstack/react-router";
import { GOOGLE_REVIEW_MODE } from "@/lib/reviewMode";
import { REVIEW_HEAD, ReviewTerms } from "@/features/review/ReviewPages";

export const Route = createFileRoute("/terms")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://eliteconnectere.site/terms" }],
    meta: [
      { property: "og:url", content: "https://eliteconnectere.site/terms" },
      { title: "Terms of Service · Elite Connectere" },
      {
        name: "description",
        content: GOOGLE_REVIEW_MODE ? REVIEW_HEAD.terms.desc : "The rules for using Elite Connectere, including Rex AI guidance, campaign responsibility, acceptable use, Gmail sending limits, and account controls.",
      },
      { property: "og:title", content: "Terms of Service · Elite Connectere" },
      {
        property: "og:description",
        content: GOOGLE_REVIEW_MODE ? REVIEW_HEAD.terms.desc : "The rules for using Elite Connectere: acceptable use, Gmail sending limits and account termination.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GOOGLE_REVIEW_MODE ? ReviewTerms : Terms,
});

const UPDATED = "7 November 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-1.5 space-y-2 text-[13px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function Terms() {
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white pb-10">
      <header className="border-b border-line px-4 py-3.5">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-ink">Elite Connectere</span>
          <Link to="/app" className="text-[12.5px] font-semibold text-brand">
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5">
        <h1 className="text-[22px] font-bold leading-tight text-ink">Terms of Service</h1>
        <p className="mt-1 text-[12px] text-ink-soft">Last updated: 9 November 2026</p>

        <Section title="Agreement to these Terms">
          <p>
            These Terms of Service govern access to and use of Elite Connectere, including its
            campaign workspace, Standard Mode, Elite Engine, recipient management, validation,
            personalisation, templates, campaign controls, Planner, Scratch Pad, Smart Fill,
            settings, and any related features.
          </p>
          <p>
            By using Elite Connectere, you agree to these Terms. If you do not agree, you should not
            use the service.
          </p>
          <p>
            You are responsible for how you use the service and for the campaigns, recipients, and
            content associated with your use.
          </p>
        </Section>

        <Section title="What Elite Connectere provides">
          <p>
            Elite Connectere is an email campaign workspace that helps users prepare, organise,
            personalise, validate, and send legitimate outbound email campaigns.
          </p>
          <p>
            Standard Mode prepares campaign messages for sending through the mail application
            configured on the user's device.
          </p>
          <p>
            Elite Engine allows users to connect their own Gmail accounts through Google OAuth and
            send campaign messages through the Gmail API.
          </p>
          <p>
            Elite Connectere provides tools that support campaign preparation and delivery. It does
            not guarantee delivery, inbox placement, engagement, responses, or any specific outcome.
          </p>
        </Section>

        <Section title="Rex AI Workspace Agent and AI-generated assistance">
          <p>
            Elite Connectere includes Rex, an AI Workspace Agent designed to understand natural-language
            instructions, reason about tasks, prepare content, and operate supported application
            features through authorized tools. Its available actions depend on the real application
            functions connected and enabled at the time; the intended agent scope is not a guarantee
            that every feature can already be operated through chat.
          </p>
          <p>
            When you use Rex, your messages and relevant campaign context may be processed by
            Google's Gemini API to generate a response. Do not submit passwords, OAuth tokens,
            payment credentials, confidential information, or information you do not have the
            right to share with an AI service. The AI provider's applicable terms and privacy
            practices also apply to that processing.
          </p>
          <p>
            AI responses, generated content, analysis, and proposed actions may be inaccurate or incomplete.
            You are responsible for reviewing important content, recipients, destinations, and
            campaign decisions. For consequential actions supported by Rex, the application is
            designed to show the exact proposed operation and require the user to tap its specific in-chat approval button before backend execution. Typing a confirmation alone does not authorize execution. Approval applies only to the exact action and details shown.
          </p>
          <p>
            Rex does not gain general access to your Gmail inbox or another user's private workspace
            simply because you use the agent. The AI model does not itself send messages or directly
            modify application records. Authorized application code performs supported operations
            after checking the signed-in user's permissions and any required approval. Existing
            security controls, sending limits, duplicate-send protection, and applicable laws remain
            in force. If a requested operation is not connected to Rex, Rex should say so rather
            than claim it has been performed.
          </p>
        </Section>

        <Section title="Eligibility and responsible use">
          <p>
            You must be legally able to enter into these Terms and to use email campaign
            functionality in your jurisdiction.
          </p>
          <p>
            You are responsible for ensuring that your campaigns comply with all laws and rules that
            apply to you, including anti-spam, marketing, communications, and data protection
            requirements.
          </p>
          <p>
            You are responsible for the accuracy and lawfulness of the recipient information you
            use.
          </p>
        </Section>

        <Section title="Standard Mode">
          <p>
            Standard Mode prepares the campaign message and passes it to the mail application
            configured on your device.
          </p>
          <p>
            Once the information is passed to your mail application or email provider, the sending
            process and its outcome are handled by those services.
          </p>
          <p>
            Elite Connectere is not responsible for how your device mail application or email
            provider handles, sends, delays, filters, or rejects a message.
          </p>
        </Section>

        <Section title="Elite Engine and connected Gmail profiles">
          <p>
            Elite Engine sends campaign messages through Gmail sending profiles that you have
            connected and authorised through Google OAuth.
          </p>
          <p>
            The number of Gmail sending profiles you may connect depends on your active plan or
            promotional privilege (for example, free trial, November community privilege, Starter,
            Standard, Premium, or Elite Studio ProMaxx). Plan limits range up to 75 profiles on the
            highest tier. Your live workspace shows the exact limit for your account.
          </p>
          <p>
            Elite Engine requires an eligible connected Gmail profile before a campaign can be sent.
          </p>
          <p>
            You are responsible for the Gmail accounts you connect and for ensuring that you are
            permitted to use them for your campaigns.
          </p>
          <p>
            You must comply with Google's applicable terms and policies when using connected
            Gmail accounts.
          </p>
          <p>You may disconnect a Gmail profile at any time.</p>
        </Section>

        <Section title="Sending limits and identity state">
          <p>
            Each Gmail identity used by Elite Engine has a daily sending allowance of no more than
            420 emails, randomised between 360 and 420.
          </p>
          <p>
            When an identity reaches its applicable allowance, it may enter an Exhausted state and
            remain unavailable for further Elite Engine sending until its recovery period has ended.
          </p>
          <p>
            Sending allowances, exhaustion status, and recovery information are maintained
            server-side against the Gmail identity.
          </p>
          <p>
            These controls are not reset by clearing application data, resetting the workspace,
            using Erase Data, reinstalling the application, or switching devices.
          </p>
          <p>
            Attempting to bypass, circumvent, manipulate, or interfere with these controls is a
            breach of these Terms.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            You may only contact recipients you are legally permitted to contact and who have a
            genuine reason to hear from you.
          </p>
          <p>
            You are responsible for honouring opt-out, unsubscribe, and similar requests promptly.
          </p>
          <p>You must not use Elite Connectere to:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>send spam or unsolicited bulk email</li>
            <li>use purchased, scraped, harvested, or otherwise improperly obtained lists</li>
            <li>send phishing, fraudulent, deceptive, or malicious content</li>
            <li>distribute malware or harmful code</li>
            <li>impersonate another person, business, or organisation</li>
            <li>harass, threaten, or abuse recipients</li>
            <li>infringe the rights of others</li>
            <li>breach any applicable law or regulation</li>
            <li>interfere with, disrupt, probe, or attack the service or its infrastructure</li>
            <li>attempt to bypass sending limits, security measures, or access controls</li>
          </ul>
        </Section>

        <Section title="Your content and data">
          <p>
            You retain responsibility for the recipients, templates, messages, campaign data, and
            other content you provide or generate through the service.
          </p>
          <p>
            You grant Elite Connectere permission to process that content only as necessary to
            provide the features you use.
          </p>
          <p>
            Clear Cache, Reset Workspace, and Erase Data are application-data controls. Erase Data
            removes stored application and workspace information, but it does not reset server-side
            sending allowances, Exhausted state, or recovery information associated with a Gmail
            identity.
          </p>
          <p>
            Removed application data is not automatically restored, and a Gmail profile must be
            connected and authorised again if you wish to use it afterwards.
          </p>
        </Section>

        <Section title="Availability and changes to the service">
          <p>
            Elite Connectere may change, suspend, limit, or discontinue features at any time,
            including where necessary for maintenance, security, legal compliance, or service
            improvement.
          </p>
          <p>
            The service may be unavailable from time to time due to factors inside or outside our
            control, including issues affecting Google, email providers, or other infrastructure.
          </p>
        </Section>

        <Section title="Suspension and termination">
          <p>
            Access may be suspended or terminated where there is spam, abuse, unlawful use, attempts
            to bypass sending limits, security risks, harm to recipients, harm to connected
            accounts, or breach of these Terms.
          </p>
          <p>
            You may stop using the service at any time, disconnect your Gmail profiles, and revoke
            the application's access from your Google Account security settings.
          </p>
        </Section>

        <Section title="Disclaimers">
          <p>
            The service is provided "as is" and "as available", without
            warranties of any kind, whether express or implied, to the maximum extent permitted by
            law.
          </p>
          <p>
            Elite Connectere does not warrant uninterrupted or error-free operation, specific
            deliverability, inbox placement, campaign performance, or any particular result.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, Elite Connectere is not liable for indirect,
            incidental, special, consequential, or punitive damages, or for loss of profits,
            business, goodwill, data, or opportunities.
          </p>
          <p>
            Elite Connectere is not liable for actions taken by Google or any email provider against
            your accounts, including restriction, suspension, or termination.
          </p>
          <p>Delivery outcomes depend on systems outside our control.</p>
        </Section>

        <Section title="Indemnity">
          <p>
            You agree to indemnify and hold Elite Connectere harmless from claims, liabilities,
            losses, damages, and expenses arising from your campaigns, your recipients, your
            content, your connected accounts, your breach of these Terms, or your breach of
            applicable law.
          </p>
        </Section>

        <Section title="Changes to these Terms">
          <p>
            These Terms may be updated to reflect changes in the service, its features, or
            applicable legal requirements.
          </p>
          <p>
            The updated version will be made available through the Terms of Service page, and the
            "Last updated" date will indicate when the Terms were most recently revised.
          </p>
          <p>Continued use of the service after an update constitutes acceptance of the updated Terms.</p>
        </Section>

        <Section title="Contact us">
          <p>
            For questions about these Terms, use the Support page so your request is routed
            correctly:
          </p>
          <p>
            <Link to="/support" className="font-semibold text-brand underline">
              eliteconnectere.site/support
            </Link>
          </p>
          <p className="text-[12px]">
            Support will direct you to the right channel. Avoid sharing passwords or full campaign
            lists in public messages.
          </p>
        </Section>
        <footer className="mt-8 border-t border-line pt-4 text-center text-[12px] text-ink-soft">
          <p className="font-semibold text-ink">Elite Connectere · AI-powered campaign workspace with Rex</p>
          <nav className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link to="/" className="underline underline-offset-2">Homepage</Link>
            <Link to="/rex" className="underline underline-offset-2">Meet Rex AI</Link>
            <Link to="/learn-more" className="underline underline-offset-2">Learn more</Link>
            <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
            <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link>
            <Link to="/support" className="underline underline-offset-2">Support</Link>
          </nav>
        </footer>
      
          <section className="mt-6 space-y-2">
            <h2 className="text-lg font-bold">Agent Rex</h2>
            <p className="text-[13px] leading-relaxed text-ink-soft">Agent Rex is Elite Connectere's in-product workspace agent. It may navigate registered features, prepare campaign work, and perform actions you authorize with in-chat approval. It does not get general access to your Gmail inbox. Full can/cannot guide: <a href="/rex" className="font-semibold text-brand underline">eliteconnectere.site/rex</a>.</p>
          </section>
</main>
    </div>
  );
}
