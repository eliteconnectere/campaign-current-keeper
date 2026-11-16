import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Mail, PenLine, Users, MousePointerClick, ShieldCheck, Unplug, ArrowRight } from "lucide-react";

/** Review-mode copy for public pages. Shown only while GOOGLE_REVIEW_MODE is true. */
export const REVIEW_HEAD = {
  home: {
    title: "Elite Connectere — Write Once, Send Personally to People You Know",
    desc: "Elite Connectere saves you from typing the same message again and again. Write one note for your friends, team or existing customers and send it to each person yourself from your own Gmail.",
  },
  privacy: {
    title: "Privacy Policy · Elite Connectere",
    desc: "How Elite Connectere uses the Gmail send permission, what we keep, what we never access, and how to disconnect at any time.",
  },
  terms: {
    title: "Terms of Service · Elite Connectere",
    desc: "The rules for using Elite Connectere: personal and team messages to people who know you, sent one at a time by you.",
  },
  learn: {
    title: "How Elite Connectere Works · Elite Connectere",
    desc: "Why Elite Connectere exists, how one-by-one sending works, and the Gmail permission it uses.",
  },
};

const UPDATED = "27 October 2026";

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
      <Mail className="size-5 text-brand" /> Elite <span className="text-brand">Connectere</span>
    </Link>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-3 text-[13px] text-ink-soft">
        <span>© 2026 Elite Connectere</span>
        <nav className="flex flex-wrap gap-4">
          <Link to="/learn-more">How it works</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <a href="mailto:eliteconnectere@gmail.com">Contact</a>
        </nav>
      </div>
    </footer>
  );
}

function Header() {
  return (
    <header className="border-b border-line px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
        <Brand />
        <Link to="/auth" className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink">Sign in</Link>
      </div>
    </header>
  );
}

const STEPS = [
  { icon: Users, t: "Add the people you know", d: "Paste the emails of your friends, team members or existing customers — or load a list you saved before." },
  { icon: PenLine, t: "Write your message once", d: "Use {name} and each person is greeted by their own name. No more retyping the same note." },
  { icon: MousePointerClick, t: "Send one by one, yourself", d: "Pick a person, confirm, and press Send. Each email goes from your own Gmail only when you click." },
  { icon: Unplug, t: "Disconnect anytime", d: "One button removes the app's access to your Gmail immediately." },
];

