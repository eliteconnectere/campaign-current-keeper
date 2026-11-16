#!/usr/bin/env python3
import re
from pathlib import Path

print("--- Step 1: Gmail API error interception ---")
gf_path = Path("src/lib/gmail.functions.ts")
gf_code = gf_path.read_text(encoding="utf-8")

# Extend SendResult reason union if needed
if '"recipient_rejected"' not in gf_code:
    gf_code = gf_code.replace(
        '| "already_sent"',
        '| "already_sent" | "recipient_rejected"',
        1,
    )
    print("Added recipient_rejected to SendResult union")

gf_target = """    if (res.status === 401 || res.status === 403) {
      await releaseClaim();
      console.error(`Gmail send refused [${res.status}]: ${await res.text()}`);
      return {
        ok: false,
        reason: "reconnect",
        profileId: preferred.id,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }
    if (!res.ok) {
      await releaseClaim();
      const body = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${body}`);
      return {
        ok: false,
        reason: "error",
        profileId: preferred.id,
        message: `Gmail refused the send (${res.status}).`,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }"""

gf_replacement = """    if (res.status === 401 || res.status === 403) {
      await releaseClaim();
      const bodyText = await res.text();
      console.error(`Gmail send refused [${res.status}]: ${bodyText}`);
      const isQuota = /quota|rateLimitExceeded|userRateLimit/i.test(bodyText);
      return {
        ok: false,
        reason: isQuota ? ("all_exhausted" as const) : ("reconnect" as const),
        profileId: preferred.id,
        message: isQuota ? "Gmail daily sending quota or rate limit exceeded for this profile." : undefined,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }
    if (res.status === 400) {
      await releaseClaim();
      const bodyText = await res.text();
      console.error(`Gmail API recipient rejected [400]: ${bodyText}`);
      let detail = "Invalid recipient or header format";
      try {
        const parsed = JSON.parse(bodyText);
        detail = parsed.error?.message || detail;
      } catch {}
      return {
        ok: false,
        reason: "recipient_rejected" as const,
        profileId: preferred.id,
        message: detail,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }
    if (!res.ok) {
      await releaseClaim();
      const body = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${body}`);
      return {
        ok: false,
        reason: "error" as const,
        profileId: preferred.id,
        message: `Gmail refused the send (${res.status}).`,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }"""

if gf_target in gf_code:
    gf_code = gf_code.replace(gf_target, gf_replacement)
    gf_path.write_text(gf_code, encoding="utf-8")
    print("SUCCESS: gmail.functions.ts updated")
elif "recipient_rejected" in gf_code:
    print("NOTE: gmail.functions.ts already has recipient_rejected")
else:
    print("NOTE: exact 401/403 block not found — may need manual check")

print("--- Step 2: Campaign loop recipient_rejected handler ---")
app_path = Path("src/routes/app.tsx")
app_code = app_path.read_text(encoding="utf-8")

app_target = """      if (result.reason === "already_sent") {
        const mark = (list: Generated[]) =>
          list.map((x) => (x.email.trim().toLowerCase() === key ? { ...x, sent: true } : x));
        generatedRef.current = mark(generatedRef.current);
        setGenerated(mark);
        log(`Skipped ${next.email} — this exact message was already sent.`);
        startedAt = performance.now();
        waitThen();
        return;
      }"""

app_replacement = app_target + """

      if (result.reason === "recipient_rejected") {
        const mark = (list: Generated[]) =>
          list.map((x) => (x.email.trim().toLowerCase() === key ? { ...x, sent: true } : x));
        generatedRef.current = mark(generatedRef.current);
        setGenerated(mark);
        if (typeof archiveToVault === "function") {
          archiveToVault([{
            email: next.email,
            name: next.name || "",
            company: next.company || "",
            status: "risky",
            reason: result.message ? `Gmail API rejected: ${result.message}` : "Gmail API rejected recipient (400 Bad Request)",
          }]);
        }
        log(`Quarantined ${next.email} — Gmail API rejected recipient (${result.message}).`);
        toast.warning(`Address rejected by Gmail: ${next.email}.`);
        startedAt = performance.now();
        waitThen();
        return;
      }"""

if "recipient_rejected" in app_code and "Gmail API rejected" in app_code:
    print("NOTE: app.tsx already has recipient_rejected handler")
elif app_target in app_code:
    app_code = app_code.replace(app_target, app_replacement)
    print("SUCCESS: recipient_rejected handler added to campaign loop")
