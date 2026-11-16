/** Equal-width double ticks — sent / delivered / read */
export function MessageTicks({
  status,
}: {
  /** sent = 1 grey · delivered = 2 grey · read = 2 blue */
  status: "sending" | "sent" | "delivered" | "read";
}) {
  if (status === "sending") {
    return <span className="inline-block w-[18px] text-center text-[10px] text-ink-soft">·</span>;
  }
  const color = status === "read" ? "text-blue-500" : "text-ink-soft";
  const double = status === "delivered" || status === "read";
  return (
    <span
      className={`inline-flex h-[14px] w-[18px] items-center justify-center gap-px ${color}`}
      aria-label={status}
      title={status}
    >
      <Tick />
      {double && <Tick />}
    </span>
  );
}

function Tick() {
  return (
    <svg width="9" height="8" viewBox="0 0 9 8" className="shrink-0" aria-hidden>
      <path
        d="M1 4.2 L3.2 6.4 L8 1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
