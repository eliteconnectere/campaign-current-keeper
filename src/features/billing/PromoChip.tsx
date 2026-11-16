import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  COMMUNITY_PROMO,
  communityPromoDaysLeft,
  isCommunityPromoMonth,
} from "@/lib/communityPromo";
import { X } from "lucide-react";
import { listMyTeamSeats } from "@/lib/team.functions";

const OPEN_KEY = "ec.promo-dialog-open";

function readOpen() {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOpen(v: boolean) {
  try {
    if (v) sessionStorage.setItem(OPEN_KEY, "1");
    else sessionStorage.removeItem(OPEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Small mark for free / community-promo users during November. */
export function PromoChip({
  isFreeUser,
  className = "",
}: {
  isFreeUser: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hotspotOwnerEmail, setHotspotOwnerEmail] = useState<string | null>(null);
  const [hotspotOwnerName, setHotspotOwnerName] = useState<string | null>(null);
  const [isHotspotMember, setIsHotspotMember] = useState(false);
  const daysLeft = communityPromoDaysLeft();

  const refreshHotspotMode = useCallback(async () => {
    try {
      const res = await listMyTeamSeats();
      const activeMembership = res.membership?.status === "active";
      setIsHotspotMember(activeMembership);
      setHotspotOwnerEmail(activeMembership ? (res.membership?.owner_email ?? null) : null);
      setHotspotOwnerName(activeMembership ? (res.membership?.owner_name ?? null) : null);
    } catch (error) {
      console.error("Could not refresh Hotspot mode", error);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (readOpen()) setOpen(true);
    void refreshHotspotMode();
    const refresh = () => { void refreshHotspotMode(); };
    window.addEventListener("ec:workspace-refresh", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("ec:workspace-refresh", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [refreshHotspotMode]);

  const showPromoChip = isCommunityPromoMonth() && isFreeUser;
  const showChip = isHotspotMember || showPromoChip;

  if (!isHotspotMember && !isCommunityPromoMonth()) return null;
  if (!showChip && !open) return null;

  const close = () => {
    setOpen(false);
    writeOpen(false);
  };
  const openDialog = () => {
    setOpen(true);
    writeOpen(true);
  };

  const daysLabel =
    daysLeft <= 0
      ? "Ends today"
      : daysLeft === 1
        ? "1 day left"
        : `${daysLeft} days left`;

  const hotspotDialog =
    open && mounted && isHotspotMember
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hotspot-mode-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 id="hotspot-mode-title" className="text-[16px] font-bold text-ink">Hotspot Mode</h3>
                <button type="button" onClick={close} className="rounded-full p-1.5" aria-label="Close">
                  <X className="size-5 text-ink-soft" />
                </button>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                Your plan access is being shared by:
              </p>
              {hotspotOwnerEmail ? (
                <div className="mt-3 rounded-xl border border-brand/30 bg-brand-soft px-3 py-3 text-center">
                  <p className="text-[15px] font-bold text-brand">{hotspotOwnerName || hotspotOwnerEmail}</p>
                  <a href={`mailto:${hotspotOwnerEmail}`} className="mt-1 block break-all text-[12px] text-ink-soft">
                    {hotspotOwnerEmail}
                  </a>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-line bg-soft px-3 py-3 text-center text-[13px] text-ink-soft">
                  Supporter email is temporarily unavailable.
                </p>
              )}
              <button
                type="button"
                onClick={close}
                className="mt-4 w-full rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white"
              >
                CLOSE
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  const promoDialog =
    open && mounted && !isHotspotMember
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/55 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl dark:bg-card sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border sm:border-line"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand">The Bloodline 💯</p>
                  <h3 className="text-[17px] font-bold leading-snug text-ink">{COMMUNITY_PROMO.headline}</h3>
                  <p className="mt-1 text-[12px] leading-snug text-ink-soft">{COMMUNITY_PROMO.subheading}</p>
                </div>
                <button type="button" onClick={close} className="rounded-full p-1.5" aria-label="Close">
                  <X className="size-5 text-ink-soft" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand">{COMMUNITY_PROMO.privilegeTitle}</p>
                  <p className="mt-1 text-[13px] font-bold text-ink">{COMMUNITY_PROMO.privilegeLead}</p>
                  <p className="mt-2 text-2xl font-bold text-brand">{daysLabel}</p>
                  <p className="text-[12px] text-ink-soft">Your November experience ends on {COMMUNITY_PROMO.endsLabel}.</p>
                </div>

                <section className="mt-5">
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">{COMMUNITY_PROMO.welcomeTitle}</h4>
                  <div className="mt-2 space-y-2.5 text-[13px] leading-relaxed text-ink-soft">
                    {COMMUNITY_PROMO.welcomeBody.map((p) => (
                      <p key={p.slice(0, 24)}>{p}</p>
                    ))}
                  </div>
                </section>

                <section className="mt-5">
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">{COMMUNITY_PROMO.giftTitle}</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{COMMUNITY_PROMO.giftIntro}</p>
                  <p className="mt-3 text-[13px] font-semibold text-ink">Here’s what awaits you:</p>
                  <ul className="mt-2 space-y-3">
                    {COMMUNITY_PROMO.giftItems.map((item) => (
                      <li key={item.title} className="rounded-xl border border-line bg-soft/60 px-3 py-2.5">
                        <p className="text-[13px] font-semibold text-ink">
                          <span className="mr-1.5">{item.icon}</span>
                          {item.title}
                        </p>
                        <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{item.body}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12.5px] text-ink-soft">And there’s much more to explore.</p>
                </section>

                <section className="mt-5">
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">{COMMUNITY_PROMO.promiseTitle}</h4>
                  <div className="mt-2 space-y-2.5 text-[13px] leading-relaxed text-ink-soft">
                    {COMMUNITY_PROMO.promiseBody.map((p) => (
                      <p key={p.slice(0, 24)}>{p}</p>
                    ))}
                  </div>
                </section>

                <section className="mt-5">
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">{COMMUNITY_PROMO.afterTitle}</h4>
                  <div className="mt-2 space-y-2.5 text-[13px] leading-relaxed text-ink-soft">
                    {COMMUNITY_PROMO.afterBody.map((p) => (
                      <p key={p.slice(0, 24)}>{p}</p>
                    ))}
                  </div>
                </section>

                <section className="mt-5 mb-2">
                  <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">{COMMUNITY_PROMO.closingTitle}</h4>
                  <div className="mt-2 space-y-2.5 text-[13px] leading-relaxed text-ink-soft">
                    {COMMUNITY_PROMO.closingBody.map((p) => (
                      <p key={p.slice(0, 24)}>{p}</p>
                    ))}
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-ink">{COMMUNITY_PROMO.signOff}</p>
                </section>
              </div>

              <div className="shrink-0 border-t border-line px-4 py-3">
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-full bg-brand py-3 text-[14px] font-semibold text-white"
                >
                  GOT IT — THANK YOU
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {showChip && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openDialog();
          }}
          className={`inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand shadow-sm ${className}`}
          aria-label={isHotspotMember ? "Hotspot mode details" : "Promo details"}
        >
          {isHotspotMember ? "Hotspot Mode" : `Promo · ${daysLabel}`}
        </button>
      )}
      {isHotspotMember ? hotspotDialog : promoDialog}
    </>
  );
}
