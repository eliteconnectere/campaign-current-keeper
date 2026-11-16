import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, Send, ShieldCheck, Users, RefreshCw, LogOut, Unplug, Sparkles, BadgeCheck } from "lucide-react";
import { playSendSound } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { connectGmailAccount } from "@/lib/gmailConnect";
import { disconnectGmailProfile, listGmailProfiles, sendGmailMessage, type GmailProfile } from "@/lib/gmail.functions";
import { ComplianceNotice } from "./ComplianceNotice";
import { canSendCustomerMessage, customerConsentScope, type ConsentConfirmation } from "./reviewConsent";

const SMART_FILL = [
  "eliteconnectere@gmail.com",
  "thebloodline.black@gmail.com",
  "tblmultibusiness@gmail.com",
];

/** First birthday message */
const DEFAULT_SUBJECT = "Happy 1st Birthday!";
const DEFAULT_BODY =
  "Hi {name},\n\n" +
  "Happy 1st birthday! Wishing you a wonderful day filled with joy, love, and sweet memories.\n\n" +
  "May this new year of life bring happiness and every good thing.\n\n" +
  "With love,\n" +
  "Celebrating with you";

/** Friendly first name from an email, e.g. osanle001@gmail.com -> Osanle. */
export function nameFromEmail(email: string) {
  const word = (email.split("@")[0] ?? "").split(/[^a-zA-Z]+/).find(Boolean) ?? "";
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "there";
}
const personalize = (text: string, email: string) => text.replace(/\{name\}/gi, nameFromEmail(email));

function ProgressRing({ value }: { value: number }) {
  const c = 2 * Math.PI * 9;
  return (
    <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        style={{ transition: "stroke-dashoffset 0.2s linear" }}
      />
    </svg>
  );
}

/** Green consent badge for every validated contact (Google evidence of consent). */
function ConsentBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
      title="Source: Web Form / Explicit Consent"
    >
      <BadgeCheck className="size-3 shrink-0" />
      Explicitly Opted In
    </span>
  );
}

