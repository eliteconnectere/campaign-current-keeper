import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { clearPrivateChatHistory, getChatMe, saveChatProfile } from "@/lib/chat.functions";
import type { AppSettings } from "@/features/settings/settings";

/** Chat-only preferences: identity, chat sounds, chat notifications, composer behaviour. */
export function ChatSettings({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [name, setName] = useState("");
  const [user, setUser] = useState("");
  const [saved, setSaved] = useState({ name: "", user: "" });
  const [busy, setBusy] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    void getChatMe()
      .then((r) => {
        setEligible(r.eligible);
        if (r.profile) {
          setName(r.profile.display_name);
          setUser(r.profile.username);
          setSaved({ name: r.profile.display_name, user: r.profile.username });
        }
      })
      .catch(() => setEligible(false))
      .finally(() => setLoading(false));
  }, []);

  const dirty = name.trim() !== saved.name || user.trim().replace(/^@/, "").toLowerCase() !== saved.user;

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await saveChatProfile({ data: { displayName: name, username: user } });
      const next = { name: name.trim(), user: user.trim().replace(/^@/, "").toLowerCase() };
      setSaved(next);
      setUser(next.user);
      toast.success("Chat profile saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (clearingHistory) return;
    if (!window.confirm("Clear all Private Chat messages from your account? Your connections stay, and the other participant's own copy is not deleted.")) return;
    setClearingHistory(true);
    try {
      const result = await clearPrivateChatHistory();
      toast.success(`Private Chat history cleared (${result.hidden.toLocaleString()} messages hidden).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Private Chat history could not be cleared.");
    } finally {
      setClearingHistory(false);
    }
  }

  const notif = (k: "chatMessage" | "chatRequest" | "chatAccepted", v: boolean) =>
    onChange({ notifications: { ...settings.notifications, [k]: v } });

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <button type="button" onClick={onClose} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="size-5 text-ink" />
        </button>
        <p className="text-[15px] font-semibold text-ink">Chat Settings</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md space-y-5 p-4">
          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-ink-soft" /></div>
          ) : !eligible ? (
            <p className="text-[13px] text-ink-soft">Private Chat is part of Premium & Elite Studio ProMaxx. Chat settings appear once your plan includes it.</p>
          ) : (
            <>
              <Group title="Chat profile">
                <label className="block space-y-1">
                  <span className="text-[12px] font-medium text-ink-soft">Display name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand" />
                </label>
                <label className="block space-y-1">
                  <span className="text-[12px] font-medium text-ink-soft">Chat username</span>
                  <div className="flex items-center rounded-xl border border-line px-3 focus-within:border-brand">
                    <span className="text-ink-soft">@</span>
                    <input value={user} onChange={(e) => setUser(e.target.value)} autoCapitalize="none" maxLength={25} className="w-full bg-transparent px-1 py-2.5 text-[14px] text-ink outline-none" />
                  </div>
                  <span className="block text-[11.5px] text-ink-soft">3–24 letters, numbers, dots or underscores. Members search by this.</span>
                </label>
                {err && <p className="text-[12.5px] text-destructive">{err}</p>}
                <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="w-full rounded-full bg-brand py-2.5 text-[14px] font-semibold text-primary-foreground disabled:opacity-50">
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </Group>

              <Group title="Notifications">
                <Row label="New private messages" checked={settings.notifications.chatMessage !== false} onChange={(v) => notif("chatMessage", v)} />
                <Row label="Connection requests" checked={settings.notifications.chatRequest !== false} onChange={(v) => notif("chatRequest", v)} />
                <Row label="Request accepted" checked={settings.notifications.chatAccepted !== false} onChange={(v) => notif("chatAccepted", v)} />
                <Row label="Chat sounds" sub="Message and request tones" checked={settings.chatSounds !== false} onChange={(v) => onChange({ chatSounds: v })} />
              </Group>

              <Group title="Messages">
                <Row label="Enter to send" sub="On keyboards; Shift+Enter adds a new line" checked={settings.chatEnterToSend !== false} onChange={(v) => onChange({ chatEnterToSend: v })} />
                <Row label="Tappable links" sub="Open links and domains in messages" checked={settings.chatLinkPreview !== false} onChange={(v) => onChange({ chatLinkPreview: v })} />
              </Group>

              <Group title="Clear chat data">
                <p className="text-[12px] leading-relaxed text-ink-soft">
                  Reset chat preferences on this device (sounds, enter-to-send, link preview, chat notification toggles).
                  Clear all Private Chat history hides messages from your account in the backend while keeping connections and the other participant's copy. Erase Data is the separate full account deletion process.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      chatSounds: true,
                      chatEnterToSend: true,
                      chatLinkPreview: true,
                      notifications: {
                        ...settings.notifications,
                        chatMessage: true,
                        chatRequest: true,
                        chatAccepted: true,
                      },
                    });
                    toast.success("Chat preferences reset on this device");
                  }}
                  className="w-full rounded-full border border-line py-2.5 text-[13px] font-semibold text-ink"
                >
                  Reset chat preferences
                </button>
                <button
                  type="button"
                  disabled={clearingHistory}
                  onClick={() => void clearHistory()}
                  className="w-full rounded-full border border-red-200 bg-red-50 py-2.5 text-[13px] font-semibold text-red-700 disabled:opacity-50"
                >
                  {clearingHistory ? "Clearing chat history…" : "Clear all Private Chat history"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    try {
                      window.dispatchEvent(new CustomEvent("ec-open-erase-data"));
                    } catch {}
                  }}
                  className="w-full rounded-full border border-red-200 bg-red-50 py-2.5 text-[13px] font-semibold text-red-700"
                >
                  Open Erase Data (full account wipe)
                </button>
              </Group>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line p-3.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">{title}</h3>
      {children}
    </section>
  );
}
function Row({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        {sub && <span className="block text-[11.5px] text-ink-soft">{sub}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
