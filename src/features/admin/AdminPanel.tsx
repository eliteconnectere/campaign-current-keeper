import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Shield } from "lucide-react";
import { CompanyTeamSeats } from "@/features/admin/CompanyTeamSeats";
import { adminDecide, adminListSubmissions, adminPulse } from "@/lib/admin.functions";

type Row = Awaited<ReturnType<typeof adminListSubmissions>>[number];
type Pulse = Awaited<ReturnType<typeof adminPulse>>;

export function AdminPanel({ onClose, isOwner = false }: { onClose: () => void; isOwner?: boolean }) {
  const [tab, setTab] = useState<"queue" | "pulse" | "seats">("queue");
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Shield className="size-5 text-brand" /> Company
        </div>
        <button aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-muted">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex gap-2 border-b border-line px-4 py-2">
        {(["queue", "pulse", ...(isOwner ? ["seats" as const] : [])] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === t ? "bg-brand text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            {t === "queue" ? "Complaints & Appeals" : t === "pulse" ? "Live Subscriber Pulse" : "Team Seats"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">{tab === "queue" ? <Queue /> : tab === "pulse" ? <PulseTab /> : isOwner ? <CompanyTeamSeats /> : <p className="text-sm text-muted-foreground">Only the Company owner can manage Team Seats.</p>}</div>
    </div>
  );
}

function Queue() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await adminListSubmissions());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load queue");
      setRows([]);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function decide(id: string, decision: "approved" | "declined", why = "") {
    setBusy(true);
    try {
      const r = await adminDecide({ data: { id, decision, reason: why } });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success('Saved. The user sees “Under Review” for 24 hours, then gets notified.');
        setDeclining(null);
        setReason("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">No submissions yet.</p>;

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const held = r.status === "under_review";
        const done = r.status === "approved" || r.status === "declined";
        return (
          <li key={r.id} className="rounded-xl border border-line bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase">{r.type}</span>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap">{r.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Status: <b>{r.status.replace("_", " ")}</b>
              {held && r.final_decision && r.release_at && (
                <>
                  {" "}
                  · {r.final_decision} — releases {new Date(r.release_at).toLocaleString()}
                </>
              )}
              {done && r.decision_reason && <> · Reason: {r.decision_reason}</>}
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">#{r.id}</p>
            {!done && (
              <div className="mt-3 space-y-2">
                {declining === r.id ? (
                  <>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for declining (sent to the user)"
                      className="w-full rounded-lg border border-line bg-background p-2"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busy || !reason.trim()}
                        onClick={() => decide(r.id, "declined", reason)}
                        className="rounded-lg bg-destructive px-3 py-1.5 font-medium text-destructive-foreground disabled:opacity-50"
                      >
                        Confirm decline
                      </button>
                      <button onClick={() => setDeclining(null)} className="rounded-lg bg-muted px-3 py-1.5">
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => decide(r.id, "approved")}
                      className="rounded-lg bg-brand px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setDeclining(r.id);
                        setReason("");
                      }}
                      className="rounded-lg bg-muted px-3 py-1.5 font-medium"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PulseTab() {
  const [p, setP] = useState<Pulse | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      adminPulse()
        .then((r) => alive && setP(r))
        .catch(() =>
          alive &&
          setP({
            totalRegistered: 0,
            total: 0,
            online: 0,
            offline: 0,
            onlineAll: 0,
            dots: [],
          } as Pulse),
        );
    void tick();
    const t = setInterval(tick, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!p) return <p className="text-sm text-muted-foreground">Loading live pulse…</p>;

  const registered = (p as { totalRegistered?: number }).totalRegistered ?? p.total;
  const online = p.online ?? 0;
  const offline = (p as { offline?: number }).offline ?? Math.max(0, p.total - online);
  const onlineAll = (p as { onlineAll?: number }).onlineAll ?? online;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Registered accounts" value={registered} hint="Everyone in the app" />
        <StatCard label="Paid subscribers" value={p.total} hint="Active paid plans" />
        <StatCard label="Online now" value={online} hint="Paid · last 2 min" green />
        <StatCard label="Offline" value={offline} hint="Paid · not active" />
      </div>

      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-ink">Live presence (anonymous)</p>
          <p className="text-[11px] text-ink-soft">{onlineAll} people active in the app</p>
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">
          Green blinking = online. Red = offline. No names or emails are shown.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(p.dots ?? []).map((on, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-full border border-line bg-background px-2.5 py-1 text-[11px] font-medium text-ink"
            >
              <span
                className={`size-2.5 shrink-0 rounded-full ${
                  on ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500"
                }`}
              />
              {on ? "Online" : "Offline"}
            </div>
          ))}
          {(p.dots ?? []).length === 0 && (
            <p className="text-[12px] text-ink-soft">No subscriber presence yet.</p>
          )}
        </div>
      </div>

      <p className="text-[10px] leading-snug text-ink-soft">
        Presence updates when users open the workspace. Master login sees counts only — identity stays private.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  green,
}: {
  label: string;
  value: number;
  hint: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${green ? "text-emerald-600" : "text-ink"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-ink-soft">{hint}</p>
    </div>
  );
}
