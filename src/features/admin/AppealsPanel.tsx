import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { X, LifeBuoy } from "lucide-react";
import { mySubmissions, submitToAdmin } from "@/lib/admin.functions";
import { myGuardianRestriction } from "@/lib/guardian.functions";

type Item = Awaited<ReturnType<typeof mySubmissions>>[number];

const LABEL: Record<string, string> = {
  pending: "Received",
  under_review: "Under Review",
  approved: "Approved",
  declined: "Declined",
};

export function AppealsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [type, setType] = useState("appeal");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [restriction, setRestriction] = useState<Awaited<ReturnType<typeof myGuardianRestriction>>>(null);

  const load = useCallback(async () => {
    try {
      const [submissions, activeRestriction] = await Promise.all([mySubmissions(), myGuardianRestriction()]);
      setItems(submissions);
      setRestriction(activeRestriction);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function send() {
    setBusy(true);
    try {
      const r = await submitToAdmin({ data: { type, body } });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Sent. Our team usually replies within 2–3 days.");
        setBody("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <LifeBuoy className="size-5 text-brand" /> Appeals & Support
        </div>
        <button aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-muted">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {restriction && (
          <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <p className="font-semibold text-destructive">Temporary sending restriction</p>
            <p>{restriction.reason}</p>
            <p className="text-xs text-muted-foreground">Sending is paused until {new Date(restriction.expires_at).toLocaleString()}. Your login and other account access remain available.</p>
            <p className="text-xs text-muted-foreground">Choose “Appeal a decision” below to request a review.</p>
          </div>
        )}
        <div className="space-y-2 rounded-xl border border-line bg-card p-3">
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-line bg-background p-2">
            <option value="appeal">Appeal a decision</option>
            <option value="complaint">Complaint</option>
            <option value="report">Report a problem</option>
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Explain what happened"
            className="w-full rounded-lg border border-line bg-background p-2"
          />
          <button
            disabled={busy || !body.trim()}
            onClick={send}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
          >
            Send to Elite Connectere
          </button>
          <p className="text-xs text-muted-foreground">Reviews take 2–3 days. Final decisions on appeals are permanent.</p>
        </div>
        {items === null ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id} className="rounded-xl border border-line bg-card p-3">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold uppercase">{s.type}</span>
                  <span className="font-semibold">{LABEL[s.status] ?? s.status}</span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{s.body}</p>
                {s.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {s.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
