from pathlib import Path
import re

# ---- app.tsx: import + mount ExpiryReminder ----
app = Path("src/routes/app.tsx")
if app.exists():
    t = app.read_text()
    if "ExpiryReminder" not in t:
        t = t.replace(
            'import { scanDomains } from "@/lib/domainScan.functions";',
            'import { scanDomains } from "@/lib/domainScan.functions";\nimport { ExpiryReminder } from "@/features/billing/ExpiryReminder";',
            1,
        )
        # mount near celebrate
        if "{celebrate &&" in t:
            t = t.replace(
                "{celebrate &&",
                """{entitlements?.planEndsAt && entitlements.plan !== "free" && (
        <ExpiryReminder
          planEndsAt={entitlements.planEndsAt}
          planLabel={
            entitlements.plan === "promaxx"
              ? "Elite Studio ProMaxx"
              : entitlements.plan === "premium"
                ? "Premium"
                : entitlements.plan === "standard"
                  ? "Standard"
                  : entitlements.plan === "starter"
                    ? "Starter"
                    : "Your plan"
          }
          onRenew={() => {
            setPremiumReason("Renew your plan to keep Elite Engine and profiles active.");
          }}
        />
      )}
      {celebrate &&""",
                1,
            )
            print("app ExpiryReminder mounted")
        else:
            print("WARN no celebrate anchor")
        app.write_text(t)
    else:
        print("app already has ExpiryReminder")

# ---- EliteRadarHub: categories + add form, no restore-as-primary ----
radar = Path("src/features/radar/EliteRadarHub.tsx")
if radar.exists():
    r = radar.read_text()
    if "SNIPPET_CATEGORIES" not in r:
        # Replace snippets tab section with richer UI
        old_tab = '''        {tab === "snippets" && (
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
        # inject categories + add UI before map - softer approach: prepend after handleResetSnippets
        if "const handleResetSnippets" in r and "handleAddSnippet" not in r:
            inject = '''
  const SNIPPET_CATEGORIES = [
    { id: "direct", label: "Direct" },
    { id: "friendly", label: "Friendly" },
    { id: "partnership", label: "Partnership" },
    { id: "followup", label: "Follow-up" },
    { id: "value", label: "Value / Resource" },
  ] as const;
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCat, setNewCat] = useState("friendly");

  const handleAddSnippet = () => {
    if (!newTitle.trim() || !newSubject.trim() || !newBody.trim()) {
      toast.error("Title, subject and body are required");
      return;
    }
    const cat = SNIPPET_CATEGORIES.find((c) => c.id === newCat);
    const item = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      tag: cat?.label ?? "Custom",
      subject: newSubject.trim(),
      body: newBody.trim(),
      category: newCat,
    };
    const next = [item, ...snippets];
    setSnippets(next);
    try { localStorage.setItem("ec.radar-snippets", JSON.stringify(next)); } catch {}
    setAddOpen(false);
    setNewTitle("");
    setNewSubject("");
    setNewBody("");
    toast.success(`Saved under ${cat?.label ?? "Custom"}`);
  };

