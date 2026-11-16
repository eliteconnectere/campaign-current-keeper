import { useRef } from "react";

/** Press-and-hold handler used for the app's contextual/destructive actions. */
export function useLongPress(onLongPress: () => void, ms = 550) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  const start = () => {
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  };
  const cancel = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    /** true when the last interaction was consumed by the long press */
    consumed: () => fired.current,
  };
}
