import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Save, Loader2, LayoutDashboard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getRexDynamicFeature, saveRexDynamicFeatureData } from "@/lib/rex-dynamic-features.functions";

type FeatureComponent = {
  type: "heading" | "text" | "card" | "stat" | "list" | "table" | "form";
  title?: string;
  content?: string;
  value?: string;
  items?: string[];
  columns?: string[];
  fields?: Array<{ key: string; label: string; input?: "text" | "number" | "date" | "email" | "textarea" }>;
};
type FeatureRecord = { id: string; name: string; description: string; blueprint: { components?: FeatureComponent[] }; version: number };

export function RexDynamicFeaturePage({ id, onBack }: { id: string; onBack: () => void }) {
  const [feature, setFeature] = useState<FeatureRecord | null>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getRexDynamicFeature({ data: { id } }).then(result => {
      if (!active) return;
      setFeature(result.feature as FeatureRecord);
      setData((result.data ?? {}) as Record<string, any>);
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : "Could not open this feature.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function persist(next: Record<string, any>) {
    if (saving) return;
    setSaving(true);
    try {
      await saveRexDynamicFeatureData({ data: { id, data: next } });
      setData(next);
      toast.success("Feature data saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save feature data.");
    } finally { setSaving(false); }
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = Array.isArray(data["entries"]) ? data["entries"] : [];
    const next = { ...data, entries: [...entries, { ...form, _createdAt: new Date().toISOString() }] };
    void persist(next);
    setForm({});
  }

  const components = (feature?.blueprint?.components ?? []).filter(c =>
    ["heading","text","card","stat","list","table","form"].includes(c.type)
  );

  return <div className="fixed inset-0 z-[95] overflow-y-auto bg-background">
    <header className="sticky top-0 z-20 border-b border-line bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm font-semibold"><ArrowLeft className="size-4"/> Workspace</button>
        <span className="ml-auto label-caps">Rex Dynamic Feature</span>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-7 pb-24">
      {loading ? <div className="flex items-center justify-center gap-2 py-20 text-ink-soft"><Loader2 className="size-5 animate-spin"/> Loading your feature…</div> :
      error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-600">{error}</div> :
      feature ? <>
        <div className="rounded-3xl border border-brand/25 bg-brand-soft/40 p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand"><LayoutDashboard className="size-4"/> Published personal page</div>
          <h1 className="text-2xl font-bold text-ink">{feature.name}</h1>
          {feature.description && <p className="mt-2 text-sm leading-6 text-ink-soft">{feature.description}</p>}
        </div>
        {components.map((item, index) => <section key={index} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          {item.type === "heading" && <div><h2 className="text-xl font-bold text-ink">{item.title}</h2>{item.content && <p className="mt-1 text-sm text-ink-soft">{item.content}</p>}</div>}
          {item.type === "text" && <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{item.content || item.title}</p>}
          {item.type === "card" && <div><h3 className="font-bold text-ink">{item.title || "Details"}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{item.content}</p></div>}
          {item.type === "stat" && <div><p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{item.title || "Overview"}</p><p className="mt-2 text-3xl font-bold text-brand">{item.value || "—"}</p>{item.content && <p className="mt-1 text-xs text-ink-soft">{item.content}</p>}</div>}
          {item.type === "list" && <div><h3 className="font-bold text-ink">{item.title || "List"}</h3><ul className="mt-3 space-y-2">{(item.items ?? []).map((entry, i) => <li key={i} className="flex gap-2 text-sm text-ink"><span className="text-brand">•</span><span>{entry}</span></li>)}</ul></div>}
          {item.type === "table" && <div><h3 className="font-bold text-ink">{item.title || "Saved entries"}</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{(item.columns?.length ? item.columns : ["Entry"]).map((col,i)=><th key={i} className="border-b border-line px-2 py-2 font-semibold text-ink-soft">{col}</th>)}</tr></thead><tbody>{(Array.isArray(data["entries"]) ? data["entries"] : []).map((row: any,i: number)=><tr key={i}>{(item.columns?.length ? item.columns : ["Entry"]).map((col,j)=><td key={j} className="border-b border-line/70 px-2 py-2 text-ink">{String(row[String(col).toLowerCase().replace(/[^a-z0-9]+/g,"_")] ?? Object.values(row).filter(v=>typeof v==="string")[j] ?? "—")}</td>)}</tr>)}</tbody></table>{!data["entries"]?.length && <p className="py-4 text-sm text-ink-soft">No entries yet. Add one using the form below.</p>}</div></div>}
          {item.type === "form" && <form onSubmit={submitForm} className="space-y-3"><div><h3 className="font-bold text-ink">{item.title || "Add an entry"}</h3>{item.content && <p className="mt-1 text-sm text-ink-soft">{item.content}</p>}</div>{(item.fields ?? []).map(field=><label key={field.key} className="block space-y-1.5 text-sm font-medium text-ink">{field.label}{field.input === "textarea" ? <textarea required value={form[field.key] ?? ""} onChange={e=>setForm(v=>({...v,[field.key]:e.target.value}))} className="min-h-24 w-full rounded-xl border border-line bg-background p-3"/> : <input required type={field.input === "number" ? "number" : field.input === "date" ? "date" : field.input === "email" ? "email" : "text"} value={form[field.key] ?? ""} onChange={e=>setForm(v=>({...v,[field.key]:e.target.value}))} className="min-h-11 w-full rounded-xl border border-line bg-background px-3"/>}</label>)}<button disabled={saving || !(item.fields?.length)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white disabled:opacity-50"><Save className="size-4"/> {saving ? "Saving…" : "Save entry"}</button></form>}
        </section>)}
        <div className="flex items-center gap-2 text-xs text-ink-soft"><CheckCircle2 className="size-4 text-brand"/> Private to your signed-in account · Feature version {feature.version}</div>
      </> : null}
    </main>
  </div>;
}