else:
    print("NOTE: already_sent anchor not exact — trying flexible insert")
    m = re.search(r'if \(result\.reason === "already_sent"\) \{[\s\S]*?return;\n\s*\}', app_code)
    if m and "recipient_rejected" not in app_code:
        insert = m.group(0) + """

      if (result.reason === "recipient_rejected") {
        const mark = (list: Generated[]) =>
          list.map((x) => (x.email.trim().toLowerCase() === key ? { ...x, sent: true } : x));
        generatedRef.current = mark(generatedRef.current);
        setGenerated(mark);
        log(`Quarantined ${next.email} — Gmail API rejected recipient (${result.message}).`);
        toast.warning(`Address rejected by Gmail: ${next.email}.`);
        startedAt = performance.now();
        waitThen();
        return;
      }"""
        app_code = app_code[: m.start()] + insert + app_code[m.end() :]
        print("SUCCESS: flexible recipient_rejected insert")
    else:
        print("ERROR: could not wire recipient_rejected in app.tsx")

print("--- Step 3: Real wall-clock delay (exact seconds) ---")
# Find waitThen / delay patterns that under-wait
# Common bug: subtracting send duration incorrectly or using wrong unit

# Ensure delayMs uses full seconds: delay * 1000 with Math.max remaining to target wall clock
# Pattern A: waitThen using delay only as setTimeout(delay*1000) without compensation is OK
# Pattern B: if they use performance.now() - startedAt but floor wrong, fix

# Force waitThen to always sleep full delaySec from start of previous send cycle
if "function waitThen" in app_code or "waitThen" in app_code:
    # Replace common short-circuit delays
    # Look for setTimeout(..., Math.max(0, delay*1000 - elapsed))
    # User wants: when they pick 3s, next send starts at exactly ~3s wall clock after previous trigger
    old_wait_patterns = [
        (
            re.compile(
                r"const remaining = Math\.max\(0,\s*delay\s*\*\s*1000\s*-\s*[^)]+\);\s*setTimeout\([^,]+,\s*remaining\)",
                re.M,
            ),
            None,  # handle below
        )
    ]

# Inject robust wait helper if missing
if "async function sleepMs" not in app_code and "function sleepMs" not in app_code:
    helper = """
  /** Real wall-clock pause: 3 means 3000ms, not "about the same as 5". */
  function sleepMs(ms: number) {
    const target = Math.max(0, Math.round(ms));
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = () => {
        const left = target - (performance.now() - start);
        if (left <= 0) resolve();
        else setTimeout(tick, Math.min(left, 50));
      };
      setTimeout(tick, Math.min(target, 50));
    });
  }
"""
    # Insert before waitThen or after validate function
    if "function waitThen" in app_code:
        app_code = app_code.replace("function waitThen", helper + "\n  function waitThen", 1)
        print("Inserted sleepMs helper before waitThen")
    elif "async function waitThen" in app_code:
        app_code = app_code.replace("async function waitThen", helper + "\n  async function waitThen", 1)
        print("Inserted sleepMs helper before async waitThen")
    else:
        print("NOTE: waitThen not found for helper insert")

# Rewrite waitThen body patterns to use full delay from startedAt
# Example target: remaining = delay * 1000 - (now - startedAt)
# Ensure delay variable is in SECONDS and multiplied by 1000

# Fix: if code uses delay as already ms incorrectly for [3,4,5]
# Search for setTimeout(waitThen, delay) without *1000 when delay is 3..8
app_code2, n = re.subn(
    r"setTimeout\(\s*waitThen\s*,\s*delay\s*\)",
    "setTimeout(waitThen, Math.max(0, Math.round(Number(delay) * 1000)))",
    app_code,
)
if n:
    app_code = app_code2
    print(f"Fixed setTimeout(waitThen, delay) -> * 1000 ({n}x)")

app_code2, n = re.subn(
    r"setTimeout\(\s*\(\)\s*=>\s*\{?\s*waitThen\(\)\s*\}?\s*,\s*delay\s*\)",
    "setTimeout(() => waitThen(), Math.max(0, Math.round(Number(delay) * 1000)))",
    app_code,
)
if n:
    app_code = app_code2
    print(f"Fixed arrow setTimeout delay ({n}x)")

# Ensure remaining uses delay * 1000
if re.search(r"delay\s*\*\s*1000", app_code):
    print("Found delay * 1000 usage (good)")
else:
    print("WARN: no delay*1000 found — check waitThen manually")

# Strengthen remaining calc if present: always use wall clock from startedAt
app_code2, n = re.subn(
    r"const remaining = Math\.max\(0,\s*([^;]+)\);",
    lambda m: (
        "const remaining = Math.max(0, Math.round(Number(delay) * 1000 - (performance.now() - startedAt)));"
        if "delay" in m.group(1) or "1000" in m.group(1)
        else m.group(0)
    ),
    app_code,
    count=5,
)
if n:
    print(f"Normalized remaining calc ({n} attempts)")

app_path.write_text(app_code, encoding="utf-8")
print("app.tsx written")
print("--- Done ---")
