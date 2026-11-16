#!/usr/bin/env python3
import re, os

path = "src/routes/app.tsx"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

print("Applying Quarantine Leads Vault & Elite Safety updates...")

# 1. Add Quarantine Vault state and auto-archive helper
state_anchor = "const [featureStudio, setFeatureStudio] ="
state_addition = """const [vaultOpen, setVaultOpen] = useState(false);
  const [quarantineVault, setQuarantineVault] = useState<Recipient[]>(() => {
    try {
      const saved = localStorage.getItem("ec.quarantine-vault");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ec.quarantine-vault", JSON.stringify(quarantineVault));
    } catch {}
  }, [quarantineVault]);

  function archiveToVault(items: Recipient[]) {
    if (items.length === 0) return;
    setQuarantineVault((prev) => {
      const existing = new Set(prev.map((p) => p.email.toLowerCase()));
      const toAdd = items.filter((i) => !existing.has(i.email.toLowerCase()));
      return [...toAdd, ...prev];
    });
  }

  """

if "const [quarantineVault, setQuarantineVault]" not in text and state_anchor in text:
    text = text.replace(state_anchor, state_addition + state_anchor, 1)
    print("1. Added Quarantine Vault state and archiveToVault helper")
elif "quarantineVault" in text:
    print("1. Vault state already present")
else:
    print("1. WARN: featureStudio anchor not found")

# 2. Automatically save removed recipients to the Vault
remove_anchor = """    const keep = recipients.filter((r) => {
      if (kinds.includes(r.status)) return false;"""

remove_addition = """    const removed = recipients.filter((r) => kinds.includes(r.status));
    archiveToVault(removed);
    const keep = recipients.filter((r) => {
      if (kinds.includes(r.status)) return false;"""

if "archiveToVault(removed)" not in text and remove_anchor in text:
    text = text.replace(remove_anchor, remove_addition, 1)
    print("2. Wired removeStatuses to preserve excluded leads in Quarantine Vault")
elif "archiveToVault(removed)" in text:
    print("2. archiveToVault already wired")
else:
    print("2. WARN: removeStatuses keep filter not found")

# 3. Add Quarantine Vault to Workspace Menu
if 'label="Quarantine Vault"' not in text:
    text2, n = re.subn(
        r'(\s*<MenuRow\s+icon=\{ScrollText\}\s+label="Activity Log")',
        r'''
                      <MenuRow
                        icon={Database}
                        label="Quarantine Vault"
                        sub={`${quarantineVault.length} excluded/risky leads saved`}
                        onClick={() => { setVaultOpen(true); setPanel("none"); }}
                      />\1''',
        text,
        count=1,
    )
    if n:
        text = text2
        print("3. Added Quarantine Vault row to Workspace menu")
    else:
        print("3. WARN: Activity Log MenuRow not found")
else:
    print("3. Menu row already present")

# 4. Add Vault modal UI
cleanup_anchor = '{confirming?.kind === "setting" && ('
vault_modal = r'''      {vaultOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_50px_-20px_oklch(0.31_0.128_268/45%)] animate-scale-in">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Database className="size-5" />
                </span>
                <div>
                  <h3 className="text-[15px] font-bold text-ink">Quarantine Leads Vault</h3>
                  <p className="text-[11.5px] text-ink-soft">
                    {quarantineVault.length} unverified & excluded leads preserved safely
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVaultOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-neutral-100 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto p-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-[12px] leading-relaxed text-amber-900">
                <strong>Why are these here?</strong> The Elite Gmail Engine excludes these addresses to protect your Google account reputation from hard bounces. They are preserved here so your leads are never thrown away.
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={quarantineVault.length === 0}
                  onClick={() => {
                    const emails = quarantineVault.map((r) => r.email).join("\n");
                    navigator.clipboard.writeText(emails);
                    toast.success("Copied all emails to clipboard!");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-neutral-100 disabled:opacity-40"
                >
                  <Copy className="size-3.5" /> Copy Emails
                </button>
                <button
                  type="button"
                  disabled={quarantineVault.length === 0}
                  onClick={() => {
                    const rows = [
                      ["email", "name", "company", "status", "reason"],
                      ...quarantineVault.map((r) => [r.email, r.name, r.company, r.status, r.reason]),
                    ];
                    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `quarantine_leads_${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Downloaded Quarantine CSV!");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-neutral-100 disabled:opacity-40"
                >
                  <Download className="size-3.5" /> Export CSV
                </button>
                <button
                  type="button"
                  disabled={quarantineVault.length === 0}
                  onClick={() => {
                    switchMode("standard");
                    setRecipients(quarantineVault);
                    const nextGen = buildGenerated(quarantineVault);
                    setGenerated(nextGen);
                    generatedRef.current = nextGen;
                    setFrom(1);
                    setTo(quarantineVault.length);
                    setTab("all");
                    setCleanupHandled(true);
                    setVaultOpen(false);
                    log(`Loaded ${quarantineVault.length} quarantined leads into Standard Mode (Mailto)`);
                    toast.success("Loaded into Standard Mode", {
                      description: "Send safely via your device's native mail app without touching the Elite API.",
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="size-3.5" /> Load into Standard Mode
                </button>
              </div>

              <div className="mt-2 rounded-2xl border border-line bg-soft/50 p-2 max-h-60 overflow-y-auto divide-y divide-line/60">
                {quarantineVault.length === 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-ink-soft">
                    No leads in quarantine. Valid lists pass directly to Elite Engine.
                  </p>
                ) : (
                  quarantineVault.map((item, idx) => (
                    <div key={`${item.email}-${idx}`} className="flex items-center justify-between py-2 px-2 text-[12px]">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-ink truncate">{item.email}</p>
                        <p className="text-[11px] text-ink-soft truncate">{item.reason || "Excluded by list hygiene"}</p>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium bg-neutral-200 text-neutral-800">
                        {item.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line bg-neutral-50 px-5 py-3 text-[12px]">
              {quarantineVault.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear all leads from the Quarantine Vault?")) {
                      setQuarantineVault([]);
                      toast.info("Quarantine Vault cleared");
                    }
                  }}
                  className="text-rose-600 hover:underline"
                >
                  Clear Vault
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setVaultOpen(false)}
                className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      '''

