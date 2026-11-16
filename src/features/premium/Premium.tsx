import { useEffect, useState } from "react";
import { Lock, Unlock, BadgeCheck, Ban, Timer, X } from "lucide-react";
import type { Entitlements } from "@/lib/billing.functions";
import { startEliteCelebration } from "@/lib/elite-celebration";

export type PlanId = "starter" | "standard" | "premium" | "promaxx";

export const PRICES: Record<
  PlanId,
  { title: string; normal: number; promo: number; perks: string }
> = {
  starter: {
    title: "Starter",
    normal: 1200,
    promo: 1000,
    perks: "10 Gmail profiles · 18,000 sends",
  },
  standard: {
    title: "Standard",
    normal: 2400,
    promo: 2000,
    perks: "25 Gmail profiles · 45,000 sends",
  },
  premium: {
    title: "Premium",
    normal: 3600,
    promo: 3000,
    perks: "60 Gmail profiles · 200,000 sends",
  },
  promaxx: {
    title: "Elite Studio ProMaxx",
    normal: 5000,
    promo: 4500,
    perks: "75 Gmail profiles · 300,000 sends · Night Mode · Studios · Sounds",
  },
};

const naira = (n: number) =>
  `\u20a6${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function useCountdown(iso: string) {
  const [left, setLeft] = useState(() => new Date(iso).getTime() - Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setLeft(new Date(iso).getTime() - Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  const clamped = Math.max(left, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    over: clamped <= 0,
    parts: [
      pad(Math.floor(clamped / 86_400_000)),
      pad(Math.floor(clamped / 3_600_000) % 24),
      pad(Math.floor(clamped / 60_000) % 60),
      pad(Math.floor(clamped / 1000) % 60),
    ] as [string, string, string, string],
  };
}

export function Countdown({ endsAt }: { endsAt: string }) {
  const { over, parts } = useCountdown(endsAt);
  if (over) return null;
  return (
    <div className="rounded-xl border border-brand/25 bg-brand-soft px-3 py-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-brand">
        <Timer className="size-3" /> LIMITED-TIME OFFER
      </p>
      <p className="mt-0.5 font-mono text-[15px] font-bold tracking-[0.08em] text-brand">
        {parts.join(" : ")}
      </p>
      <p className="mt-0.5 text-[9.5px] font-semibold tracking-[0.16em] text-brand/70">
        DAYS HRS MIN SEC
      </p>
    </div>
  );
}

export function PriceCard({
  title,
  normal,
  promo,
  promoActive,
  endsAt,
  perks,
  busy,
  onSubscribe,
}: {
  perks?: string;
  busy?: boolean;
  title: string;
  normal: number;
  promo: number;
  promoActive: boolean;
  endsAt: string;
  onSubscribe: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <p className="label-caps">{title}</p>
      {perks && <p className="mt-0.5 text-[10.5px] text-ink-soft">{perks}</p>}
      {promoActive ? (
        <>
          <p className="mt-1 text-[13px] font-semibold text-ink-soft line-through decoration-brand decoration-2">
            {naira(normal)}
          </p>
          <p className="text-[22px] font-bold leading-tight text-ink">
            {naira(promo)}
            <span className="text-[12px] font-semibold text-ink-soft">
              /month
            </span>
          </p>
          <div className="mt-1.5">
            <Countdown endsAt={endsAt} />
          </div>
        </>
      ) : (
        <p className="mt-1 text-[22px] font-bold leading-tight text-ink">
          {naira(normal)}
          <span className="text-[12px] font-semibold text-ink-soft">
            /month
          </span>
        </p>
      )}
      <button
        onClick={onSubscribe}
        disabled={busy}
        className="mt-2 w-full rounded-full bg-brand py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Opening Paystack…" : "Subscribe"}
      </button>
    </div>
  );
}

const BENEFITS: [typeof BadgeCheck, string][] = [
  [Unlock, "Unlock premium Elite Engine access"],
  [Timer, "Unlock 3-second and 4-second sending delays"],
  [BadgeCheck, "Unlock additional Gmail profile access"],
  [Ban, "No Ads — a completely ad-free workspace"],
];

function mapPlanId(p: string): PlanId | null {
  if (p === "starter" || p === "plan1") return "starter";
  if (p === "standard" || p === "plan2") return "standard";
  if (p === "premium" || p === "plan3") return "premium";
  if (p === "promaxx") return "promaxx";
  return null;
}

export function upgradeOptions(current: string, only?: Array<PlanId | string>): PlanId[] {
  const all = Object.keys(PRICES) as PlanId[];
  const cur = mapPlanId(current) ?? (current as PlanId);
  const byPlan =
    cur === "starter"
      ? (["standard", "premium", "promaxx"] as PlanId[])
      : cur === "standard"
        ? (["premium", "promaxx"] as PlanId[])
        : cur === "premium"
          ? (["promaxx"] as PlanId[])
          : all;

  if (!only || only.length === 0) return byPlan;

  const raw = only.map(String);
  if (raw.some((p) => p === "plan3" || p === "premium" || p === "promaxx")) {
    const top: PlanId[] = ["premium", "promaxx"];
    return byPlan.filter((p) => top.includes(p)).length
      ? byPlan.filter((p) => top.includes(p))
      : top;
  }

  const mapped = raw.map(mapPlanId).filter((p): p is PlanId => p != null);
  const filtered = byPlan.filter((p) => mapped.includes(p));
  return filtered.length ? filtered : byPlan;
}

function cleanReason(reason: string): string {
  return reason
    .replace(/Plan\s*3/gi, "Elite Studio ProMaxx")
    .replace(/plan\s*3/gi, "Elite Studio ProMaxx")
    .replace(/Plan\s*2/gi, "Standard")
    .replace(/Plan\s*1/gi, "Starter");
}

export function PremiumUnlock({
  reason,
  entitlements,
  onClose,
  onSubscribe,
  busy,
  error,
  only,
}: {
  only?: Array<PlanId | string> | undefined;
  reason: string;
  entitlements: Entitlements;
  onClose: () => void;
  onSubscribe: (plan: PlanId) => void;
  busy?: PlanId | null | undefined;
  error?: string | null | undefined;
}) {
  const options = upgradeOptions(entitlements.plan, only);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 px-4 pb-4 pt-10 sm:items-center">
      <div className="max-h-full w-full max-w-[360px] animate-scale-in overflow-y-auto rounded-3xl border border-line bg-white p-4">
        <div className="flex items-start gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft">
            <Lock className="size-4 text-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold text-ink">Unlock Elite</p>
            <p className="text-[11.5px] leading-snug text-ink-soft">{cleanReason(reason)}</p>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="size-4 text-ink-soft" />
          </button>
        </div>

        <ul className="mt-3 space-y-1.5">
          {BENEFITS.map(([Icon, text]) => (
            <li key={text} className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
              <Icon className="size-3.5 shrink-0 text-brand" /> {text}
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-2">
          {options.map((id) => (
            <PriceCard
              key={id}
              title={PRICES[id].title}
              perks={PRICES[id].perks}
              normal={PRICES[id].normal}
              promo={PRICES[id].promo}
              promoActive={entitlements.promoActive}
              endsAt={entitlements.promoEndsAt}
              busy={busy === id}
              onSubscribe={() => onSubscribe(id)}
            />
          ))}
        </div>

        {error && <p className="mt-2 text-center text-[11px] font-semibold text-brand">{error}</p>}
        <p className="mt-2.5 text-center text-[10.5px] leading-snug text-ink-soft">
          Secure checkout by Paystack. Each subscription lasts exactly 30 days from payment.
        </p>
      </div>
    </div>
  );
}

/** ~5 second celebration after successful subscription — balloons + confetti + unlock sound. */
export function EliteUnlocked({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const stopCelebration = startEliteCelebration(5000, true);
    const t = window.setTimeout(onClose, 5200);
    return () => {
      stopCelebration();
      window.clearTimeout(t);
    };
  }, [onClose]);
  const balloons = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-ink/40 px-6" onClick={onClose}>
      <style>{`@keyframes ec-balloon{0%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-60vh) rotate(4deg)}100%{transform:translateY(-130vh) rotate(-4deg)}}`}</style>
      {balloons.map((i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute bottom-[-120px] block"
          style={{
            left: `${(i * 8.3 + 3) % 96}%`,
            animation: `ec-balloon ${4 + (i % 4) * 0.6}s ease-in ${(i % 5) * 0.25}s forwards`,
          }}
        >
          <span
            className={`block h-[58px] w-[46px] rounded-[50%] ${i % 3 === 0 ? "bg-brand" : i % 3 === 1 ? "bg-ink" : "bg-brand-soft"}`}
            style={{ boxShadow: "inset -6px -8px 0 rgba(0,0,0,0.12)" }}
          />
          <span className="mx-auto block h-12 w-px bg-ink-soft/60" />
        </span>
      ))}
      <div className="relative w-full max-w-[320px] animate-scale-in rounded-3xl border border-line bg-white p-5 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft">
          <Unlock className="size-5 text-brand" />
        </span>
        <p className="mt-2 text-[18px] font-bold text-ink">PLAN UNLOCKED</p>
        <p className="text-[12px] text-ink-soft">
          Your subscription is active. Enjoy Elite Engine, profiles, and premium tools.
        </p>
      </div>
    </div>
  );
}
