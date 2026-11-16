import { RexAvatar } from "@/features/assist/RexAvatar";

/** Floating Rex control shown while Private Chat is open (assist closed). */
export function RexChatFab({
  visible,
  onOpen,
}: {
  visible: boolean;
  onOpen: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      data-ec-rex-chat-fab=""
      aria-label="Open Rex"
      onClick={onOpen}
      className="fixed bottom-24 right-4 z-[200] grid size-14 place-items-center rounded-full bg-brand text-white shadow-2xl ring-2 ring-white/40"
    >
      <RexAvatar size="small" />
    </button>
  );
}
