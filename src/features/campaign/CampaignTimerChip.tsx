import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";

function formatEta(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatClock(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

export type CampaignTimerChipProps = {
  /** True while Engine / campaign is actively sending */
  active: boolean;
  /** Emails still left in the selected range */
  remaining: number;
  /** Per-send delay in whole seconds (e.g. 3, 4, 5) */
  delaySeconds: number;
  /** Total in range (for the detail sheet) */
  totalInRange?: number;
  /** Already sent in this run */
  sentInRun?: number;
  /** Seconds until the next send is due, from the live engine clock. */
  nextInSeconds?: number | null;
  className?: string;
};

/**
 * Live campaign ETA chip — sits near Promo.
 * Counts down second-by-second (39 → 38 → 37…).
 * Uses the live next-send countdown plus the configured intervals for the remaining recipients.
 * Recalibrates against the phone's wall clock whenever the engine reports a new send.
 */
export function CampaignTimerChip({
  active,
  remaining,
  delaySeconds,
  totalInRange,
  sentInRun,
  nextInSeconds = null,
  className = "",
}: CampaignTimerChipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endAtRef = useRef<number>(0);

  const delay = Math.max(1, Math.floor(delaySeconds) || 3);
  const left = Math.max(0, Math.floor(remaining));
  // Use the engine's live next-send countdown when available. The first
  // recipient is already in flight at campaign start, so use the selected
  // delay as the initial estimate until the engine publishes its live clock.
  const firstWaitSeconds = Number.isFinite(nextInSeconds)
    ? Math.max(0, Number(nextInSeconds))
    : delay;
  const plannedMs = (left <= 0 ? 0 : firstWaitSeconds + Math.max(0, left - 1) * delay) * 1000;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Recalibrate end time whenever remaining count or delay changes (each successful send)
  useEffect(() => {
    if (!active) return;
    endAtRef.current = Date.now() + plannedMs;
    setNow(Date.now());
  }, [active, left, delay, plannedMs, nextInSeconds]);

  // Tick every 250ms so the second display feels tight and real
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);

  const secsLeft = useMemo(() => {
    if (!active) return 0;
    if (left <= 0) return 0;
    const raw = Math.ceil((endAtRef.current - now) / 1000);
    // Never show more than the pure math ceiling; never go negative while emails remain
    return Math.max(0, Math.min(left * delay, raw));
  }, [active, left, delay, now]);

  const endAt = active && left > 0 ? endAtRef.current : 0;


  if (!active && !open) return null;

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-line bg-white p-4 shadow-xl dark:bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Campaign timer</p>
                  <h3 className="text-base font-bold text-ink">Live countdown</h3>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1" aria-label="Close">
                  <X className="size-4 text-ink-soft" />
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-brand/25 bg-brand-soft px-3 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand">Time left</p>
                <p className="text-3xl font-bold tabular-nums tracking-tight text-ink">{formatEta(secsLeft)}</p>
                <p className="mt-1 text-[12px] text-ink-soft">
                  {left} left · {delay}s between each send
                </p>
                {endAt > 0 && (
                  <p className="mt-2 rounded-lg bg-white/70 px-2 py-1.5 text-[12px] font-semibold text-ink dark:bg-black/20">
                    Expected to finish around{" "}
                    <span className="text-brand">{formatClock(endAt)}</span>
                  </p>
                )}
              </div>

              <ul className="mt-3 space-y-2 text-[13px] leading-snug text-ink-soft">
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span>
                    The chip counts <strong>real seconds</strong> (39 → 38 → 37…). After each send it re-checks how
                    many emails are left and resets the clock using your delay.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span>
                    Estimate: time until the next send + the selected delay for each later recipient.
                    The expected finish clock uses your phone's local time.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span>
                    The finish time is an estimate based on the selected delay and the engine's live next-send clock.
                    It recalculates as recipients are confirmed. Completion alerts play only after the engine confirms
                    the campaign has finished.
                  </span>
                </li>
                {(totalInRange != null || sentInRun != null) && (
                  <li className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                    <span>
                      Progress: {sentInRun ?? 0}
                      {totalInRange != null ? ` / ${totalInRange}` : ""} in this range.
                    </span>
                  </li>
                )}
              </ul>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white"
              >
                Got it
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (!active) {
    return <>{dialog}</>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink shadow-sm ${className}`}
        aria-label="Campaign timer details"
        title="Tap for timing details"
      >
        <Clock className="size-3 text-brand" />
        <span className="tabular-nums text-brand">{left <= 0 ? "Done" : formatEta(secsLeft)}</span>
        <span className="font-semibold text-ink-soft">· {left} left</span>
      </button>
      {dialog}
    </>
  );
}