if "Quarantine Leads Vault" not in text and cleanup_anchor in text:
    text = text.replace(cleanup_anchor, vault_modal + cleanup_anchor, 1)
    print("4. Added Quarantine Leads Vault modal component")
elif "Quarantine Leads Vault" in text:
    print("4. Vault modal already present")
else:
    print("4. WARN: setting confirming anchor not found for modal")

# 5. Elite hard safety barrier: skip risky in step loop
elite_find = """      const next = generatedRef.current.find(
        (g) => !g.sent && g.id >= from && g.id <= to && !done.has(g.email.trim().toLowerCase()),
      );"""

elite_find_safe = """      const riskySet = new Set(
        recipients.filter((r) => r.status === "risky").map((r) => r.email.trim().toLowerCase())
      );
      const next = generatedRef.current.find(
        (g) => !g.sent && g.id >= from && g.id <= to && !done.has(g.email.trim().toLowerCase()) && !riskySet.has(g.email.trim().toLowerCase()),
      );"""

if elite_find in text and "riskySet" not in text:
    text = text.replace(elite_find, elite_find_safe, 1)
    print("5. Added hard Elite Engine reputation barrier (skips risky leads)")
elif "riskySet" in text:
    print("5. Elite risky skip already present")
else:
    print("5. WARN: elite find next pattern not exact")

# 6. Replace cleanup modal
cleanup_pat = r"\{confirming\?\.kind === \"cleanup\" && \(\s*<Confirm[\s\S]*?/>\s*\)\}"
new_cleanup_modal = """{confirming?.kind === "cleanup" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 px-6">
          <div className="w-full max-w-[340px] animate-scale-in rounded-2xl border border-line bg-white p-5 shadow-[0_18px_44px_-26px_oklch(0.31_0.128_268/40%)]">
            <p className="text-[14px] font-semibold text-ink">List Hygiene & Reputation</p>
            <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">
              Found {confirming.duplicate > 0 ? `${confirming.duplicate} duplicate(s)` : ""}{confirming.duplicate > 0 && confirming.risky > 0 ? " and " : ""}{confirming.risky > 0 ? `${confirming.risky} unverified/risky domain(s)` : ""}.
            </p>
            <p className="mt-2 text-[11px] leading-snug text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              Sending risky emails through Elite Engine can hurt your connected Gmail sender score. Excluded leads are automatically saved to your Quarantine Vault!
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {confirming.risky > 0 && (
                <button
                  type="button"
                  onClick={sendRiskyViaStandard}
                  className="w-full rounded-full bg-brand py-2 text-[12px] font-semibold text-white shadow-xs hover:opacity-90"
                >
                  Send Risky in Standard Mode ({confirming.risky})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  removeStatuses(["duplicate", "risky"]);
                  setCleanupHandled(true);
                  setConfirming(null);
                  log("Saved unverified leads to Quarantine Vault — sending safe contacts on Elite");
                  setEngine("sending");
                  setScout(true);
                }}
                className="w-full rounded-full border border-line bg-soft py-2 text-[12px] font-semibold text-ink hover:bg-neutral-100"
              >
                Send Safe on Elite (Save to Vault)
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="w-full py-1 text-[11.5px] font-medium text-ink-soft hover:text-ink"
              >
                Review List First
              </button>
            </div>
          </div>
        </div>
      )}"""

if "Send Safe on Elite (Save to Vault)" not in text and re.search(cleanup_pat, text):
    text = re.sub(cleanup_pat, new_cleanup_modal, text, count=1)
    print("6. Replaced pre-send cleanup with Vault-aware 3-way modal")
elif "Send Safe on Elite (Save to Vault)" in text:
    print("6. Hygiene modal already vault-aware")
else:
    print("6. WARN: cleanup Confirm pattern not found")

# 7. Banner under recipient counts
note_str = """            {(counts.duplicate > 0 || counts.risky > 0) && (
              <p className="mt-1 text-[11px] leading-snug text-ink-soft">
                Press and hold Duplicate or Risky to remove that whole group.
              </p>
            )}"""

banner_str = """            {(counts.duplicate > 0 || counts.risky > 0) && (
              <p className="mt-1 text-[11px] leading-snug text-ink-soft">
                Press and hold Duplicate or Risky to remove that whole group.
              </p>
            )}
            {(counts.risky > 0 || quarantineVault.length > 0) && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-[11.5px] text-amber-900">
                <span className="leading-tight">
                  <strong>{counts.risky > 0 ? `${counts.risky} Risky` : `${quarantineVault.length} Quarantined`}</strong>: saved safely in Vault to protect your Gmail reputation.
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setVaultOpen(true)}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Open Vault
                  </button>
                  {counts.risky > 0 && (
                    <button
                      type="button"
                      onClick={sendRiskyViaStandard}
                      className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                    >
                      Send Standard
                    </button>
                  )}
                </div>
              </div>
            )}"""

if note_str in text and "Open Vault" not in text:
    text = text.replace(note_str, banner_str, 1)
    print("7. Added Vault quick banner to recipient list UI")
elif "Open Vault" in text:
    print("7. Banner already present")
else:
    print("7. WARN: long-press note not found")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done! Quarantine Vault script finished.")
