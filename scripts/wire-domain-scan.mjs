import fs from "node:fs";

const appPath = "src/routes/app.tsx";
let app = fs.readFileSync(appPath, "utf8");

// 1. Import scanDomains if missing
if (!app.includes("domainScan.functions")) {
  if (app.includes('from "@/lib/billing.functions"')) {
    app = app.replace(
      'from "@/lib/billing.functions";',
      'from "@/lib/billing.functions";\nimport { scanDomains } from "@/lib/domainScan.functions";',
    );
  } else if (app.includes('from "@/lib/reviewMode"')) {
    app = app.replace(
      'from "@/lib/reviewMode";',
      'from "@/lib/reviewMode";\nimport { scanDomains } from "@/lib/domainScan.functions";',
    );
  } else {
    console.error("Could not find import anchor for scanDomains");
    process.exit(1);
  }
  console.log("✓ import scanDomains added");
} else {
  console.log("✓ import already present");
}

// 2. Helper function after imports block if missing
if (!app.includes("async function enrichWithDomainScan")) {
  const helper = `
/** Real domain scan: MX/DNS check for unique domains after parseList. */
async function enrichWithDomainScan(list: Recipient[]): Promise<Recipient[]> {
  const domains = [...new Set(list.map((r) => (r.email.split("@")[1] ?? "").toLowerCase()).filter(Boolean))];
  if (domains.length === 0) return list;
  try {
    const { results } = await scanDomains({ data: { domains } });
    const map = new Map(results.map((r) => [r.domain, r]));
    return list.map((r) => {
      if (r.status !== "valid") return r;
      const domain = (r.email.split("@")[1] ?? "").toLowerCase();
      const hit = map.get(domain);
      if (!hit) return r;
      if (!hit.deliverable) {
        return { ...r, status: "risky" as const, reason: hit.reason };
      }
      return { ...r, reason: hit.reason };
    });
  } catch (e) {
    console.error("Domain scan failed", e);
    return list;
  }
}
`;
  // Insert before first function Card or function Workspace
  if (app.includes("function Workspace()")) {
    app = app.replace("function Workspace()", helper + "\nfunction Workspace()");
  } else if (app.includes("function Card(")) {
    app = app.replace("function Card(", helper + "\nfunction Card(");
  } else {
    console.error("Could not find insertion point for enrichWithDomainScan");
    process.exit(1);
  }
  console.log("✓ enrichWithDomainScan helper added");
} else {
  console.log("✓ enrichWithDomainScan already present");
}

// 3. Wire into common validate patterns — after parseList(...)
// Pattern A: setRecipients(parseList(...))
if (app.includes("setRecipients(parseList(") && !app.includes("enrichWithDomainScan")) {
  // handled below with more specific patterns
}

// Replace: const parsed = parseList(x); setSomething(parsed)
// with async scan. Several possible patterns in this app.

const patterns = [
  // setRecipients(parseList(raw))
  {
    from: /setRecipients\(parseList\(([^)]+)\)\)/g,
    to: `void (async () => { const _p = parseList($1); setRecipients(await enrichWithDomainScan(_p)); })()`,
  },
];

let changed = false;
for (const p of patterns) {
  if (p.from.test(app)) {
    app = app.replace(p.from, p.to);
    changed = true;
  }
}

// Also handle: const list = parseList(...); setRecipients(list);
if (app.includes("parseList(") && !app.includes("enrichWithDomainScan(_p)") && !app.includes("await enrichWithDomainScan")) {
  // Broader: after any `= parseList(` assignment used for recipients
  app = app.replace(
    /const (\w+)\s*=\s*parseList\(([^)]+)\);(\s*)(setRecipients|setContacts|setList)\(\1\)/g,
    `const $1 = parseList($2);$3void (async () => { $4(await enrichWithDomainScan($1)); })()`,
  );
  changed = true;
}

if (!changed && !app.includes("await enrichWithDomainScan") && !app.includes("enrichWithDomainScan(_p)")) {
  console.log("⚠ Could not auto-wire setRecipients(parseList). Helper is ready — call enrichWithDomainScan after parseList in UI.");
} else {
  console.log("✓ validation paths wired to domain scan where patterns matched");
}

fs.writeFileSync(appPath, app, "utf8");
console.log("wire-domain-scan done");
