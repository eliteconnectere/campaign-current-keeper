/** Single guarded service-worker registrar. Never registers in dev, preview or iframes. */
export async function registerAppWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const h = window.location.hostname;
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
    );
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    /* installable app is optional */
  }
}


/** Check for and activate a newly deployed app shell before a user-triggered reload. */
export async function updateAppWorker(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    let registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) {
      await registerAppWorker();
      registration = await navigator.serviceWorker.getRegistration("/");
    }
    if (!registration) return false;

    const waitForController = async () => {
      if (!navigator.serviceWorker.controller) return;
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => resolve(), 5000);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    };

    await registration.update();
    if (registration.waiting) {
      const controllerChange = waitForController();
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      await controllerChange;
      return true;
    }

    const worker = registration.installing;
    if (!worker) return false;
    const installed = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 7000);
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          window.clearTimeout(timeout);
          resolve(true);
        } else if (worker.state === "redundant") {
          window.clearTimeout(timeout);
          resolve(false);
        }
      });
    });
    if (!installed) return false;

    const controllerChange = waitForController();
    worker.postMessage({ type: "SKIP_WAITING" });
    await controllerChange;
    return true;
  } catch (error) {
    console.warn("[PWA] App update check failed; the page can still be refreshed.", error);
    return false;
  }
}
