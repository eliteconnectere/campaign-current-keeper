import { NAVIGATION_DESTINATIONS, type NavDestination } from "@/features/assist/navigation.registry";

export type SearchableDestination = NavDestination & {
  label?: string;
  aliases?: string[];
};

export type ApplicationSearchResult = {
  place: string;
  label: string;
  purpose: string;
  kind: NavDestination["kind"];
  score: number;
};

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

// Lightweight phonetic key helps common sound-alike spellings without requiring
// a fixed dictionary of examples or a network request.
function phonetic(word: string): string {
  const clean = word.replace(/[^a-z]/g, "");
  if (!clean) return "";
  const first = clean[0]!;
  const tail = clean.slice(1).replace(/[aeiouyhw]/g, "")
    .replace(/[bfpv]/g, "1").replace(/[cgjkqsxz]/g, "2")
    .replace(/[dt]/g, "3").replace(/[l]/g, "4")
    .replace(/[mn]/g, "5").replace(/[r]/g, "6");
  return (first + tail.replace(/(.)\1+/g, "$1") + "000").slice(0, 4);
}

const SEARCH_STOP_WORDS = new Set(["a", "an", "the", "to", "me", "my", "i", "you", "we", "it", "is", "are", "am", "can", "could", "would", "please", "where", "what", "how", "show", "take", "go", "open", "find", "get", "want", "need", "for", "of", "in", "on", "at", "with", "that", "this", "something", "place", "thing"]);

function scoreText(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1;
  if (c.startsWith(q) || q.startsWith(c)) return 0.94;
  if (c.includes(q)) return 0.9;

  const qTokens = q.split(" ").filter(token => !SEARCH_STOP_WORDS.has(token));
  const effectiveTokens = qTokens.length ? qTokens : q.split(" ");
  const cTokens = c.split(" ");
  let tokenScore = 0;
  for (const token of effectiveTokens) {
    let best = 0;
    for (const candidateToken of cTokens) {
      if (candidateToken === token) best = Math.max(best, 1);
      else if (candidateToken.startsWith(token) || token.startsWith(candidateToken)) best = Math.max(best, 0.88);
      else {
        const distance = levenshtein(token, candidateToken);
        const maxLength = Math.max(token.length, candidateToken.length);
        if (maxLength >= 3 && distance <= Math.max(1, Math.floor(maxLength * 0.34))) {
          best = Math.max(best, 1 - distance / maxLength);
        }
        if (token.length >= 3 && phonetic(token) === phonetic(candidateToken)) best = Math.max(best, 0.78);
      }
    }
    tokenScore += best;
  }
  tokenScore /= effectiveTokens.length;

  const compactQ = effectiveTokens.join("");
  const compactC = c.replace(/ /g, "");
  const wholeDistance = levenshtein(compactQ, compactC);
  const wholeScore = 1 - wholeDistance / Math.max(compactQ.length, compactC.length, 1);
  return Math.max(tokenScore * 0.88, wholeScore * 0.76);
}

/**
 * Search the live registered application destination catalog. The catalog is
 * intentionally open-ended: results come from registered destinations and
 * their purpose/parent/aliases, not from a finite list of example phrases.
 * Callers may append runtime destinations (e.g. user-created Rex features).
 */
export function searchApplicationCatalog(
  query: string,
  limit = 12,
  extra: SearchableDestination[] = [],
): ApplicationSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const catalog: SearchableDestination[] = [...NAVIGATION_DESTINATIONS, ...extra];
  const unique = new Map<string, SearchableDestination>();
  for (const item of catalog) unique.set(item.place, item);

  return [...unique.values()]
    .map((item) => {
      const label = item.label ?? item.place.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
      const searchable = [item.place, label, item.purpose, item.parent ?? "", ...(item.aliases ?? [])].join(" ");
      return {
        place: item.place,
        label,
        purpose: item.purpose,
        kind: item.kind,
        score: scoreText(normalizedQuery, searchable),
      };
    })
    .filter((item) => item.score >= 0.28)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, Math.max(1, limit));
}

/** Rank arbitrary UI search records with the same typo-tolerant matcher. */
export function rankSearchRecords<T>(
  query: string,
  records: T[],
  getSearchText: (record: T) => string,
): Array<{ record: T; score: number }> {
  if (!normalize(query)) return [];
  return records
    .map((record) => ({ record, score: scoreText(query, getSearchText(record)) }))
    .filter((item) => item.score >= 0.28)
    .sort((a, b) => b.score - a.score);
}
