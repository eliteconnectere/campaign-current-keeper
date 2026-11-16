#!/usr/bin/env python3
"""Keep live Rex chat on navigate-return; distinguish erase-data vs reset-workspace."""
from pathlib import Path


def patch_registry() -> None:
    path = Path("src/features/assist/navigation.registry.ts")
    t = path.read_text()
    if 'place: "reset-workspace"' not in t:
        needle = '{ place: "erase-data",'
        if needle in t:
            # find full erase-data line and append after it
            lines = t.splitlines(keepends=True)
            out = []
            for line in lines:
                out.append(line)
                if 'place: "erase-data"' in line and 'reset-workspace' not in ''.join(out[-3:]):
                    out.append(
                        '  { place: "reset-workspace", purpose: "Navigate to Reset Workspace only: clears current campaign/recipients draft, keeps saved app data. NOT Erase Data.", parent: "workspace-menu", kind: "action" },\n'
                    )
            t = ''.join(out)
            print("reset-workspace registered")
    t = t.replace(
        'purpose: "Navigate to the Erase Data control in the workspace menu; this is destructive and must remain behind its existing confirmation dialog"',
        'purpose: "Navigate to Erase Data (NOT Reset Workspace). Erase Data wipes stored app data after confirmation; Reset Workspace only clears the current campaign draft"',
        1,
    )
    path.write_text(t)


def patch_app() -> None:
    path = Path("src/routes/app.tsx")
    t = path.read_text()

    if "dataAttr" not in t and "function MenuRow" in t:
        old_mr = '''function MenuRow({
  icon: Icon,
  label,
  sub,
  danger,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  sub?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors active:bg-soft"
    >'''
        new_mr = '''function MenuRow({
  icon: Icon,
  label,
  sub,
  danger,
  onClick,
  dataAttr,
}: {
  icon: typeof Settings;
  label: string;
  sub?: string;
  danger?: boolean;
  onClick?: () => void;
  dataAttr?: string;
}) {
  return (
    <button
      onClick={onClick}
      {...(dataAttr ? { [dataAttr]: "" } : {})}
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors active:bg-soft"
    >'''
        if old_mr in t:
            t = t.replace(old_mr, new_mr, 1)
            print("MenuRow dataAttr")

    if 'dataAttr="data-ec-menu-erase"' not in t and 'label="Erase Data"' in t:
        t = t.replace(
            'label="Erase Data"',
            'label="Erase Data"\n                        dataAttr="data-ec-menu-erase"',
            1,
        )
        print("erase dataAttr")

    if 'data-ec-reset-workspace' not in t and 'label="Reset workspace"' in t:
        t = t.replace(
            'label="Reset workspace"',
            'label="Reset workspace"\n                        dataAttr="data-ec-reset-workspace"',
            1,
        )
        print("reset dataAttr")

    # Precise scroll for erase-data
    if 'data-ec-menu-erase' in t and 'querySelector("[data-ec-menu-erase]")' not in t:
        old = 'if ((p === "logout" || p === "export-data" || p === "clear-cache" || p === "erase-data") && menu) menu.scrollTo({ top: menu.scrollHeight, behavior: "smooth" });'
        new = '''if (p === "erase-data") {
                  const el = document.querySelector("[data-ec-menu-erase]");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                  else menu?.scrollTo({ top: menu.scrollHeight, behavior: "smooth" });
                } else if (p === "reset-workspace") {
                  const el = document.querySelector("[data-ec-reset-workspace]");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if ((p === "logout" || p === "export-data" || p === "clear-cache") && menu) menu.scrollTo({ top: menu.scrollHeight, behavior: "smooth" });'''
        if old in t:
            t = t.replace(old, new, 1)
            print("precise erase scroll")
        # include reset-workspace in the branch condition
        t = t.replace(
            'p === "workspace-menu" || p === "logout" || p === "export-data" || p === "clear-cache" || p === "erase-data"',
            'p === "workspace-menu" || p === "logout" || p === "export-data" || p === "clear-cache" || p === "erase-data" || p === "reset-workspace"',
            1,
        )

    path.write_text(t)
    print("app", path.stat().st_size)


def patch_elite_assist() -> None:
    path = Path("src/features/assist/EliteAssist.tsx")
    t = path.read_text()
    if "rex-live-session:" in t:
        print("live session already present")
        return

    # Restore draft when memory off — before the conversations restore branch
    old_blank = "if (active && !keepBlankChat && conversations[0]) {"
    if old_blank in t:
        restore = '''
        if (active && keepBlankChat) {
          try {
            const draft = window.sessionStorage.getItem(`rex-live-session:${uid}`);
            if (draft) {
              const parsed = JSON.parse(draft);
              if (Array.isArray(parsed) && parsed.length) {
                setMsgs(parsed.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"));
              }
            }
          } catch {}
        }
        if (active && !keepBlankChat && conversations[0]) {'''
        t = t.replace(old_blank, restore, 1)
        print("draft restore when memory off")

    # Persist effect AFTER historyReady is declared
    marker = "  const [historyReady, setHistoryReady] = useState(false);"
    if marker in t and "rex-live-session:" not in t:
        inject = marker + '''
  const liveSessionKey = `rex-live-session:${uid}`;
  // Keep the in-progress discussion across navigate → return even when saveHistory is off.
  useEffect(() => {
    if (!historyReady) return;
    if (!msgs.length) return;
    try {
      window.sessionStorage.setItem(liveSessionKey, JSON.stringify(msgs.slice(-40)));
    } catch { /* quota */ }
  }, [msgs, historyReady, liveSessionKey]);
'''
        t = t.replace(marker, inject, 1)
        print("live session persist effect")

    if 'window.localStorage.setItem(newChatStorageKey, "1")' in t:
        t = t.replace(
            'window.localStorage.setItem(newChatStorageKey, "1")',
            'window.localStorage.setItem(newChatStorageKey, "1"); try { window.sessionStorage.removeItem(`rex-live-session:${uid}`); } catch {}',
            1,
        )
        print("new chat clears live session")

    path.write_text(t)
    print("EliteAssist", path.stat().st_size)


def patch_allowlist() -> None:
    path = Path("src/lib/assist.functions.ts")
    t = path.read_text()
    if '"reset-workspace"' not in t:
        if '"erase-data"' in t:
            t = t.replace('"erase-data"', '"erase-data", "reset-workspace"', 1)
        else:
            t = t.replace('"appeals"', '"appeals", "reset-workspace", "erase-data"', 1)
        path.write_text(t)
        print("allowedGo updated")


if __name__ == "__main__":
    patch_registry()
    patch_app()
    patch_elite_assist()
    patch_allowlist()
    print("ok")