export function ReviewLanding() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Personal messages, without the retyping</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-ink sm:text-4xl">Write it once. Send it personally to the people you know.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Inviting friends to your birthday, reminding your team about a meeting, or updating your existing customers? Instead of typing the same message again and again, write it once in Elite Connectere and send it to each person yourself, from your own Gmail.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Get started <ArrowRight className="size-4" /></Link>
          <Link to="/learn-more" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink">How it works</Link>
        </div>
        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="border-t border-line pt-4">
              <Icon className="size-5 text-brand" />
              <h2 className="mt-2 text-[15px] font-semibold text-ink">{t}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{d}</p>
            </div>
          ))}
        </section>
        <section className="mt-12 border-l-2 border-brand bg-soft p-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><ShieldCheck className="size-5 text-brand" />Your Gmail stays yours</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            Elite Connectere asks Google for one permission only: to send an email you wrote, when you click Send. It cannot read your inbox, see your contacts, or delete anything. It is not for messaging strangers, and nothing is sent automatically.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-[12.5px] text-ink-soft">Last updated: {UPDATED}</p>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function S({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export function ReviewPrivacy() {
  return (
    <Doc title="Privacy Policy">
      <S title="1. Who we are">
        <p>Elite Connectere ("we", "us") is a web app that lets you write one message and send it, one person at a time, to friends, team members or existing customers from your own Gmail account. Contact: eliteconnectere@gmail.com.</p>
      </S>
      <S title="2. Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account details:</strong> your email address and sign-in information, used to create and secure your account.</li>
          <li><strong>Gmail connection:</strong> the address of the Gmail account you connect and the access token Google gives us so we can send on your behalf.</li>
          <li><strong>What you type:</strong> the recipient emails, subject and message you write. These stay in your browser session to prepare each email.</li>
          <li><strong>Saved lists:</strong> if you save a contact list, it is kept on your device so you can reuse it.</li>
          <li><strong>Basic usage counts:</strong> a count of messages sent per Gmail address, used to keep sending within fair daily limits.</li>
        </ul>
      </S>
      <S title="3. The Google permission we use">
        <p>We request only <strong>https://www.googleapis.com/auth/gmail.send</strong>. It lets the app send an email you wrote, when you click Send. We cannot read, search, change or delete emails in your inbox, and we do not access your Google contacts, calendar or files.</p>
      </S>
      <S title="4. How we use your information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To send the specific message you wrote to the person you selected.</li>
          <li>To show you which messages were sent in your current session.</li>
          <li>To keep your account secure and prevent abuse.</li>
        </ul>
        <p>We do not use your information for advertising, and we do not sell it.</p>
      </S>
      <S title="5. Google API Services User Data Policy">
        <p>Elite Connectere's use and transfer of information received from Google APIs adheres to the <a className="text-brand underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. Google user data is not transferred to others except as needed to provide the service, is not used for ads, is not read by humans unless you ask us for support or the law requires it, and is not used to train AI or machine-learning models.</p>
      </S>
      <S title="6. Sharing">
        <p>We share data only with the service providers that host the app and with Google, to deliver your email. We may disclose information if required by law.</p>
      </S>
      <S title="7. Storage and security">
        <p>We implement technical security measures to protect Google OAuth user data and sensitive information:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Encryption in Transit:</strong> Data sent between Elite Connectere and Google APIs is encrypted using HTTPS / TLS 1.3 protocol.</li>
          <li><strong>Encryption at Rest:</strong> Stored OAuth access tokens and authentication credentials are encrypted at rest using AES-256 encryption.</li>
          <li><strong>Security & Access Control:</strong> Access tokens are kept securely on our backend infrastructure, are never exposed in the browser, and are strictly used to execute user-initiated email requests.</li>
        </ul>
      </S>
      <S title="8. Retention and deletion">
        <p>Message text and recipient lists are not stored on our servers after sending. Click <strong>Disconnect Gmail</strong> to delete the app's Gmail access immediately; you can also remove access at <a className="text-brand underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>. Deleting your account removes your account details.</p>
      </S>
      <S title="9. Your choices">
        <p>You can sign out, disconnect Gmail, clear saved lists, or delete your account at any time. You may contact us to request a copy or deletion of your data.</p>
      </S>
      <S title="10. Children">
        <p>The app is not intended for anyone under 13.</p>
      </S>
      <S title="11. Changes">
        <p>We will update this page and the date above if this policy changes.</p>
      </S>
    </Doc>
  );
}

export function ReviewTerms() {
  return (
    <Doc title="Terms of Service">
      <S title="1. Agreement">
        <p>By using Elite Connectere you agree to these terms. If you do not agree, please do not use the app.</p>
      </S>
      <S title="2. What the app does">
        <p>Elite Connectere helps you avoid typing the same message many times. You write one message, then send it yourself, one person at a time, from your own Gmail account.</p>
      </S>
      <S title="3. Who you may message">
        <p>Only people who know you and expect to hear from you — such as friends, family, team members, or existing customers who agreed to receive your messages. You confirm this before sending.</p>
      </S>
      <S title="4. Not allowed">
        <ul className="list-disc space-y-1 pl-5">
          <li>Sending spam or unsolicited messages to strangers.</li>
          <li>Using bought, scraped or harvested email lists.</li>
          <li>Pretending to be someone else, phishing, or sending harmful content.</li>
          <li>Trying to get around Gmail limits or Google's policies.</li>
        </ul>
      </S>
      <S title="5. Your Gmail account">
        <p>You stay responsible for your Gmail account and for following Google's terms and <a className="text-brand underline" href="https://support.google.com/mail/answer/81126" target="_blank" rel="noopener noreferrer">Email Sender Guidelines</a>. You can disconnect it from the app at any time.</p>
      </S>
      <S title="6. Fair use">
        <p>Sending is limited per day to protect you and the people you message. Emails are sent only when you click Send.</p>
      </S>
      <S title="7. Suspension">
        <p>We may suspend accounts that break these terms or receive abuse reports.</p>
      </S>
      <S title="8. No warranty">
        <p>The app is provided "as is". We are not responsible for messages Google delays or rejects.</p>
      </S>
      <S title="9. Changes and contact">
        <p>We may update these terms and will change the date above. Questions: eliteconnectere@gmail.com.</p>
      </S>
    </Doc>
  );
}

export function ReviewLearnMore() {
  return (
    <Doc title="How Elite Connectere works">
      <S title="Why it exists">
        <p>When you need to tell several people the same thing — a birthday invitation, a team reminder, an update for existing customers — typing it again and again is tiring. Elite Connectere lets you write it once and greet each person by name with {"{name}"}.</p>
      </S>
      <S title="One by one, by you">
        <p>You choose a person, confirm they know you, and press Send. The button stays locked until that email finishes, then the next person is ready. Nothing is ever sent in the background.</p>
      </S>
      <S title="One permission only">
        <p>The app uses Gmail's send permission only. It cannot read your inbox. Disconnect Gmail removes its access instantly.</p>
      </S>
      <S title="Be a good sender">
        <p>Only message people who expect to hear from you, and follow <a className="text-brand underline" href="https://support.google.com/mail/answer/81126" target="_blank" rel="noopener noreferrer">Google's Email Sender Guidelines</a>.</p>
      </S>
    </Doc>
  );
}