'''
            r = r.replace(
                "  const handleResetSnippets = () => {",
                inject + "  const handleResetSnippets = () => {",
                1,
            )
            # Change restore button label
            r = r.replace("Restore Default Snippets", "Add starter templates")
            # Add button above snippets list
            if 'tab === "snippets"' in r and "Save new snippet" not in r:
                r = r.replace(
                    '{tab === "snippets" && (\n          <div className="space-y-3">',
                    '''{tab === "snippets" && (
          <div className="space-y-3">
            <button type="button" onClick={() => setAddOpen((v) => !v)}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 py-2.5 text-[12px] font-semibold text-white/90">
              {addOpen ? "Cancel" : "+ Save a new snippet"}
            </button>
            {addOpen && (
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#121c2e] p-3">
                <p className="text-[11px] font-semibold text-white/60">Save under category</p>
                <div className="flex flex-wrap gap-1.5">
                  {SNIPPET_CATEGORIES.map((c) => (
                    <button key={c.id} type="button" onClick={() => setNewCat(c.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        newCat === c.id ? "bg-brand text-white" : "bg-white/10 text-white/70"
                      }`}>{c.label}</button>
                  ))}
                </div>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] outline-none" />
                <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Subject"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] outline-none" />
                <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Body" rows={4}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] outline-none" />
                <button type="button" onClick={handleAddSnippet}
                  className="w-full rounded-lg bg-brand py-2 text-[12px] font-semibold">Save snippet</button>
              </div>
            )}''',
                    1,
                )
            radar.write_text(r)
            print("radar snippets categories")
        else:
            print("radar skip inject")
    else:
        print("radar already categories")

# ---- team.server updateSeatCap to accept share_snippets ----
ts = Path("src/server/team.server.ts")
if ts.exists():
    c = ts.read_text()
    if "share_snippets" not in c:
        c = c.replace(
            "max_gmail_profiles?: number;\n};",
            "max_gmail_profiles?: number;\n  share_snippets?: boolean;\n};",
            1,
        )
        # extend updateSeatCap
        if "export async function updateSeatCap" in c and "shareSnippets" not in c:
            c = c.replace(
                """export async function updateSeatCap(
  ownerUserId: string,
  seatId: string,
  maxGmailProfiles: number,
) {
  const cap = Math.min(75, Math.max(1, Math.floor(maxGmailProfiles) || 5));
  const db = await admin();
  const { data, error } = await db
    .from("team_seats")
    .update({ max_gmail_profiles: cap })
    .eq("id", seatId)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, seat: data as TeamSeat };
}""",
                """export async function updateSeatCap(
  ownerUserId: string,
  seatId: string,
  maxGmailProfiles: number,
  shareSnippets?: boolean,
) {
  const cap = Math.min(75, Math.max(1, Math.floor(maxGmailProfiles) || 5));
  const db = await admin();
  const patch: Record<string, unknown> = { max_gmail_profiles: cap };
  if (typeof shareSnippets === "boolean") patch.share_snippets = shareSnippets;
  const { data, error } = await db
    .from("team_seats")
    .update(patch)
    .eq("id", seatId)
    .eq("owner_user_id", ownerUserId)
    .select("*")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, seat: data as TeamSeat };
}""",
                1,
            )
            print("updateSeatCap share_snippets")
        ts.write_text(c)
    else:
        print("team.server has share_snippets")

# ---- team.functions updateAssistantSeat ----
tf = Path("src/lib/team.functions.ts")
if tf.exists():
    f = tf.read_text()
    if "shareSnippets" not in f and "updateAssistantSeat" in f:
        f = f.replace(
            ".inputValidator((input: { seatId: string; maxGmailProfiles: number }) => {",
            ".inputValidator((input: { seatId: string; maxGmailProfiles: number; shareSnippets?: boolean }) => {",
            1,
        )
        f = f.replace(
            "return { seatId: input.seatId.trim(), maxGmailProfiles: max };",
            "return { seatId: input.seatId.trim(), maxGmailProfiles: max, shareSnippets: Boolean(input?.shareSnippets) };",
            1,
        )
        f = f.replace(
            "return updateSeatCap(context.userId, data.seatId, data.maxGmailProfiles);",
            "return updateSeatCap(context.userId, data.seatId, data.maxGmailProfiles, data.shareSnippets);",
            1,
        )
        if "share_snippets" not in f:
            f = f.replace(
                "max_gmail_profiles: number;\n};",
                "max_gmail_profiles: number;\n  share_snippets?: boolean;\n};",
                1,
            )
            f = f.replace(
                "max_gmail_profiles: s.max_gmail_profiles ?? 5,",
                "max_gmail_profiles: s.max_gmail_profiles ?? 5,\n        share_snippets: Boolean(s.share_snippets),",
                1,
            )
        tf.write_text(f)
        print("team.functions shareSnippets")

# ---- TeamPanel: editingCap + share snippets toggle ----
tp = Path("src/features/team/TeamPanel.tsx")
if tp.exists():
    p = tp.read_text()
    if "editingShareSnippets" not in p:
        p = p.replace(
            "const [editingCap, setEditingCap] = useState<number>(5);",
            "const [editingCap, setEditingCap] = useState<number>(5);\n  const [editingShareSnippets, setEditingShareSnippets] = useState(false);",
            1,
        )
        p = p.replace(
            "const res = await updateAssistantSeat({ data: { seatId, maxGmailProfiles: editingCap } });",
            "const res = await updateAssistantSeat({ data: { seatId, maxGmailProfiles: editingCap, shareSnippets: editingShareSnippets } });",
            1,
        )
        p = p.replace(
            "setEditingCap(s.max_gmail_profiles ?? 5);",
            "setEditingCap(s.max_gmail_profiles ?? 5);\n                      setEditingShareSnippets(Boolean(s.share_snippets));",
            1,
        )
        # expand edit UI with checkbox
        old_edit = '''                {editingSeatId === s.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={75}
                      value={editingCap}
                      onChange={(e) => setEditingCap(Math.min(75, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-14 rounded-md border border-brand px-1.5 py-1 text-center text-[12px] font-bold"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveCap(s.id)}
                      className="rounded-lg bg-brand p-1.5 text-white hover:opacity-90"
                      title="Save limit"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSeatId(null)}
                      className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-ink"
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )'''
        new_edit = '''                {editingSeatId === s.id ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={75}
                        value={editingCap}
                        onChange={(e) => setEditingCap(Math.min(75, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-14 rounded-md border border-brand px-1.5 py-1 text-center text-[12px] font-bold"
                        title="Max Gmails"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveCap(s.id)}
                        className="rounded-lg bg-brand p-1.5 text-white hover:opacity-90"
                        title="Save"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSeatId(null)}
                        className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-ink"
                        title="Cancel"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <label className="flex items-center gap-1.5 text-[10px] text-ink-soft">
                      <input
                        type="checkbox"
                        checked={editingShareSnippets}
                        onChange={(e) => setEditingShareSnippets(e.target.checked)}
                      />
                      Can use my snippets
                    </label>
                  </div>
                )'''
        if old_edit in p:
            p = p.replace(old_edit, new_edit, 1)
            print("TeamPanel edit share snippets")
        else:
            print("WARN TeamPanel edit UI anchor")
        tp.write_text(p)
    else:
        print("TeamPanel already editingShareSnippets")

print("done")
