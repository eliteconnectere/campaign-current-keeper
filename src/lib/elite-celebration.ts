import { playSound } from "@/lib/sounds";

/** Shared five-second confetti effect used by subscription unlocks and Rex's MagicCircle spin. */
export function startEliteCelebration(duration = 5000, playUnlockSound = true): () => void {
  let stopped = false;
  let frame = 0;
  if (playUnlockSound) {
    try { playSound("unlock"); } catch { /* sound is optional */ }
  }
  const stop = () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
  };
  void import("canvas-confetti").then(({ default: confetti }) => {
    if (stopped) return;
    const end = Date.now() + duration;
    const colors = ["#c8102e", "#0b1f4b", "#ffffff", "#f4c542"];
    const tick = () => {
      if (stopped || Date.now() >= end) return;
      confetti({ particleCount: 6, angle: 60, origin: { x: 0, y: 0 }, colors, gravity: 0.9 });
      confetti({ particleCount: 6, angle: 120, origin: { x: 1, y: 0 }, colors, gravity: 0.9 });
      frame = requestAnimationFrame(tick);
    };
    confetti({ particleCount: 180, spread: 140, origin: { y: 0.1 }, colors });
    tick();
  }).catch(error => console.error("Elite celebration could not start", error));
  return stop;
}
