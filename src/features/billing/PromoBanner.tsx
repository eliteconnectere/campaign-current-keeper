import { useState } from "react";
import { Gift, X } from "lucide-react";
import { COMMUNITY_PROMO, isCommunityPromoMonth } from "@/lib/communityPromo";

/** Small chip + detail sheet explaining November free access (not a free forever plan). */
export function PromoChip({ onOpenPlans }: { onOpenPlans?: () => void }) {
  const [open, setOpen] = useState(false);
  if (!isCommunityPromoMonth()) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand"
      >
        <Gift className="size-3" /> Promo
      </button>
      {open && (
        <div className="fixed inset-0 z-[72] flex items-end justify-center bg-ink/40 px-4 pb-6 pt-10 sm:items-center">
          <div className="w-full max-w-[360px] animate-scale-in rounded-3xl border border-line bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-bold text-ink">{COMMUNITY_PROMO.headline}</p>
                <p className="mt-1 text-[12px] text-ink-soft">Ends {COMMUNITY_PROMO.endsLabel}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-4 text-ink-soft" />
              </button>
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-ink-soft">
              {COMMUNITY_PROMO.notes.map((n) => (
                <li key={n.slice(0, 24)}>{n}</li>
              ))}
            </ul>
            <p className="mt-3 rounded-xl bg-soft px-3 py-2 text-[11px] font-semibold text-ink">
              Paid features after November are not free. Promo is a limited thank-you month from The Bloodline.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-line py-2 text-[12px] font-semibold"
              >
                Got it
              </button>
              {onOpenPlans && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenPlans();
                  }}
                  className="flex-1 rounded-full bg-brand py-2 text-[12px] font-semibold text-white"
                >
                  View plans
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