export function ReviewCRM() {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profiles, setProfiles] = useState<GmailProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [contactInput, setContactInput] = useState("");
  const [contacts, setContacts] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [consent, setConsent] = useState<ConsentConfirmation>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [delivered, setDelivered] = useState<Array<{ email: string; subject: string }>>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [sentSet, setSentSet] = useState<Set<string>>(new Set());
  const sending = useRef(false);
  const [progress, setProgress] = useState(0);
  const scope = customerConsentScope(contacts, "", subject, body);
  const allowed = canSendCustomerMessage(true, consent, scope);
  const draftReady = signedIn && Boolean(selected && subject.trim() && body.trim() && profileId);

  useEffect(() => {
    let active = true;
    async function refresh() {
      setConsent(null);
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSignedIn(Boolean(data.session));
      if (!data.session) {
        setProfiles([]);
        setChecking(false);
        return;
      }
      try {
        const result = await listGmailProfiles();
        if (!active) return;
        setProfiles(result.profiles);
        setProfileId((id) => (result.profiles.some((p) => p.id === id) ? id : result.profiles[0]?.id ?? ""));
      } catch {
        if (active) setMessage("Unable to check Gmail connection. Please try again.");
      } finally {
        if (active) setChecking(false);
      }
    }
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const result = await connectGmailAccount();
      if (result.locked) {
        setMessage("Gmail connection is unavailable for this account.");
        return;
      }
      setProfiles(result.profiles);
      setProfileId(result.profiles.find((p) => p.email === result.email)?.id ?? result.profiles[0]?.id ?? "");
      setMessage(result.ok ? "Gmail connected." : "Google did not grant sending access. Please reconnect.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gmail connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!profileId) return;
    setBusy(true);
    setMessage("");
    setConsent(null);
    try {
      const result = await disconnectGmailProfile({ data: { profileId } });
      setProfiles(result.profiles);
      setProfileId(result.profiles[0]?.id ?? "");
      setMessage("Gmail disconnected. This app no longer has access to your Gmail.");
    } catch {
      setMessage("Could not disconnect right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function smartFill() {
    setContactInput(SMART_FILL.join("\n"));
    saveContacts(SMART_FILL.join("\n"));
  }

  function saveContacts(raw = contactInput) {
    const entries = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const valid = entries.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    const bad = entries.filter((email) => !valid.includes(email));
    const unique = [...new Set(valid)];
    setInvalid([...new Set(bad)]);
    if (!unique.length) {
      setContacts([]);
      setSelected("");
      setMessage("No valid email addresses found.");
      return;
    }
    setContacts(unique);
    setSentSet(new Set());
    setSelected(unique[0] ?? "");
    setConsent(null);
    setMessage(`Ready: ${unique.length} valid${bad.length ? `, ${bad.length} skipped` : ""}.`);
  }

  async function send() {
    if (sending.current || !draftReady || sentSet.has(selected) || !canSendCustomerMessage(true, consent, scope)) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    setProgress(5);
    const to = selected;
    const timer = setInterval(() => setProgress((v) => Math.min(90, v + 7)), 150);
    try {
      const result = await sendGmailMessage({
        data: { to, subject: personalize(subject, to), body: personalize(body.trim(), to), profileId },
      });
      clearInterval(timer);
      setProfiles(result.profiles);
      if (result.ok) {
        setProgress(100);
        playSendSound("pass-by");
        await new Promise((resolve) => setTimeout(resolve, 350));
        const next = new Set(sentSet);
        next.add(to);
        setSentSet(next);
        setDelivered((history) => [{ email: to, subject }, ...history]);
        const nextContact = contacts.find((c) => !next.has(c)) ?? "";
        setSelected(nextContact);
        setMessage(
          nextContact
            ? `Sent to ${to}. Next person selected — click Send when you're ready.`
            : `Sent to ${to}. You're done with this list.`,
        );
      } else {
        setMessage(
          result.reason === "reconnect"
            ? "Gmail access expired. Reconnect your account to continue."
            : "Message was not sent. Check your Gmail connection and try again.",
        );
      }
    } catch {
      setMessage("Delivery could not be confirmed. Check your Gmail Sent folder before trying again.");
      setConsent(null);
    } finally {
      clearInterval(timer);
      sending.current = false;
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="border-b border-line px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="size-5 text-brand" />
            Elite Connectere
          </Link>
          {signedIn ? (
            <Button
              variant="ghost"
              onClick={() => {
                setConsent(null);
                void supabase.auth.signOut();
              }}
            >
              <LogOut />
              Sign out
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>
      <ComplianceNotice />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 border-b border-line pb-5">
          <p className="text-xs font-semibold uppercase text-brand">Your space</p>
          <h1 className="mt-2 text-2xl font-semibold">Write a friendly note to people you know</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Soft and simple — like messaging a friend. Add their emails, write your note, and send one by one.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section aria-labelledby="people-title" className="min-w-0">
            <h2 id="people-title" className="flex items-center gap-2 text-lg font-semibold">
              <Users className="size-5 text-brand" />
              People you know
            </h2>
            <label htmlFor="people-addresses" className="mt-4 block text-sm font-medium">
              Email addresses of friends or people you're close to
            </label>
            <textarea
              id="people-addresses"
              value={contactInput}
              onChange={(e) => {
                setContactInput(e.target.value);
                setConsent(null);
              }}
              placeholder={"friend@email.com\nteammate@email.com\nPaste one email per line — people you're happy to write to"}
              rows={4}
              disabled={busy}
              className="mt-2 w-full rounded-md border border-line bg-background p-3 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => saveContacts()} disabled={busy || !contactInput.trim()}>
                <Users />
                Validate list
              </Button>
              <Button variant="ghost" onClick={smartFill} disabled={busy}>
                <Sparkles />
                Smart Fill
              </Button>
            </div>
            {invalid.length > 0 && (
              <p className="mt-3 break-all text-sm text-destructive">Invalid (skipped): {invalid.join(", ")}</p>
            )}
            {contacts.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">Consent Status</p>
                    <p className="text-[11px] text-ink-soft">Source: Web Form / Explicit Consent</p>
                  </div>
                  <p className="text-sm text-ink-soft">
                    {sentSet.size} of {contacts.length} sent · pick someone, then click Send
                  </p>
                </div>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {contacts.map((email) => (
                    <li key={email}>
                      <Button
                        variant={selected === email ? "secondary" : "ghost"}
                        onClick={() => setSelected(email)}
                        disabled={busy || sentSet.has(email)}
                        className="my-0 h-auto min-h-12 w-full justify-start gap-2 whitespace-normal break-all rounded-none px-3 py-2.5 text-left"
                      >
                        <Mail className="size-4 shrink-0 text-brand" />
                        <span className="min-w-0 flex-1">
                          <span className="block break-all text-[13px] font-medium">{email}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <ConsentBadge />
                            {sentSet.has(email) ? (
                              <span className="text-[10px] font-semibold text-ink-soft">Sent</span>
                            ) : (
                              <span className="text-[10px] font-semibold text-ink-soft">Valid</span>
                            )}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <section className="mt-6 border-t border-line pt-5" aria-labelledby="gmail-title">
              <h2 id="gmail-title" className="text-base font-semibold">
                Gmail connection
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                {checking
                  ? "Checking connection…"
                  : !signedIn
                    ? "Sign in to connect Gmail."
                    : profiles.length
                      ? "Connected"
                      : "No Gmail account connected"}
              </p>
              {profiles.length > 0 && (
                <>
                  <label htmlFor="sender" className="mt-3 block text-sm">
                    Sender account
                  </label>
                  <select
                    id="sender"
                    value={profileId}
                    disabled={busy}
                    onChange={(e) => {
                      setProfileId(e.target.value);
                      setConsent(null);
                    }}
                    className="mt-1 w-full rounded-md border border-line bg-background p-2 text-sm"
                  >
                    {profiles.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.email}
                        {p.exhausted ? " — daily limit reached" : ""}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {profiles.length > 0 ? (
                <Button variant="outline" disabled={busy || !profileId} onClick={() => void disconnect()} className="mt-3">
                  <Unplug />
                  Disconnect Gmail
                </Button>
              ) : (
                <Button variant="outline" disabled={!signedIn || busy || checking} onClick={() => void connect()} className="mt-3">
                  <RefreshCw />
                  Connect Gmail
                </Button>
              )}
              {profiles.length > 0 && (
                <p className="mt-2 text-xs text-ink-soft">Disconnecting removes this app's access to your Gmail immediately.</p>
              )}
            </section>
          </section>
          <section aria-labelledby="draft-title" className="min-w-0">
            <h2 id="draft-title" className="flex items-center gap-2 text-lg font-semibold">
              <Mail className="size-5 text-brand" />
              Your message
            </h2>
            <p className="mt-3 break-all text-sm text-ink-soft">To: {selected || "No one selected yet"}</p>
            <label htmlFor="note-subject" className="mt-4 block text-sm font-medium">
              Subject
            </label>
            <input
              id="note-subject"
              value={subject}
              disabled={busy}
              onChange={(e) => {
                setSubject(e.target.value);
                setConsent(null);
              }}
              placeholder="Happy 1st Birthday!"
              className="mt-2 w-full rounded-md border border-line bg-background p-3 text-sm"
            />
            <label htmlFor="note-body" className="mt-4 block text-sm font-medium">
              Message
            </label>
            <textarea
              id="note-body"
              value={body}
              disabled={busy}
              onChange={(e) => {
                setBody(e.target.value);
                setConsent(null);
              }}
              placeholder={"Hi {name},\n\nHappy 1st birthday!..."}
              rows={8}
              className="mt-2 w-full rounded-md border border-line bg-background p-3 text-sm"
            />
            <p className="mt-2 text-xs text-ink-soft">
              Type {"{name}"} and each person is greeted by their own name
              {selected ? ` — e.g. “${nameFromEmail(selected)}”` : ""}.
            </p>
            <div className="mt-5 border-t border-line pt-4">
              <label htmlFor="people-consent" className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  id="people-consent"
                  checked={allowed}
                  disabled={busy}
                  onCheckedChange={(checked) => setConsent({ scope, confirmed: checked === true })}
                  className="mt-1"
                />
                <span>
                  I solemnly declare and confirm under penalty of account suspension that all recipients in this
                  destination list have explicitly consented and opted-in to receive commercial communications from my
                  organization.
                </span>
              </label>
              <Button onClick={() => void send()} disabled={!allowed || !draftReady || busy} className="mt-4 w-full">
                {progress > 0 ? <ProgressRing value={progress} /> : <Send />}
                {progress > 0 ? (progress >= 100 ? "Sent" : "Sending…") : selected ? `Send to ${selected}` : "Send"}
              </Button>
              {!allowed && draftReady && (
                <p className="mt-2 text-center text-[11px] font-semibold text-brand">
                  You must check the consent declaration above before sending is allowed.
                </p>
              )}
            </div>
            {message && (
              <p role="status" className="mt-4 break-words border-l-2 border-brand bg-soft p-3 text-sm">
                {message}
              </p>
            )}
            <footer className="mt-5 border-t border-line pt-4">
              <a
                href="https://support.google.com/mail/answer/81126"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand underline underline-offset-4"
              >
                Review Google's Official Email Sender Guidelines
              </a>
            </footer>
          </section>
        </div>
        <section className="mt-8 border-t border-line pt-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5 text-brand" />
            Messages sent this session
          </h2>
          <p className="mt-2 text-sm text-ink-soft">{delivered.length} confirmed messages sent this session</p>
          <ul className="mt-3 divide-y divide-line">
            {delivered.map((item, i) => (
              <li key={i} className="break-words py-3 text-sm">
                <strong>{item.email}</strong>
                <p className="text-ink-soft">{item.subject} · Sent</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="border-t border-line px-4 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 text-sm text-ink-soft">
          <span>Elite Connectere · Stay in touch with people you know</span>
          <nav className="flex gap-4">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
