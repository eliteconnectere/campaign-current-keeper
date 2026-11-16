export type Status = "valid" | "duplicate" | "risky";

export type Recipient = {
  email: string;
  name: string;
  company: string;
  status: Status;
  reason: string;
};

export type Generated = {
  id: number;
  email: string;
  name: string;
  company: string;
  template: "A" | "B";
  subject: string;
  body: string;
  sent: boolean;
};

export type Profile = {
  id: number;
  name: string;
  email: string;
  limit: number;
  used: number;
  /** epoch ms until which the profile is resting after hitting its cap */
  exhaustedUntil: number | null;
};

/** how long an exhausted Gmail profile rests before rejoining the rotation */
export const RECOVERY_MS = 60_000;

const FIRST = [
  "sophie",
  "daniel",
  "wei.chen",
  "maria",
  "amara",
  "tobias",
  "lucas",
  "ines",
  "hiro",
  "nadia",
  "peter",
  "elena",
  "omar",
  "clara",
  "jonas",
  "yuki",
  "aisha",
  "marco",
  "leila",
  "victor",
];

const NAMES: Record<string, string> = {
  sophie: "Sophie",
  daniel: "Daniel",
  "wei.chen": "Wei Chen",
  maria: "Maria",
  amara: "Amara",
  tobias: "Tobias",
  lucas: "Lucas",
  ines: "Ines",
  hiro: "Hiro",
  nadia: "Nadia",
  peter: "Peter",
  elena: "Elena",
  omar: "Omar",
  clara: "Clara",
  jonas: "Jonas",
  yuki: "Yuki",
  aisha: "Aisha",
  marco: "Marco",
  leila: "Leila",
  victor: "Victor",
};

const DOMAINS: [string, string][] = [
  ["gmail.com", "Google"],
  ["outlook.com", "Microsoft"],
  ["yahoo.com", "Yahoo"],
  ["icloud.com", "Apple"],
  ["northlane.fr", "Northlane"],
  ["unreachable-testmail.invalid", "TestCorp"],
  ["fake-dead-domain.xyz", "DeadMail"],
  ["proton.me", "Proton"],
];

export function buildSmartFill(total = 1003): Recipient[] {
  const list: Recipient[] = [];
  for (let i = 0; i < total; i++) {
    const handle = FIRST[i % FIRST.length] ?? "sophie";
    const pair = DOMAINS[i % DOMAINS.length] ?? ["northlane.fr", "Northlane"];
    const domain = pair[0];
    const company = pair[1];
    const suffix = i < FIRST.length ? "" : String(Math.floor(i / FIRST.length));
    list.push({
      email: `${handle}${suffix}@${domain}`,
      name: NAMES[handle] ?? "Friend",
      company,
      status: "valid",
      reason: "Syntax and domain look deliverable",
    });
  }
  return list;
}

const KNOWN_TYPO_DOMAINS = new Set([
  "gmaill.com", "gmai.com", "gmial.com", "gamil.com", "gmaill.con", "gmail.con",
  "yaho.com", "yahooo.com", "yaho.con", "yahoo.con",
  "hotmial.com", "hotmai.com", "hotmaill.com", "hotmail.con",
  "outlok.com", "outloo.com", "outlook.con"
]);

export function parseList(raw: string): Recipient[] {
  const found = raw.match(/[^\s,;<>"']+@[^\s,;<>"']+/g) ?? [];
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const rawEmail of found) {
    const email = rawEmail.replace(/[.,;]+$/, "").toLowerCase();
    const isDuplicate = seen.has(email);
    seen.add(email);

    const handle = email.split("@")[0] ?? "";
    const domain = email.split("@")[1] ?? "";
    const name =
      (handle.split(/[._-]/)[0] ?? "there").charAt(0).toUpperCase() +
      (handle.split(/[._-]/)[0] ?? "there").slice(1);
    const company =
      (domain.split(".")[0] ?? "").charAt(0).toUpperCase() + (domain.split(".")[0] ?? "").slice(1);

    const formatOk = /^[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i.test(email);
    const isTypoDomain = KNOWN_TYPO_DOMAINS.has(domain);

    const status = isDuplicate ? "duplicate" : ((!formatOk || isTypoDomain) ? "risky" : "valid");
    const reason = isDuplicate
      ? "This email address appears more than once in the imported list; quarantined before sending."
      : !formatOk
        ? "Malformed address syntax"
        : isTypoDomain
          ? `Known invalid domain typo (${domain})`
          : "Valid format; ready for sending";

    out.push({
      email,
      name,
      company,
      status,
      reason,
    });
  }
  return out;
}

/** Parse a plain-text or CSV recipient file, retaining name/company columns when supplied. */
export function parseRecipientFileText(raw: string): Recipient[] {
  const source = raw.replace(/^\uFEFF/, "").trim();
  if (!source) return [];
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { cells.push(value.trim()); value = ""; }
      else value += char;
    }
    cells.push(value.trim());
    return cells;
  };
  const header = parseRow(firstLine).map(value => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const emailIndex = header.findIndex(value => ["email", "emailaddress", "e-mail", "mail"].includes(value));
  if (emailIndex < 0) return parseList(source);
  const nameIndex = header.findIndex(value => ["name", "fullname", "contactname", "firstandlastname"].includes(value));
  const companyIndex = header.findIndex(value => ["company", "organization", "organisation", "business"].includes(value));
  const seen = new Set<string>();
  const result: Recipient[] = [];
  for (const line of source.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells = parseRow(line);
    const email = (cells[emailIndex] ?? "").trim().toLowerCase();
    if (!email) continue;
    const isDuplicate = seen.has(email);
    const validated = parseList(email)[0];
    if (!validated) continue;
    seen.add(email);
    result.push({
      ...validated,
      status: isDuplicate ? "duplicate" : validated.status,
      reason: isDuplicate ? "This email address appears more than once in the imported file; quarantined before sending." : validated.reason,
      name: nameIndex >= 0 && cells[nameIndex] ? cells[nameIndex]! : validated.name,
      company: companyIndex >= 0 && cells[companyIndex] ? cells[companyIndex]! : validated.company,
    });
  }
  return result;
}

/** Replaces canonical and legacy-cased merge tags without leaving unresolved tokens. */
export const fill = (text: string, r: Recipient) =>
  text
    .replace(/\{\{\s*name\s*\}\}|\{\s*name\s*\}/gi, r.name)
    .replace(/\{\{\s*company\s*\}\}|\{\s*company\s*\}/gi, r.company);

const PROFILE_LIMITS = [400, 410, 420, 386, 381, 370, 402, 395, 415, 375];

export function makeProfile(id: number, name: string, email: string, used = 0): Profile {
  return {
    id,
    name,
    email,
    limit: PROFILE_LIMITS[(id - 1) % PROFILE_LIMITS.length] ?? 400,
    used,
    exhaustedUntil: null,
  };
}

/** No demo accounts — profiles only exist once a real Gmail account is linked. */
export const initialProfiles: Profile[] = [];
