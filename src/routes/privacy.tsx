import { createFileRoute, Link } from "@tanstack/react-router";
import { GOOGLE_REVIEW_MODE } from "@/lib/reviewMode";
import { REVIEW_HEAD, ReviewPrivacy } from "@/features/review/ReviewPages";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://eliteconnectere.site/privacy" }],
    meta: [
      { property: "og:url", content: "https://eliteconnectere.site/privacy" },
      { title: "Privacy Policy · Elite Connectere" },
      {
        name: "description",
        content: GOOGLE_REVIEW_MODE ? REVIEW_HEAD.privacy.desc : "How Elite Connectere handles your campaign workspace, private campaign context, Rex AI processing, Gmail connections, and account data.",
      },
      { property: "og:title", content: "Privacy Policy · Elite Connectere" },
      {
        property: "og:description",
        content: GOOGLE_REVIEW_MODE ? REVIEW_HEAD.privacy.desc : "How Elite Connectere handles your Gmail connection, campaign data and server-side sending limits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GOOGLE_REVIEW_MODE ? ReviewPrivacy : Privacy,
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

function Privacy() {
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
        <h1 className="text-[22px] font-bold leading-tight text-ink">Privacy Policy</h1>
        <p className="mt-1 text-[12px] text-ink-soft">Last updated: 9 November 2026</p>

        <Section title="What Elite Connectere is">
          <p>
            Elite Connectere is a productivity and email campaign workspace designed to help users
            prepare, organise, personalise, validate, and send legitimate outbound email campaigns.
          </p>
          <p>
            The service provides two distinct sending methods. Standard Mode prepares email content
            for use through the user's own device mail application, while Elite Engine allows
            users to connect their own Gmail accounts through Google OAuth and send campaign
            messages through the Gmail API.
          </p>
          <p>
            This Privacy Policy explains what information Elite Connectere processes, why that
            information is required, how it is used and protected, how information is handled when
            Gmail accounts are connected, how application data is managed, and what choices are
            available to users.
          </p>
          <p>
            Information processed by Elite Connectere depends on the features a user chooses to use
            and the information the user provides, imports, generates, or connects through the
            service.
          </p>
        </Section>

        <Section title="Standard Mode">
          <p>
            Standard Mode allows users to prepare email campaigns using recipient information,
            message templates, personalisation, and other campaign details supplied within the
            application.
          </p>
          <p>
            To provide these functions, Elite Connectere may process recipient email addresses,
            recipient names or other personalisation fields, subject lines, message bodies,
            validation results, and generated personalised messages.
          </p>
          <p>
            When a user proceeds with a Standard Mode send, Elite Connectere prepares the relevant
            mailto information and passes it to the mail application configured on the user's
            device.
          </p>
          <p>
            The selected mail application and email provider then handle the actual sending process.
            Information transferred to those services may be subject to their own privacy policies,
            terms, and technical practices.
          </p>
          <p>
            Elite Connectere does not control the handling of information after it has been
            transferred to the user's selected mail application or email provider.
          </p>
        </Section>

        <Section title="Elite Engine">
          <p>
            Elite Engine is a separate sending system that uses authorised Gmail sending profiles to
            deliver campaign messages through the Gmail API.
          </p>
          <p>
            When Elite Engine is used, Elite Connectere may process the recipient list, campaign
            templates, subject lines, message bodies, personalised messages, campaign status,
            sending history, queue information, and other information necessary to execute the
            campaign selected by the user.
          </p>
          <p>
            Elite Engine requires an eligible connected Gmail sending profile before a campaign can
            be sent.
          </p>
          <p>
            Campaign messages are sent through the authorised Gmail identity rather than through the
            user's device mail application.
          </p>
          <p>
            Elite Engine may also use its automated campaign-scanning and preparation functions as
            part of campaign execution.
          </p>
        </Section>

        <Section title="Information we process">
          <p>Depending on the features a user uses, Elite Connectere may process:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Recipient email addresses and other recipient details supplied by the user</li>
            <li>Recipient validation and classification results</li>
            <li>Campaign recipient lists</li>
            <li>Template A and Template B content</li>
            <li>Subject lines and message bodies</li>
            <li>Generated personalised messages</li>
            <li>Campaign and sending history</li>
            <li>Planner and Scratch Pad entries</li>
            <li>Smart Fill History created from the user's recipient sets</li>
            <li>Application preferences and settings</li>
            <li>Information associated with connected Gmail sending profiles</li>
            <li>
              Google OAuth credentials or tokens required to maintain authorised Gmail connections
            </li>
            <li>
              Basic profile information supplied through Google authorisation, such as a Gmail
              address and display name
            </li>
            <li>
              Server-side sending counters and recovery information associated with connected Gmail
              identities
            </li>
          </ul>
          <p>
            The information processed depends on the features used and the information voluntarily
            entered, imported, generated, or connected by the user.
          </p>
        </Section>

        <Section title="Recipient information and validation">
          <p>
            Elite Connectere processes recipient information to provide recipient management,
            validation, classification, and campaign preparation features.
          </p>
          <p>
            The validation system may classify addresses as valid, invalid, or risky according to
            the information available to the service.
          </p>
          <p>
            Where personalisation is enabled, information supplied for a recipient may be used to
            generate a personalised version of the campaign message.
          </p>
          <p>
            Smart Fill may use the user's previously saved recipient sets where that
            functionality is enabled.
          </p>
          <p>
            The user remains responsible for ensuring that recipient information has been obtained
            and is being used appropriately and lawfully.
          </p>
        </Section>

        <Section title="Campaign content">
          <p>
            Elite Connectere processes campaign content because it is necessary to provide campaign
            preparation, personalisation, organisation, and sending functionality.
          </p>
          <p>
            This may include subject lines, message bodies, templates, generated variations,
            recipient-specific information, and campaign history.
          </p>
          <p>
            Campaign content is processed in connection with the user's use of the relevant
            features and is not collected for an unrelated purpose.
          </p>
        </Section>

        <Section title="Rex AI Workspace Agent and workspace context">
          <p>
            Rex is Elite Connectere's AI Workspace Agent. Its intended operating scope is the whole of the signed-in user's Elite Connectere workspace—not merely campaigns or the screen currently open. This includes the user's dashboard, campaign and recipient records, messaging, Snippets, Vault, Planner, Radar, Live Monitor, Activity Log, trackers, notifications, sending preferences, Rex Studio, and workspace settings. Rex can read or operate a feature only when the corresponding app data or authorized tool is connected. Capabilities are being wired into the real application progressively; this description does not mean every operation is already available through chat.
          </p>
          <p>
            When you ask Rex a question or request a task, the conversation needed to respond is
            processed by our server and, when AI generation is available, sent to Google's Gemini API
            to generate a response. The application may also provide relevant information from your
            own signed-in workspace to help Rex answer or prepare a task.
          </p>
          <p>
            Rex conversation history is saved to your signed-in account by default so you can return to
            a chat and continue where you left off. Conversation messages and compact continuity notes
            are stored in our Supabase database and are scoped to your account. In Settings → Rex Studio
            → Conversation Memory &amp; History, you can turn off future history saving, pause the use
            of previous conversations for AI context, delete individual conversations, or clear all
            saved Rex conversations. Turning off memory or history does not itself delete conversations.
            Saved conversations remain until you delete them; we do not apply an automatic chat-history
            expiry. Campaign execution and delivery records are stored separately and are not deleted
            when Rex chat history is cleared.
          </p>
          <p>
            When the Remember previous conversations setting is enabled, Rex may receive compact
            summaries from a small number of your earlier Rex conversations when generating a response.
            When that setting is paused, those previous-conversation summaries are not included.
          </p>
          <p>
            If your question is about a campaign, the app may provide Rex with relevant information from
            your own private, signed-in workspace, so Rex can review the campaign you are working on.
            This can include draft subject lines,
            message templates, generated campaign messages, recipient details, validation status,
            campaign progress, and recent activity. Campaign context is included only when the
            conversation is campaign-related and is limited to the current workspace information
            made available to Rex by the app.
          </p>
          <p>
            Rex is not granted general access to your Gmail inbox, Google contacts, Google Drive,
            or other users' workspaces. The Gmail API permission used for sending is separate from
            the campaign information you create or provide inside Elite Connectere. Rex cannot
            inspect another user's private campaign data. Any additional application capability
            must be explicitly connected to an authorized backend function and scoped to the
            signed-in user's permissions; a model response alone does not grant access.
          </p>
          <p>
            Google's handling of prompts and responses depends on the Gemini API service and
            billing configuration used by Elite Connectere, and is governed by Google's applicable
            terms and privacy documentation. We do not promise zero retention by the AI provider.
            Do not submit passwords, authentication tokens, payment credentials, or information
            you are not authorised to share with an AI service.
          </p>
          <p>
            Rex's responses and proposed plans are AI-generated and may be inaccurate or incomplete. Review important content and proposed actions. Rex can read and manage the signed-in owner's own workspace directly, subject to authentication, ownership, permissions, subscription entitlements, validation and applicable limits. Rex asks for an explicit in-chat approval only before sending an email campaign or a Private Chat message. Destructive account-data erasure remains a separate user-operated Settings flow with its own confirmation. Navigation and routine workspace actions do not require approval. The AI model itself does not directly execute database, Gmail, or other operations.
            Not every workspace operation is currently connected to Rex, and the app must not
            represent an unavailable tool as completed.
          </p>
        </Section>

        <Section title="Gmail authorisation and account information">
          <p>
            When a user connects a Gmail sending profile to Elite Engine, the user authorises Elite
            Connectere through Google OAuth.
          </p>
          <p>
            The authorisation may provide the Gmail address and display name associated with the
            account, together with the OAuth credentials or tokens required to maintain the
            authorised connection.
          </p>
          <p>
            This access is used to operate the connected sending profile, identify the Gmail sending
            identity, and send campaign messages through the Gmail API as authorised by the user.
          </p>
          <p>The number of connected Gmail sending profiles depends on your active plan or promotional privilege (up to 75 on Elite Studio ProMaxx). Your workspace shows the exact limit for your account.</p>
          <p>Users can disconnect individual Gmail profiles whenever they choose.</p>
          <p>
            Connecting a Gmail profile does not transfer ownership of the Google or Gmail account to
            Elite Connectere.
          </p>
        </Section>

        <Section title="Google user data: access, use, sharing, security and retention">
          <p>
            <strong>Scopes requested.</strong> Elite Connectere requests only{" "}
            <code>openid</code>, <code>email</code> and{" "}
            <code>https://www.googleapis.com/auth/gmail.send</code>. We do not read, list, search,
            modify or delete any message in your mailbox.
          </p>
          <p>
            <strong>Data accessed.</strong> Your Google account email address (to identify which
            Gmail profile is sending) and an OAuth refresh token that lets us send the messages you
            compose and start in the app. We do not access Gmail message content, contacts, Drive,
            Calendar or any other Google data. We do not create aggregated or anonymised datasets
            from Google user data.
          </p>
          <p>
            <strong>How it is used.</strong> Solely to send the emails you create and launch, from the
            Gmail account you connected, and to show which account sent them.
          </p>
          <p>
            <strong>Sharing.</strong> Google user data is not sold, rented or shared with anyone, and
            is never transferred to advertisers, data brokers or information resellers. It is
            processed only by our hosting/database provider to run the service.
          </p>
          <p>
            <strong>Security.</strong> Refresh tokens are encrypted (AES-GCM) before storage, kept only
            on our servers, never sent to the browser, and all traffic uses HTTPS/TLS.
          </p>
          <p>
            <strong>Retention and deletion.</strong> Tokens are kept only while the Gmail profile is
            connected. Disconnecting a profile revokes the token with Google and deletes it
            immediately. You can also revoke access at any time at
            https://myaccount.google.com/permissions, or email us to delete your account and all
            associated data within 30 days.
          </p>
          <p>
            <strong>Limited Use.</strong> Elite Connectere's use and transfer of information received
            from Google APIs adheres to the{" "}
            <a
              className="text-brand underline"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Google user data is not used for advertising,
            credit or lending decisions, and is not used to develop, improve or train generalised
            AI or machine-learning models, nor transferred to third-party AI services.
          </p>
          <p>
            <strong>Acceptable use.</strong> Elite Connectere is for sending messages to people who
            expect to hear from you. Unsolicited bulk/cold email, spam and email-warming are
            prohibited.
          </p>
        </Section>

        <Section title="Data Security & Protection Mechanisms">
          <p>
            We implement industry-standard technical and organizational security measures to protect
            Google OAuth user data and restricted scope data:
          </p>
          <ol className="list-decimal space-y-2 pl-4">
            <li>
              <strong>Encryption in Transit:</strong> All data transfers between Elite Connectere,
              our users, and Google API servers are encrypted using Secure Sockets Layer (SSL) /
              Transport Layer Security (TLS 1.3) protocols.
            </li>
            <li>
              <strong>Encryption at Rest:</strong> Stored OAuth access credentials, refresh tokens,
              and authentication data are encrypted at rest using AES-256 encryption within our
              Supabase infrastructure.
            </li>
            <li>
              <strong>Data Minimization & Retention:</strong> Email message content is processed
              on-demand for immediate user-directed dispatch. We do not permanently store or retain
              email body content on external servers post-delivery.
            </li>
            <li>
              <strong>Access Control:</strong> Strict Row Level Security (RLS) policies and
              authentication checks are enforced to isolate user accounts and prevent unauthorized
              access.
            </li>
            <li>
              <strong>Google Limited Use Compliance:</strong> Elite Connectere strictly adheres to
              the Google API Services User Data Policy, including the Limited Use requirements.
              Google OAuth data is never sold, shared with third parties, or used for advertising
              or inbox warming.
            </li>
          </ol>
        </Section>

        <Section title="Gmail messages and replies">
          <p>
            Elite Engine uses the connected Gmail identity to send campaign messages through the
            Gmail API.
          </p>
          <p>
            Replies to those messages are delivered to the normal Gmail inbox associated with the
            sending account.
          </p>
          <p>
            Elite Connectere does not treat the connected Gmail account as a general-purpose mailbox
            and does not receive ordinary campaign replies merely because the account was authorised
            for sending.
          </p>
          <p>
            Google remains responsible for its own Gmail services and for information processed
            within those services under Google's applicable terms and privacy practices.
          </p>
        </Section>

        <Section title="Elite Engine sending state">
          <p>Each Gmail identity used by Elite Engine has a server-side sending state.</p>
          <p>
            The applicable daily sending allowance for each identity is no more than 420 emails and
            is randomised between 360 and 420.
          </p>
          <p>
            When an identity reaches its applicable allowance, it may enter an Exhausted state and
            remain unavailable for further Elite Engine sending until its applicable recovery period
            has ended.
          </p>
          <p>
            The sending counter and recovery state are associated with the Gmail identity rather
            than only with the user's device or local installation.
          </p>
          <p>
            This allows Elite Engine to maintain the correct sending status of a Gmail identity even
            when the user changes devices or reinstalls the application.
          </p>
        </Section>

        <Section title="Application data and server-side sending state">
          <p>
            Elite Connectere treats ordinary application data separately from the server-side
            sending state associated with a Gmail identity.
          </p>
          <p>
            Application data may include recipients, campaign history, generated campaign
            information, Planner and Scratch Pad entries, Smart Fill History, settings, and
            connected profile information.
          </p>
          <p>
            The server-side sending state exists specifically to maintain the sending allowance,
            exhaustion status, and recovery information associated with a Gmail identity.
          </p>
          <p>
            Deleting application data does not restore or recreate a previous workspace, and it does
            not reset the sending state associated with a Gmail identity.
          </p>
          <p>
            If the same Gmail identity is connected again later, its applicable server-side sending
            state may still be recognised.
          </p>
        </Section>

        <Section title="Data management and deletion">
          <p>
            Elite Connectere provides Clear Cache, Reset Workspace, and Erase Data as separate
            application-data controls.
          </p>
          <p>
            Clear Cache is intended for temporary or cached information and is not a complete
            deletion of the user's workspace.
          </p>
          <p>
            Reset Workspace provides a broader reset of active workspace information while
            preserving information that is outside the scope of that reset.
          </p>
          <p>
            Erase Data is the most comprehensive application-data deletion option. It removes the
            stored application and workspace information required to return the application to a
            fresh state.
          </p>
          <p>
            Depending on the information stored at the time, Erase Data may remove recipient lists,
            validation information, campaign history, generated campaign information, queue and
            progress information, Planner and Scratch Pad entries, Smart Fill History, application
            settings, and connected Gmail profile information.
          </p>
          <p>After Erase Data, previously removed application information is not automatically restored.</p>
          <p>
            A Gmail profile that the user wishes to use again must be manually connected and
            authorised again.
          </p>
          <p>
            Erasing application data does not reset the server-side sending allowance, Exhausted
            state, or recovery information associated with a Gmail identity.
          </p>
        </Section>

        <Section title="How information is used">
          <p>
            Information processed by Elite Connectere is used to provide and maintain the functions
            associated with the user's use of the service.
          </p>
          <p>
            This includes processing information to prepare and send campaigns, validate recipients,
            generate personalised messages, maintain campaign history, operate Smart Fill and
            workspace features, manage connected Gmail profiles, maintain sending states, protect
            the service, respond to legitimate support or privacy requests, and comply with
            applicable legal requirements where necessary.
          </p>
        </Section>

        <Section title="Storage and security">
          <p>
            Elite Connectere takes reasonable measures to protect information against unauthorised
            access, alteration, disclosure, misuse, or destruction.
          </p>
          <p>
            Information handled by the service is protected using security measures appropriate to
            the nature of the information and the functions being provided, including encryption in
            transit and at rest as detailed in the Data Security & Protection Mechanisms section
            above.
          </p>
        </Section>

        <Section title="Your rights and choices">
          <p>
            Users may disconnect Gmail profiles, clear or erase application data, and request
            access, correction, deletion, or other forms of control over that information.
          </p>
          <p>
            Users may also request deletion of information associated with their use of the service
            by contacting Elite Connectere.
          </p>
          <p>
            Some information may be retained where it is reasonably necessary for security,
            operational, legal, or compliance purposes.
          </p>
          <p>
            Deleting local application data does not automatically remove server-side sending
            information that is required to maintain the sending state of a Gmail identity.
          </p>
        </Section>

        <Section title="Children's privacy">
          <p>
            Elite Connectere is intended for users who are legally able to use the service and its
            email campaign functionality.
          </p>
          <p>
            The service is not intentionally designed to collect personal information from children
            for independent use.
          </p>
          <p>
            If you believe that personal information belonging to a child has been provided to Elite
            Connectere in circumstances where it should not have been collected, you may contact us
            so that the matter can be reviewed.
          </p>
        </Section>

        <Section title="Changes to this Privacy Policy">
          <p>
            Elite Connectere may update this Privacy Policy when necessary to reflect changes in the
            service, its features, information practices, security measures, or applicable legal
            requirements.
          </p>
          <p>
            The updated version will be made available through the Privacy Policy page, and the
            "Last updated" date will indicate when the policy was most recently revised.
          </p>
          <p>
            Users are encouraged to review the Privacy Policy periodically so that they remain
            informed about how information is handled.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            For questions about this Privacy Policy, requests concerning personal information,
            deletion requests, or other privacy-related matters, use Support so your request is
            routed correctly:
          </p>
          <p>
            <Link to="/support" className="font-semibold text-brand underline">
              eliteconnectere.site/support
            </Link>
          </p>
          <p className="text-[12px]">
            Support will direct you to the right channel. Do not send passwords or full campaign
            recipient lists in public messages.
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
