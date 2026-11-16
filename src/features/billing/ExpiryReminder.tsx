import { useCallback, useEffect, useState } from "react";
import { Timer, X } from "lucide-react";

const STORAGE_KEY = "ec.expiry-reminder";

/** Show on-screen when plan ends within `withinDays` (default 7). Reappears ~once per day after dismiss. */
export function ExpiryReminder({
  planEndsAt,
  planLabel,
  withinDays = 7,
  onRenew,
}: {
  planEndsAt: string | null | undefined;
  planLabel?: string;
  withinDays?: number;
  onRenew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [endsLabel, setEndsLabel] = useState("");

  const evaluate = useCallback(() => {
    if (!planEndsAt) {
      setOpen(false);
      return;
    }
    const end = new Date(planEndsAt).getTime();
    if (Number.isNaN(end)) {
      setOpen(false);
      return;
    }
    const msLeft = end - Date.now();
    if (msLeft <= 0 || msLeft > withinDays * 86_400_000) {
      setOpen(false);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { dismissedAt, forEnd } = JSON.parse(raw) as { dismissedAt: number; forEnd: string };
        // Once per ~24h after dismiss (not every few hours)
        if (forEnd === planEndsAt && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
          setOpen(false);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const when = new Date(planEndsAt);
    setEndsLabel(
      when.toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setOpen(true);
  }, [planEndsAt, withinDays]);

  useEffect(() => {
    evaluate();
    const id = window.setInterval(evaluate, 60_000);
    return () => window.clearInterval(id);
  }, [evaluate]);

  const dismiss = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ dismissedAt: Date.now(), forEnd: planEndsAt }),
      );
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 px-4 pb-6 pt-10 sm:items-center">
      <div className="w-full max-w-[340px] animate-scale-in rounded-3xl border border-line bg-white p-4 shadow-xl">
        <div className="flex items-start gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft">
            <Timer className="size-4 text-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-ink">Subscription ending soon</p>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
              {planLabel ? <strong className="text-ink">{planLabel}</strong> : "Your plan"} ends on{" "}
              <strong className="text-ink">{endsLabel}</strong>. Renew so sending, profiles, and shared
              access keep working without interruption.
            </p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="p-1">
            <X className="size-4 text-ink-soft" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-full border border-line py-2 text-[12px] font-semibold text-ink"
          >
            Remind me later
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss();
              onRenew?.();
            }}
            className="flex-1 rounded-full bg-brand py-2 text-[12px] font-semibold text-white"
          >
            Renew
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-ink-soft">
          Reminder starts up to 7 days before the end, about once a day until you renew.
        </p>
      </div>
    </div>
  );
}
