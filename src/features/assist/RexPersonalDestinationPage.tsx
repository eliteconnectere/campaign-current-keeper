import { useEffect, useState } from "react";
import { ArrowLeft, LayoutDashboard, Trash2, RefreshCw } from "lucide-react";
import { deleteRexPersonalDestination, getRexPersonalDestination, type RexPersonalDestination } from "@/lib/rex-destinations.functions";

export function RexPersonalDestinationPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [destination, setDestination] = useState<RexPersonalDestination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let active = true;
    void getRexPersonalDestination({ data: { id } }).then(result => {
      if (active) setDestination(result.destination);
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : "Could not open this destination.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  async function remove() {
    if (!destination || deleting || !window.confirm("Delete this personal destination? This cannot be undone.")) return;
    setDeleting(true); setError("");
    try { await deleteRexPersonalDestination({ data: { id } }); onBack(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete this destination."); }
    finally { setDeleting(false); }
  }
  return <div className="fixed inset-0 z-[85] overflow-y-auto bg-background">
    <header className="sticky top-0 z-10 border-b border-line bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center gap-3">
      <button onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm font-semibold"><ArrowLeft className="size-4"/> Workspace</button>
      <span className="ml-auto label-caps">Rex Workspace</span>
    </div></header>
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-20">
      {loading ? <div className="rounded-2xl border border-line p-6 text-sm text-ink-soft"><RefreshCw className="mr-2 inline size-4 animate-spin"/>Opening your workspace…</div>
      : error && !destination ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      : destination ? <>
        <section className="rounded-3xl bg-brand/10 p-5">
          <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-brand text-white"><LayoutDashboard className="size-6"/></span><div className="min-w-0"><h1 className="text-xl font-bold text-ink">{destination.name}</h1><p className="text-sm text-ink-soft">Saved personal workspace</p></div></div>
          {destination.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">{destination.description}</p>}
          <p className="mt-4 rounded-xl border border-line bg-background/80 p-3 text-xs leading-relaxed text-ink-soft">This page stores workspace information and plans. It does not, by itself, implement or activate software features, integrations, automations, or live data connections.</p>
        </section>
        {(destination.layout?.sections ?? []).map((section, index) => <section key={index} className="card-shell space-y-3 rounded-2xl border border-line p-4">
          {section.title && <h2 className="text-base font-bold text-ink">{section.title}</h2>}
          {section.content && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{section.content}</p>}
          {section.items?.length ? <ul className="space-y-2">{section.items.map((item, itemIndex) => <li key={itemIndex} className="rounded-xl bg-soft px-3 py-2 text-sm text-ink">{item}</li>)}</ul> : null}
        </section>)}
        <div className="flex justify-end"><button type="button" disabled={deleting} onClick={() => void remove()} className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 disabled:opacity-50"><Trash2 className="size-4"/>{deleting ? "Deleting…" : "Delete destination"}</button></div>
      </> : null}
      {error && destination && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </main>
  </div>;
}
