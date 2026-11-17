import { useEffect, useState } from "react";
import {
  X, Activity, ShieldCheck, Sparkles, Radio, Copy, Check,
  Download, Trash2, Gauge, CheckCircle2, Clock, ArrowRight, Plus,
} from "lucide-react";
import { toast } from "sonner";

export type EliteRadarHubProps = {
  onClose: () => void;
  sentCount: number;
  totalCount: number;
  pacingSeconds: number;
  onApplyTemplate: (tpl: { subject: string; body: string }) => void;
  activeProfileEmail?: string;
  isSending?: boolean;
};

const SNIPPET_CATEGORIES = [
  { id: "direct", label: "Direct" },
  { id: "friendly", label: "Friendly" },
  { id: "partnership", label: "Partnership" },
  { id: "followup", label: "Follow-up" },
  { id: "value", label: "Value / Resource" },
] as const;

type Snippet = {
  id: string;
  title: string;
  tag: string;
  subject: string;
  body: string;
  category?: string;
};

function loadSnippets(): Snippet[] {
  try {
    const saved = localStorage.getItem("ec.radar-snippets");
    if (saved != null) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  // Empty by default — never force old generated templates back after delete
  return [];
}

function persistSnippets(list: Snippet[]) {
  try {
    localStorage.setItem("ec.radar-snippets", JSON.stringify(list));
  } catch {}
}

export function EliteRadarHub({
  onClose, sentCount, totalCount, pacingSeconds, onApplyTemplate, activeProfileEmail, isSending, initialTab,
}: EliteRadarHubProps & { initialTab?: "radar" | "snippets" | "monitor" }) {
  const [tab, setTab] = useState<"radar" | "snippets" | "monitor">(initialTab ?? "radar");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>(() => loadSnippets());
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCat, setNewCat] = useState<string>("friendly");
  useEffect(() => {
    const openAdd = () => { setTab("snippets"); setAddOpen(true); };
    window.addEventListener("ec-snippets-add-open", openAdd as EventListener);
    return () => window.removeEventListener("ec-snippets-add-open", openAdd as EventListener);
  }, []);
  useEffect(() => {
    const refreshSnippets = () => setSnippets(loadSnippets());
    window.addEventListener("ec-snippets-updated", refreshSnippets);
    window.addEventListener("storage", refreshSnippets);
    return () => {
      window.removeEventListener("ec-snippets-updated", refreshSnippets);
      window.removeEventListener("storage", refreshSnippets);
    };
  }, []);


  const handleDeleteSnippet = (id: string, title: string) => {
    const next = snippets.filter((s) => s.id !== id);
    setSnippets(next);
    persistSnippets(next);
    toast.success(`Removed "${title}"`);
  };

  const handleAddSnippet = () => {
    if (!newTitle.trim() || !newSubject.trim() || !newBody.trim()) {
      toast.error("Title, subject and body are required");
      return;
    }
    const cat = SNIPPET_CATEGORIES.find((c) => c.id === newCat);
    const item: Snippet = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: newTitle.trim(),
      tag: cat?.label ?? "Custom",
      subject: newSubject.trim(),
      body: newBody.trim(),
      category: newCat,
    };
    // One at a time — append this single snippet only (no bulk pack)
    const next = [item, ...snippets];
    setSnippets(next);
    persistSnippets(next);
    setNewTitle("");
    setNewSubject("");
    setNewBody("");
    // Keep form open so they can immediately add another if they want
    toast.success(`Saved 1 under ${cat?.label ?? "Custom"}. Tap + again anytime for another.`);
  };

  const safeLimit = 500;
  const pct = Math.min(100, Math.round((sentCount / safeLimit) * 100));
  const health = 100;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b1220]/95 text-white backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-brand to-cyan-500 text-white">
            <Activity className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-[15px] font-bold">Elite Radar Hub</h2>
              <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand">LIVE</span>
            </div>
            <p className="text-[11px] text-white/60">Delivery · Quotas · Safeguards</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white/70 hover:bg-white/10" aria-label="Close">
          <X className="size-5" />
        </button>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10 bg-[#0f172a] px-3">
        {([
          ["radar", "Health", Activity],
          ["snippets", "Snippets", Sparkles],
          ["monitor", "Monitor", Radio],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[12px] font-semibold ${
              tab === id ? "border-brand text-brand" : "border-transparent text-white/60"
            }`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4">
        {tab === "radar" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#121c2e] p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Deliverability Health</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">{health}%</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  {health > 90 ? "Grade A+" : "Safe"}
                </span>
              </div>
              <p className="mt-2 text-[12px] text-white/70">The campaign queue tracks delivery status from the server.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-[#121c2e] p-4">
                <div className="flex justify-between text-[12px] text-white/70"><span>Daily Quota</span><Gauge className="size-4 text-cyan-400" /></div>
                <p className="mt-1 text-2xl font-bold">{sentCount}<span className="text-[12px] font-normal text-white/40"> / {safeLimit}</span></p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-brand" style={{ width: `${Math.max(5, pct)}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#121c2e] p-4">
                <div className="flex justify-between text-[12px] text-white/70"><span>Pacing</span><Clock className="size-4 text-brand" /></div>
                <p className="mt-1 text-2xl font-bold text-brand">{pacingSeconds}s</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 className="size-3.5" /> Anti-spam delay</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#121c2e] p-4">
              <h4 className="mb-2 flex items-center gap-2 text-[13px] font-bold"><ShieldCheck className="size-4 text-brand" /> Shields On</h4>
              <div className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2">
                {["Permanent Dedup", "Recipient Syntax Check", "MX Domain Scan", "Google OAuth"].map((t) => (
                  <div key={t} className="flex items-center gap-2 rounded-lg bg-white/5 p-2"><span className="size-2 rounded-full bg-emerald-400" />{t}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "snippets" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 bg-white/5 py-2.5 text-[12px] font-semibold text-white/90"
            >
              <Plus className="size-4" />
              {addOpen ? "Close form" : "Add a template"}
            </button>

            {addOpen && (
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#121c2e] p-3">
                <p className="text-[11px] font-semibold text-white/60">
                  One template at a time · pick a label (you can use Friendly many times)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SNIPPET_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewCat(c.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        newCat === c.id ? "bg-brand text-white" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] outline-none"
                />
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] outline-none"
                />
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Body"
                  rows={4}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSnippet}
                  className="w-full rounded-lg bg-brand py-2 text-[12px] font-semibold"
                >
                  Save this one
                </button>
              </div>
            )}

            {snippets.length === 0 && !addOpen && (
              <div className="rounded-xl border border-white/10 bg-[#121c2e] p-6 text-center">
                <p className="text-[12px] text-white/60">No templates yet.</p>
                <p className="mt-1 text-[11px] text-white/40">Tap “Add a template” — only what you write is saved.</p>
              </div>
            )}

            {snippets.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 bg-[#121c2e] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-[13px] font-bold">{s.title}</h4>
                    <span className="text-[10px] font-semibold text-cyan-400">{s.tag}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(`Subject: ${s.subject}\n\n${s.body}`);
                        setCopiedId(s.id);
                        toast.success("Copied");
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px]"
                    >
                      {copiedId === s.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyTemplate({ subject: s.subject, body: s.body });
                        toast.success("Applied to Template A");
                        onClose();
                      }}
                      className="flex items-center gap-1 rounded-lg bg-brand px-2 py-1 text-[11px] font-semibold"
                    >
                      Apply <ArrowRight className="size-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDeleteSnippet(s.id, s.title)}
                      className="flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 rounded-lg bg-black/30 p-2.5 font-mono text-[11px] text-white/70">
                  <p className="font-bold text-white/90">Subj: {s.subject}</p>
                  <p className="mt-1 whitespace-pre-line">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "monitor" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-[#121c2e] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`size-3 rounded-full ${isSending ? "animate-ping bg-emerald-400" : "bg-white/30"}`} />
                  <span className="text-[13px] font-bold">{isSending ? "Engine transmitting" : "Engine standing by"}</span>
                </div>
                <span className="font-mono text-[11px] text-cyan-400">{activeProfileEmail || "Google OAuth"}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/5 p-2.5"><span className="block text-[11px] text-white/50">Sent</span><span className="text-xl font-bold text-emerald-400">{sentCount}</span></div>
                <div className="rounded-lg bg-white/5 p-2.5"><span className="block text-[11px] text-white/50">Queue</span><span className="text-xl font-bold">{totalCount}</span></div>
                <div className="rounded-lg bg-white/5 p-2.5"><span className="block text-[11px] text-white/50">Vault</span><span className="text-xl font-bold text-amber-400">{quarantineVault.length}</span></div>
              </div>
            </div>
            <p className="rounded-xl border border-white/10 bg-[#121c2e] p-4 text-[12px] text-white/70">
              Keep pacing at 5s minimum. Each Gmail profile keeps its own clean sending timeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
