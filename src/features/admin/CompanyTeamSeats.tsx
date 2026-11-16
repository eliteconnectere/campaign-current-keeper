import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, UserX, RefreshCw, ShieldCheck } from "lucide-react";
import { getCompanyTeamSeats, inviteCompanyTeamSeat, revokeCompanyTeamSeat } from "@/lib/company-team.functions";

type Seat = Awaited<ReturnType<typeof getCompanyTeamSeats>>[number];

export function CompanyTeamSeats() {
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSeats(await getCompanyTeamSeats()); }
    catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Company Team Seats.");
      setSeats([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await inviteCompanyTeamSeat({ data: { email } });
      if (!result.ok) { toast.error(result.error); return; }
      setEmail("");
      toast.success(result.seat.status === "active"
        ? "Added as a Company Admin. Their in-app notification is ready."
        : "Invitation saved. They become a Company Admin when they sign in with this email.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add this Company Admin.");
    } finally { setBusy(false); }
  }

  async function revoke(seat: Seat) {
    if (!window.confirm(`Revoke Company Admin access for ${seat.member_email}? Their personal account and data will remain.`)) return;
    setBusy(true);
    try {
      const result = await revokeCompanyTeamSeat({ data: { seatId: seat.id } });
      if (!result.ok) toast.error(result.error);
      else { toast.success("Company Admin access revoked. Their personal account was not deleted."); await load(); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke this seat.");
    } finally { setBusy(false); }
  }

  const used = seats?.filter((seat) => seat.status !== "revoked").length ?? 0;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand" />
          <div>
            <p className="text-sm font-bold text-ink">Company Team Seats</p>
            <p className="text-xs text-ink-soft">Add up to 3 additional Company Admins. You remain the owner.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">Additional seats used</span>
          <span className="font-bold text-brand">{used} / 3</span>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="email" value={email} onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void invite(); }}
            placeholder="person@example.com" aria-label="Company Admin email"
            className="min-w-0 flex-1 rounded-xl border border-line bg-background px-3 py-2.5 text-base outline-none focus:border-brand"
          />
          <button type="button" disabled={busy || used >= 3 || !email.trim()}
            onClick={() => void invite()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
            <UserPlus className="size-4" /> Add
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">Each person signs in with the invited email and receives Company Admin access. They keep their own account, Gmail connections and personal data. Only you can manage these seats.</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Company Admins</p>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><RefreshCw className="size-3" /> Refresh</button>
      </div>
      {!seats ? <p className="text-sm text-ink-soft">Loading Company seats…</p> : seats.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-soft">No additional Company Admins yet.</p>
      ) : (
        <ul className="space-y-2">
          {seats.map((seat) => (
            <li key={seat.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full ${seat.status === "active" ? "bg-emerald-50 text-emerald-700" : seat.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                <ShieldCheck className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{seat.member_email}</span>
                <span className="block text-[11px] capitalize text-ink-soft">{seat.status === "active" ? "Company Admin" : seat.status === "pending" ? "Invitation pending — activates on sign-in" : "Revoked"}</span>
              </span>
              {seat.status !== "revoked" && (
                <button type="button" disabled={busy} onClick={() => void revoke(seat)}
                  aria-label={`Revoke ${seat.member_email}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-2 text-[11px] font-semibold text-red-700 disabled:opacity-40">
                  <UserX className="size-3.5" /> Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
