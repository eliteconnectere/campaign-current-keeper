import { useEffect, useState } from "react";
import { X, Hand } from "lucide-react";

export type GuidePayload = {
  title: string;
  body: string;
  steps?: string[];
};

/** Fire from anywhere: window.dispatchEvent(new CustomEvent("ec:error-guide", { detail: {...} })) */
export function showErrorGuide(detail: GuidePayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ec:error-guide", { detail }));
}

/**
 * Lightweight assistant card — one tip at a time when the user hits a rule wall
 * (e.g. Permanent Send Protection / finished range). Not a full tour dump.
 */
export function ErrorGuideHost() {
  const [guide, setGuide] = useState<GuidePayload | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<GuidePayload>).detail;
      if (d?.title && d?.body) setGuide(d);
    };
    window.addEventListener("ec:error-guide", on);
    return () => window.removeEventListener("ec:error-guide", on);
  }, []);

  if (!guide) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[68] w-[min(340px,92vw)] -translate-x-1/2 animate-fade-in rounded-2xl border border-line bg-card p-3 shadow-lg">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft">
          <Hand className="size-4 text-brand" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">{guide.title}</p>
          <p className="mt-1 text-[12px] leading-snug text-ink-soft">{guide.body}</p>
          {guide.steps && guide.steps.length > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11.5px] text-ink">
              {guide.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
        </div>
        <button type="button" onClick={() => setGuide(null)} aria-label="Close" className="p-0.5">
          <X className="size-4 text-ink-soft" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setGuide(null)}
        className="mt-2 w-full rounded-full bg-brand py-1.5 text-[12px] font-semibold text-white"
      >
        Got it
      </button>
    </div>
  );
}
