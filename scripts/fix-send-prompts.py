from pathlib import Path

app = Path("src/routes/app.tsx")
t = app.read_text()

# 1) On Execute: do NOT show cleanup modal — auto-vault risky/dupes and start Elite
old_block = '''    if (!cleanupHandled && (counts.duplicate > 0 || counts.risky > 0)) {
      setConfirming({ kind: "cleanup", duplicate: counts.duplicate, risky: counts.risky });
      return;
    }'''

new_block = '''    if (!cleanupHandled && (counts.duplicate > 0 || counts.risky > 0)) {
      // Auto-quarantine bad rows and start Elite on safe contacts — no popup at send start
      removeStatuses(["duplicate", "risky"]);
      setCleanupHandled(true);
      if (counts.risky > 0 || counts.duplicate > 0) {
        toast.info(
          `Saved ${counts.risky + counts.duplicate} risky/duplicate lead(s) to Vault. Sending safe contacts on Elite…`
        );
      }
    }'''

if old_block in t:
    t = t.replace(old_block, new_block, 1)
    print("OK: removed pre-send cleanup modal")
else:
    print("WARN: pre-send cleanup block not found")

# 2) When Elite engine has no next recipient left, offer Standard for vault if any
# Find elite/standard completion: if (!next) { setScout(false); setEngine("idle"); return; }
# Prefer a targeted elite path — add after setEngine("idle") when no next in elite loop

old_idle = '''      if (!next) {
        setScout(false);
        setEngine("idle");
        return;
      }'''

# There may be multiple; only patch the first elite-style one carefully by including surrounding context if possible
# Safer: inject offer once via a unique elite completion message if present

# Look for stop() helper completion paths — add vault offer when stopping after sends
marker = "Permanent Send Protection blocks duplicates"
# Inject after campaign finishes in the main sending effect when !next

if old_idle in t:
    new_idle = '''      if (!next) {
        setScout(false);
        setEngine("idle");
        // After Elite finishes the safe list, offer Standard Mode only if Vault still has leads
        try {
          const vaultLen = (typeof quarantineVault !== "undefined" && Array.isArray(quarantineVault))
            ? quarantineVault.length
            : 0;
          if (vaultLen > 0 && mode === "elite") {
            toast.message(`Elite finished. ${vaultLen} lead(s) remain in Quarantine Vault.`, {
              action: {
                label: "Send via Standard",
                onClick: () => {
                  if (typeof sendRiskyViaStandard === "function") sendRiskyViaStandard();
                },
              },
              duration: 12000,
            });
          }
        } catch {}
        return;
      }'''
    t = t.replace(old_idle, new_idle, 1)
    print("OK: Standard Mode offer only after Elite finishes")
else:
    print("WARN: !next idle block not found (may already be patched)")

app.write_text(t)
print("done", len(t))
