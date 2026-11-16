from pathlib import Path

# --- EliteRadarHub: delete/restore snippets ---
hub_path = Path("src/features/radar/EliteRadarHub.tsx")
hub = hub_path.read_text()

if "handleDeleteSnippet" not in hub:
    hub = hub.replace("const SNIPPETS = [", "const DEFAULT_SNIPPETS = [")

    old_state = '  const [copiedId, setCopiedId] = useState<string | null>(null);'
    new_state = '''  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState(() => {
    try {
      const saved = localStorage.getItem("ec.radar-snippets");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SNIPPETS;
  });

  const handleDeleteSnippet = (id: string, title: string) => {
    const next = snippets.filter((s: any) => s.id !== id);
    setSnippets(next);
    try { localStorage.setItem("ec.radar-snippets", JSON.stringify(next)); } catch {}
    toast.success(`Removed "${title}"`);
  };

  const handleResetSnippets = () => {
    setSnippets(DEFAULT_SNIPPETS);
    try { localStorage.removeItem("ec.radar-snippets"); } catch {}
    toast.success("Restored default snippets");
  };'''
    if old_state in hub:
        hub = hub.replace(old_state, new_state, 1)

    old_btn = '''                    <button type="button" onClick={() => { onApplyTemplate({ subject: s.subject, body: s.body }); toast.success("Applied to Template A"); onClose(); }}
                      className="flex items-center gap-1 rounded-lg bg-brand px-2 py-1 text-[11px] font-semibold">
                      Apply <ArrowRight className="size-3" />
                    </button>
                  </div>'''
    new_btn = '''                    <button type="button" onClick={() => { onApplyTemplate({ subject: s.subject, body: s.body }); toast.success("Applied to Template A"); onClose(); }}
                      className="flex items-center gap-1 rounded-lg bg-brand px-2 py-1 text-[11px] font-semibold">
                      Apply <ArrowRight className="size-3" />
                    </button>
                    <button type="button" title="Delete snippet" onClick={() => handleDeleteSnippet(s.id, s.title)}
                      className="flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/20">
                      <Trash2 className="size-3" />
                    </button>
                  </div>'''
    if old_btn in hub:
        hub = hub.replace(old_btn, new_btn, 1)

    old_loop = '''        {tab === "snippets" && (
          <div className="space-y-3">
            {SNIPPETS.map((s) => ('''
    new_loop = '''        {tab === "snippets" && (
          <div className="space-y-3">
            {snippets.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#121c2e] p-6 text-center">
                <p className="text-[12px] text-white/60">No snippets left.</p>
                <button type="button" onClick={handleResetSnippets}
                  className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-white">
                  Restore Default Snippets
                </button>
              </div>
            ) : (
              <>
                {snippets.map((s: any) => ('''
    if old_loop in hub:
        hub = hub.replace(old_loop, new_loop, 1)

    old_close = '''                </div>
              </div>
            ))}
          </div>
        )}'''
    new_close = '''                </div>
              </div>
            ))}
            <div className="pt-1 text-center">
              <button type="button" onClick={handleResetSnippets}
                className="text-[10.5px] text-white/40 underline hover:text-white/70">
                Restore Default Snippets
              </button>
            </div>
              </>
            )}
          </div>
        )}'''
    if old_close in hub:
        hub = hub.replace(old_close, new_close, 1)

    # fallback if SNIPPETS still referenced
    hub = hub.replace("{SNIPPETS.map", "{snippets.map")
    hub_path.write_text(hub)
    print("EliteRadarHub snippets delete/restore applied")
else:
    print("EliteRadarHub already has delete handlers")

# --- app.tsx: clear error toasts ---
app_path = Path("src/routes/app.tsx")
app = app_path.read_text()

old_guide = '''  function guideTo(target: "recipients" | "profiles", msg: string) {
    setGuide({ target, msg });'''
new_guide = '''  function guideTo(target: "recipients" | "profiles", msg: string) {
    setGuide({ target, msg });
    toast.error(msg);'''
if old_guide in app and "toast.error(msg)" not in app[app.find("function guideTo"):app.find("function guideTo")+200]:
    app = app.replace(old_guide, new_guide, 1)
    print("guideTo toast added")
else:
    print("guideTo already has toast or pattern missing")

old_start = '''    if (!cleanupHandled && (counts.duplicate > 0 || counts.risky > 0)) {
      setConfirming({ kind: "cleanup", duplicate: counts.duplicate, risky: counts.risky });
      return;
    }
    setEngine("sending");
    setScout(true);'''

new_start = '''    if (!cleanupHandled && (counts.duplicate > 0 || counts.risky > 0)) {
      setConfirming({ kind: "cleanup", duplicate: counts.duplicate, risky: counts.risky });
      return;
    }

    // Clear reasons when campaign cannot start
    const doneEmails = new Set(
      generatedRef.current.filter((g) => g.sent).map((g) => g.email.trim().toLowerCase())
    );
    for (const e of sentRecipientEmailsRef.current) doneEmails.add(e);
    const inRange = generated.filter((g) => g.id >= from && g.id <= to);
    if (inRange.length === 0) {
      toast.error("No recipients found in selected range.");
      return;
    }
    const unsentInRange = inRange.filter((g) => !doneEmails.has(g.email.trim().toLowerCase()));
    if (unsentInRange.length === 0) {
      toast.info("Cannot send: every address in this range was already sent. Permanent Send Protection blocks duplicates.");
      return;
    }

    setEngine("sending");
    setScout(true);'''

if old_start in app:
    app = app.replace(old_start, new_start, 1)
    print("campaign start safety toasts added")
else:
    print("campaign start pattern missing")

app_path.write_text(app)
print("done")
