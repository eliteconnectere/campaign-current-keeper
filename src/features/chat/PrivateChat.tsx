import { useEffect } from "react";

type ChatHub = {
  me: string | null;
  incoming: number;
  totalUnread: number;
  markRead: (...args: unknown[]) => Promise<void>;
  refresh: () => Promise<void>;
};

/** Private Chat is disconnected while a replacement messaging provider is selected. */
export function useChatHub(_opts: {
  enabled: boolean;
  activeConnectionId: string | null;
  sounds: boolean;
  notify: (kind: "chatMessage" | "chatRequest" | "chatAccepted", text: string) => void;
}): ChatHub {
  return { me: null, incoming: 0, totalUnread: 0, markRead: async () => {}, refresh: async () => {} };
}

export type ChatPrefs = { enterToSend: boolean; links: boolean };

export function PrivateChat({
  onClose,
  onActiveChange,
}: {
  hub: ChatHub;
  prefs: ChatPrefs;
  onClose: () => void;
  onActiveChange: (cid: string | null) => void;
  onUpgrade: () => void;
  onOpenRex: () => void;
}) {
  useEffect(() => {
    onActiveChange(null);
    return () => onActiveChange(null);
  }, [onActiveChange]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button type="button" onClick={onClose} aria-label="Close Private Chat" className="rounded-full px-2 py-1">←</button>
        <h2 className="text-base font-semibold text-ink">Private Chat</h2>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-lg font-semibold text-ink">Private Chat is temporarily offline</div>
        <p className="text-sm text-ink-soft">
          Private Chat is no longer connected to Supabase. Messaging will be available again after a new messaging provider is configured.
        </p>
        <p className="text-xs text-ink-soft">
          Your Elite Connectere campaigns, Gmail, billing and other workspace features are unchanged.
        </p>
      </main>
    </div>
  );
}
