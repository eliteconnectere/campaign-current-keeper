import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Pencil, Check, X, Loader2, Copy } from "lucide-react";
import {
  listMyTeamSeats,
  inviteTeamMember,
  acceptTeamInvite,
  revokeTeamSeat,
  updateAssistantSeat,
  type TeamSeatView,
} from "@/lib/team.functions";

function fireConfetti() {
  if (typeof document === "undefined") return;
  const colors = ["#e11d48", "#2563eb", "#ffffff", "#fbbf24", "#22c55e"];
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(root);
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("div");
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const dur = 1.2 + Math.random() * 1.2;
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;top:-12px;left:${left}%;width:${size}px;height:${size * 0.6}px;
      background:${colors[i % colors.length]};opacity:0.95;border-radius:2px;
      animation:ec-confetti ${dur}s ease-out ${delay}s forwards`;
    root.appendChild(p);
  }
  if (!document.getElementById("ec-confetti-style")) {
    const style = document.createElement("style");
    style.id = "ec-confetti-style";
    style.textContent = `@keyframes ec-confetti{0%{transform:translateY(0) rotate(0);opacity:1}
      100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`;
    document.head.appendChild(style);
  }
  window.setTimeout(() => root.remove(), 2800);
}

export function TeamPanel({ onClose }: { onClose?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [seats, setSeats] = useState<TeamSeatView[]>([]);
  const [gmailPool, setGmailPool] = useState<{ planLimit: number; ownerConnected: number; ownerReservations: number; memberAllocated: number; reserved: number; remaining: number } | null>(null);
  const [sharingBlocked, setSharingBlocked] = useState(false);
  const [sharingBlockReason, setSharingBlockReason] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{ member_email: string; created_at: string } | null>(null);
  const [membership, setMembership] = useState<{
    owner_user_id: string;
    status: string;
    member_email: string;
    max_gmail_profiles?: number;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [maxGmails, setMaxGmails] = useState(1);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [editingCap, setEditingCap] = useState<number>(1);
  const [editingShareSnippets, setEditingShareSnippets] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyTeamSeats();
      setCanManage(res.canManage);
      setSeats(res.seats);
      setGmailPool(res.gmailPool ?? null);
      setSharingBlocked(Boolean(res.canManage && res.sharingBlocked));
      setSharingBlockReason(res.canManage ? (res.sharingBlockReason ?? null) : null);
      setPendingInvite(res.pendingInvite ?? null);
      setMembership(res.membership);
    } catch (e) {
      console.error(e);
      toast.error("Could not load hotspot access settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPerson = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await inviteTeamMember({
        data: { email: email.trim(), maxGmailProfiles: maxGmails },
      });
      if (!res.ok) {
        toast.error(res.error || "Could not share access");
        return;
      }
      fireConfetti();
      toast.success(`Hotspot shared to ${email.trim().toLowerCase()} · max ${maxGmails} Gmail(s)`);
      setEmail("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not share access");
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    try {
      const res = await acceptTeamInvite({ data: {} });
      if (!res.ok) {
        toast.error(res.error || "No pending hotspot access for this login");
        return;
      }
      fireConfetti();
      toast.success("Hotspot access active — connect your Gmails and start sending.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  };

  const saveCap = async (seatId: string) => {
    setBusy(true);
    try {
      const res = await updateAssistantSeat({
        data: { seatId, maxGmailProfiles: editingCap, shareSnippets: editingShareSnippets },
      });
      if (!res.ok) {
        toast.error(res.error || "Could not update limit");
        return;
      }
      toast.success(`Updated limit to ${editingCap} Gmail(s)`);
      setEditingSeatId(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (seatId: string) => {
    if (!window.confirm("Stop sharing hotspot access with this user?")) return;
    setBusy(true);
    try {
      const res = await revokeTeamSeat({ data: { seatId } });
      if (!res.ok) {
        toast.error(res.error || "Could not remove");
        return;
      }
      toast.success("Access removed");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (seat: TeamSeatView) => {
    const link = `${window.location.origin}/app?team_invite=${seat.invite_token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(seat.id);
      toast.success("Invite link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.message(link);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-ink-soft">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-soft p-2">
          <Users className="size-5 text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-ink">Hotspot Access</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
            Share your subscription with other people. Each person keeps their own login, Gmail connections,
            campaigns and private data. Each Gmail limit you assign is reserved immediately from your subscription's shared total.
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-[12px] font-semibold text-brand">
            Close
          </button>
        )}
      </div>

      {sharingBlocked && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
          <p className="font-bold">Hotspot sharing automatically paused</p>
          <p className="mt-1">{sharingBlockReason ?? "A subscription warning is active. Members cannot use the shared plan until the warning clears."}</p>
        </div>
      )}

      {canManage && gmailPool && (
        <div className="rounded-xl border border-line bg-soft px-3 py-2.5 text-[11.5px] text-ink-soft">
          <p className="font-bold text-ink">Shared Gmail allocation</p>
          <p className="mt-1">
            {gmailPool.planLimit} plan slots · {gmailPool.ownerConnected} connected by you ·
            {" "}{gmailPool.memberAllocated} reserved for members · {gmailPool.remaining} available
          </p>
          {gmailPool.remaining < 1 && (
            <p className="mt-1 font-semibold text-amber-700">No unallocated Gmail slots remain. Free a slot or reduce a member's allocation before inviting another person.</p>
          )}
        </div>
      )}

      {membership && !canManage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          Hotspot access active · Gmail limit:{" "}
          <strong>{membership.max_gmail_profiles ?? 1}</strong>
        </div>
      )}

      {!membership && pendingInvite && (
        <div className="rounded-xl border border-line bg-soft px-3 py-3 text-[12px] text-ink-soft">
          A hotspot invitation is waiting for {pendingInvite.member_email}.
          <button
            type="button"
            disabled={busy}
            onClick={() => void accept()}
            className="mt-2 block w-full rounded-full bg-brand py-2 text-center text-[12px] font-semibold text-white"
          >
            Accept hotspot access
          </button>
        </div>
      )}

      {canManage && (
        <>
          <div className="rounded-xl border border-line bg-card p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              Shared Hotspot Access · {seats.length} member(s)
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their@email.com"
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-[13px] outline-none focus:border-ink/30"
            />
            <label className="mt-2 flex items-center justify-between gap-2 text-[12px] text-ink">
              <span>Max Gmails they can connect</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, gmailPool?.remaining ?? 75)}
                value={maxGmails}
                onChange={(e) => setMaxGmails(Math.min(Math.max(1, gmailPool?.remaining ?? 75), Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-line px-2 py-1 text-right text-[13px] font-semibold"
              />
            </label>
            <button
              type="button"
              disabled={busy || sharingBlocked || !email.trim() || (gmailPool != null && gmailPool.remaining < 1)}
              onClick={() => void addPerson()}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-full bg-brand px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              <UserPlus className="size-3.5" /> Share access
            </button>
          </div>

          <ul className="space-y-2">
            {seats.length === 0 && (
              <li className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">
                No one connected yet. You can invite members and manage each person's Gmail limit.
              </li>
            )}
            {seats.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{s.member_email}</p>
                  <p className="text-[11px] text-ink-soft">
                    {s.status === "active"
                      ? `Active · max ${s.max_gmail_profiles ?? 1} Gmail(s)`
                      : `Waiting · max ${s.max_gmail_profiles ?? 1} Gmail(s)`}
                  </p>
                </div>
                {s.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void copyLink(s)}
                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-brand"
                    title="Copy invite link"
                  >
                    {copiedId === s.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                )}
                {editingSeatId === s.id ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, (gmailPool?.remaining ?? 0) + (s.max_gmail_profiles ?? 1))}
                        value={editingCap}
                        onChange={(e) =>
                          setEditingCap(Math.min(Math.max(1, (gmailPool?.remaining ?? 0) + (s.max_gmail_profiles ?? 1)), Math.max(1, Number(e.target.value) || 1)))
                        }
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
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSeatId(s.id);
                      setEditingCap(s.max_gmail_profiles ?? 1);
                      setEditingShareSnippets(Boolean(s.share_snippets));
                    }}
                    className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-brand"
                    title="Edit Gmail limit"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void revoke(s.id)}
                  className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
