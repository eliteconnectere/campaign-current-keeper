import { createServerFn } from "@tanstack/react-start";
import { resolveMx, resolve4 } from "node:dns/promises";

export type DomainScanResult = {
  domain: string;
  deliverable: boolean;
  reason: string;
};

/** Cache successful MX checks briefly so repeated validates are fast. */
const cache = new Map<string, { ok: boolean; reason: string; at: number }>();
const CACHE_MS = 10 * 60 * 1000;

async function probeDomain(domain: string): Promise<{ ok: boolean; reason: string }> {
  const key = domain.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: hit.ok, reason: hit.reason };

  try {
    const mx = await resolveMx(key);
    if (Array.isArray(mx) && mx.length > 0) {
      const result = { ok: true, reason: "MX records found — domain can receive mail", at: Date.now() };
      cache.set(key, result);
      return { ok: true, reason: result.reason };
    }
  } catch {
    // no MX — try A record fallback (some small domains still accept mail)
  }

  try {
    const a = await resolve4(key);
    if (Array.isArray(a) && a.length > 0) {
      const result = {
        ok: true,
        reason: "No MX, but domain resolves — treated as deliverable",
        at: Date.now(),
      };
      cache.set(key, result);
      return { ok: true, reason: result.reason };
    }
  } catch {
    // neither MX nor A
  }

  const result = {
    ok: false,
    reason: "Domain has no mail servers (no MX / no DNS) — likely invalid",
    at: Date.now(),
  };
  cache.set(key, result);
  return { ok: false, reason: result.reason };
}

/**
 * Real domain scan: checks DNS MX (and A fallback) for each unique domain.
 * Call after parseList so syntax + typo checks run first.
 */
export const scanDomains = createServerFn({ method: "POST" })
  .inputValidator((input: { domains: string[] }) => {
    const raw = Array.isArray(input?.domains) ? input.domains : [];
    const domains = [
      ...new Set(
        raw
          .map((d) => String(d ?? "").trim().toLowerCase())
          .filter((d) => d.length > 0 && d.includes(".") && d.length < 253),
      ),
    ].slice(0, 200); // hard cap per request
    return { domains };
  })
  .handler(async ({ data }): Promise<{ results: DomainScanResult[] }> => {
    const results: DomainScanResult[] = [];
    // Sequential batches of 10 to avoid DNS spam
    const batchSize = 10;
    for (let i = 0; i < data.domains.length; i += batchSize) {
      const batch = data.domains.slice(i, i + batchSize);
      const settled = await Promise.all(
        batch.map(async (domain) => {
          const { ok, reason } = await probeDomain(domain);
          return { domain, deliverable: ok, reason } satisfies DomainScanResult;
        }),
      );
      results.push(...settled);
    }
    return { results };
  });
