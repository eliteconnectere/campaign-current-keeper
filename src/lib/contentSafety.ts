/**
 * Lightweight pre-send content safety for Elite Engine.
 * Blocks clear phishing / bank-fraud patterns before any Gmail API send.
 * Not a full AI classifier — fast, offline, always on.
 */

export type SafetyHit = {
  blocked: boolean;
  reasons: string[];
  matched: string[];
};

/** High-confidence abuse patterns (phrase-level where possible). */
const PHRASE_RULES: { re: RegExp; reason: string }[] = [
  { re: /\b(send|share|give|confirm|verify).{0,40}\b(pin|password|otp|one[- ]time)\b/i, reason: "Requests PIN / password / OTP" },
  { re: /\b(bank|account).{0,30}\b(pin|password|cvv|security code)\b/i, reason: "Bank credential request" },
  { re: /\bi am (a |your )?banker\b/i, reason: "Impersonating a banker" },
  { re: /\bwire (transfer|money).{0,40}\b(urgent|immediately|now)\b/i, reason: "Urgent wire-transfer pressure" },
  { re: /\b(gift ?card|steam card|itunes card).{0,40}\b(code|pay|send)\b/i, reason: "Gift-card payment request" },
  { re: /\b(crypto|bitcoin|usdt|wallet).{0,30}\b(send|deposit|transfer).{0,20}\b(urgent|now)\b/i, reason: "Urgent crypto transfer ask" },
  { re: /\bverify your (account|identity).{0,40}\b(click|tap|link)\b/i, reason: "Credential phishing pattern" },
  { re: /\byour account will be (closed|suspended|terminated)\b/i, reason: "Fake account-threat language" },
  { re: /\bwestern union\b.{0,30}\b(send|money|urgent)\b/i, reason: "Western Union scam pattern" },
];

const WORD_RULES: { re: RegExp; reason: string }[] = [
  { re: /\bssn\b|\bsocial security number\b/i, reason: "Requests SSN" },
  { re: /\bcvv\b/i, reason: "Requests card CVV" },
];

export function scanCampaignContent(subject: string, body: string): SafetyHit {
  const text = `${subject || ""}\n${body || ""}`;
  const reasons: string[] = [];
  const matched: string[] = [];

  for (const rule of [...PHRASE_RULES, ...WORD_RULES]) {
    const m = text.match(rule.re);
    if (m) {
      reasons.push(rule.reason);
      matched.push(m[0].slice(0, 80));
    }
  }

  // De-dupe reasons
  const unique = [...new Set(reasons)];
  return {
    blocked: unique.length > 0,
    reasons: unique,
    matched: [...new Set(matched)],
  };
}

export function safetyBlockMessage(hit: SafetyHit): string {
  const why = hit.reasons.slice(0, 3).join("; ");
  return (
    "Campaign blocked by Elite safety filter. " +
    (why ? `Flagged: ${why}. ` : "") +
    "Remove requests for PINs, passwords, OTPs, bank secrets, or urgent money/gift-card instructions, then try again. " +
    "Legitimate business updates do not need those. Support: eliteconnectere@gmail.com"
  );
}
