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
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Cache the actual HTML documents, not just the JavaScript bundle. Safari must
    // be able to satisfy a fresh top-level navigation to these routes offline.
    const cacheNavigationShells = async () => {
      if (!navigator.onLine || !("caches" in window)) return;
      try {
        const cache = await caches.open("ec-pages");
        const accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
        for (const path of ["/", "/app"]) {
          const url = new URL(path, window.location.origin);
          const request = new Request(url.toString(), {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: accept },
          });
          const response = await fetch(request, { cache: "no-store", redirect: "follow" });
          const contentType = response.headers.get("content-type") ?? "";
          if (!response.ok || response.redirected || !contentType.includes("text/html")) {
            console.warn("[PWA] Navigation shell was not cacheable", path, response.status, response.url);
            continue;
          }
          const html = await response.clone().text();
          await cache.put(request, new Response(html, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          }));

          // AfroVibez also saves the JavaScript and CSS referenced by its
          // cached entry pages. Do the same so the offline HTML can actually boot.
          const document = new DOMParser().parseFromString(html, "text/html");
          const assetUrls = Array.from(
            document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]"),
          )
            .map((element) => element instanceof HTMLScriptElement ? element.src : element.href)
            .filter((asset) => {
              try {
                const assetUrl = new URL(asset, window.location.origin);
                const pathname = assetUrl.pathname.toLowerCase();
                return assetUrl.origin === window.location.origin &&
                  (pathname.startsWith("/assets/") ||
                    [".js", ".mjs", ".css"].some((extension) => pathname.endsWith(extension)));
              } catch {
                return false;
              }
            });
          const assetCache = await caches.open("ec-assets");
          await Promise.all(Array.from(new Set(assetUrls)).map(async (asset) => {
            try {
              const assetUrl = new URL(asset, window.location.origin);
              if (await assetCache.match(assetUrl.toString())) return;
              const assetResponse = await fetch(new Request(assetUrl.toString(), {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
              }));
              if (assetResponse.ok) await assetCache.put(assetUrl.toString(), assetResponse.clone());
            } catch (error) {
              console.warn("[PWA] Could not cache app asset", asset, error);
            }
          }));

          // Verify the same URL can be read back before considering it cached.
          const cached = await cache.match(request);
          if (!cached || !cached.headers.get("content-type")?.includes("text/html")) {
            console.warn("[PWA] Navigation shell cache verification failed", path);
          } else {
            console.info("[PWA] Offline navigation shell and app assets cached", path, assetUrls.length);
          }
        }
      } catch (error) {
        console.warn("[PWA] Could not cache navigation shells", error);
      }
    };

    // The first page may still be uncontrolled during installation. The cache
    // write is safe either way; retries cover the first activation and app boot.
    void cacheNavigationShells();
    window.setTimeout(() => void cacheNavigationShells(), 1500);
    window.setTimeout(() => void cacheNavigationShells(), 5000);
    window.addEventListener("online", () => void cacheNavigationShells());
    window.addEventListener("pageshow", () => void cacheNavigationShells());
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "activated") void cacheNavigationShells();
      });
    });
  } catch (error) {
    console.warn("[PWA] Service worker setup failed; online app remains available", error);
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
