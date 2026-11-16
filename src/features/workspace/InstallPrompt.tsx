import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const KEY = "ec.install.dismissed";
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Android/desktop Chrome: shows an Install button a few seconds in (the
 * browser only opens its install sheet after a tap). iPhone/iPad Safari:
 * shows Share → Add to Home Screen instructions.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(KEY) === "1") return;
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    let t: number | undefined;
    if (isIos) {
      setIos(true);
      t = window.setTimeout(() => setShow(true), 3500);
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      t = window.setTimeout(() => setShow(true), 3000);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show || (!evt && !ios)) return null;
  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-md animate-fade-in rounded-2xl border border-line bg-white p-3 shadow-lg">
      <div className="flex items-start gap-2.5">
        <img src="/icon-192.png" alt="" className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-ink">Install Elite Connectere</p>
          {ios ? (
            <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
              Tap <Share className="inline size-3.5 text-brand" /> <b>Share</b> in Safari, then{" "}
              <b>Add to Home Screen</b>. Launch it from your home screen like any app.
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
              Add it to your device for one-tap launch from your home screen or app list, and view your dashboard offline.
            </p>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss">
          <X className="size-4 text-ink-soft" />
        </button>
      </div>
      {evt && !ios && (
        <button
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice.catch(() => undefined);
            setEvt(null);
            setShow(false);
          }}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-brand py-2 text-[12.5px] font-semibold text-white"
        >
          <Download className="size-4" /> Install app
        </button>
      )}
    </div>
  );
}
