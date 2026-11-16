import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function describeRouteError(error: unknown): { title: string; diagnostic: string; likelyCause: string } {
  if (error instanceof Response) {
    return {
      title: `Request failed (HTTP ${error.status})`,
      diagnostic: [`HTTP ${error.status} ${error.statusText}`, error.url ? `URL: ${error.url}` : ""].filter(Boolean).join("\\n"),
      likelyCause: error.status === 401 || error.status === 403
        ? "The request may require a valid sign-in or permission."
        : error.status >= 500
          ? "The server or a backend dependency returned an error."
          : "The requested route or resource could not be loaded.",
    };
  }

  const candidate = error as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown } | null;
  const name = typeof candidate?.name === "string" ? candidate.name : "UnknownError";
  const message = typeof candidate?.message === "string" ? candidate.message : String(error);
  const stack = typeof candidate?.stack === "string" ? candidate.stack : "";
  const cause = candidate?.cause instanceof Error ? candidate.cause.message : "";
  const likelyCause = name === "ReferenceError"
    ? "The page referenced a variable or symbol that is not defined at runtime."
    : name === "TypeError"
      ? "The page tried to use a value in an invalid way (often missing or unexpected data)."
      : name === "SyntaxError"
        ? "A script or data payload could not be parsed."
        : "The technical message and stack below identify the failure; the exact cause may need code-level inspection.";
  return {
    title: `${name}: ${message}`.slice(0, 500),
    diagnostic: [`${name}: ${message}`, cause ? `Cause: ${cause}` : "", stack].filter(Boolean).join("\\n").slice(0, 12000),
    likelyCause,
  };
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("[Elite Connectere route error]", error);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const occurredAt = useState(() => new Date().toISOString())[0];
  const details = describeRouteError(error);
  const diagnostic = [
    "Elite Connectere error report",
    `Page: ${typeof window !== "undefined" ? window.location.href : "server render"}`,
    `Occurred: ${occurredAt}`,
    `Summary: ${details.title}`,
    `Likely cause: ${details.likelyCause}`,
    details.diagnostic,
  ].filter(Boolean).join("\\n");

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component", route: typeof window !== "undefined" ? window.location.pathname : "server" });
  }, [error]);

  async function copyDiagnostic() {
    try {
      await navigator.clipboard.writeText(diagnostic);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-destructive/30 bg-card p-5 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The app caught an error. Open the details below to see the actual technical message, likely cause, page, and stack trace.
        </p>
        <div className="mt-4 rounded-xl border border-line bg-muted/40 p-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What happened</p>
          <p className="mt-1 break-words text-sm font-semibold text-foreground">{details.title}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{details.likelyCause}</p>
        </div>
        <details open className="mt-3 text-left">
          <summary className="cursor-pointer text-xs font-semibold text-foreground">Technical details (error report)</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">{diagnostic}</pre>
          <button type="button" onClick={() => void copyDiagnostic()} className="mt-2 rounded-lg border border-input px-3 py-2 text-xs font-semibold text-foreground">
            {copied ? "Copied error report" : "Copy error report"}
          </button>
        </details>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >Try again</button>
          <a href="/" className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Elite Connectere" },
      { property: "og:site_name", content: "Elite Connectere" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#1f2a6b" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500&family=Manrope:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&family=Lora:wght@400;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function GlobalRuntimeErrorMonitor() {
  const [failure, setFailure] = useState<{ title: string; detail: string; location: string } | null>(null);
  useEffect(() => {
    const capture = (error: unknown, source: string) => {
      const detail = error instanceof Error
        ? `${error.name}: ${error.message}\\n${error.stack ?? ""}`
        : typeof error === "string" ? error : (() => { try { return JSON.stringify(error, null, 2); } catch { return String(error); } })();
      const location = window.location.href;
      setFailure({ title: source, detail: detail.slice(0, 12000), location });
      reportLovableError(error, { boundary: "global_runtime_monitor", source, route: window.location.pathname });
    };
    const onError = (event: ErrorEvent) => capture(event.error ?? event.message, "Uncaught JavaScript error");
    const onRejection = (event: PromiseRejectionEvent) => capture(event.reason, "Unhandled asynchronous error");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  if (!failure) return null;
  const report = ["Elite Connectere runtime error", `Type: ${failure.title}`, `Page: ${failure.location}`, failure.detail].join("\\n");
  return (
    <div role="alert" className="fixed bottom-4 left-1/2 z-[999] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-destructive/40 bg-card p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-bold text-foreground">An app error was caught</p><p className="mt-1 text-xs text-muted-foreground">{failure.title} · {failure.location}</p></div>
        <button type="button" onClick={() => setFailure(null)} className="rounded-md border border-input px-2 py-1 text-xs font-semibold">Dismiss</button>
      </div>
      <details open className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-foreground">View exact error details</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">{failure.detail}</pre></details>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(report); }} className="mt-2 rounded-lg border border-input px-3 py-2 text-xs font-semibold">Copy error report</button>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    void import("../lib/pwa").then((m) => m.registerAppWorker());
    const sync = () => setOffline(!navigator.onLine);
    const back = () => {
      sync();
      void queryClient.invalidateQueries();
    };
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", back);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", back);
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalRuntimeErrorMonitor />
      {offline && (
        <div className="sticky top-0 z-50 bg-ink px-3 py-1.5 text-center text-[11.5px] font-semibold text-background">
          You're offline — showing your last saved dashboard. Sending and validation are paused.
        </div>
      )}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
