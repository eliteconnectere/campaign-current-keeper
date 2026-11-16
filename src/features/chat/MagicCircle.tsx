import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { startEliteCelebration } from "@/lib/elite-celebration";
import { Crown } from "lucide-react";

export type Shortcut = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  onSelect: () => void;
};

const POS_KEY = "ec.magic.pos.v2";
const HINT_KEY = "ec.magic.manual-wheel-hint.v1";
const SIZE = 56;
const CHILD = 46;
const EDGE = 12;
const MAX_ITEMS = 8;
const TAU = Math.PI * 2;
const LONG_PRESS_MS = 2400;
const SPIN_ACCEL_MS = 15000;
const SPIN_DECEL_MS = 8000;
const MAX_SPIN_MS = 120000;
const MAX_SPIN_SPEED = 0.045; // radians per millisecond at full speed

type Point = { x: number; y: number };
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
function pointerAngle(x: number, y: number, center: Point) {
  return Math.atan2(y - center.y, x - center.x);
}
function angleDelta(next: number, previous: number) {
  let delta = next - previous;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

/** Tap the crown to open the shortcuts. Drag the open wheel by hand to rotate it. */
export function MagicCircle({ shortcuts, badge, userKey, celebrationSignal = "" }: { shortcuts: Shortcut[]; badge?: number; userKey?: string | null; celebrationSignal?: string }) {
  const items = useMemo(() => {
    const seen = new Set<string>();
    return shortcuts.filter((item) => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, MAX_ITEMS);
  }, [shortcuts]);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Point | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [rotation, setRotation] = useState(-Math.PI / 2);
  const [spinning, setSpinning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const spinFrame = useRef<number | null>(null);
  const spinStartedAt = useRef(0);
  const lastSpinFrame = useRef(0);
  const spinVelocity = useRef(0);
  const releaseSpeed = useRef(0);
  const spinActive = useRef(false);
  const releasingAt = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const soundGainRef = useRef<GainNode | null>(null);
  const soundNodesRef = useRef<OscillatorNode[]>([]);
  const longPressedRef = useRef(false);
  const rotationRef = useRef(rotation);
  const dragRef = useRef<{ pointerId: number; lastAngle: number; moved: boolean } | null>(null);
  const suppressShortcutClick = useRef(false);
  const openRef = useRef(open);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);
  useEffect(() => { openRef.current = open; }, [open]);
  const previousCelebrationSignal = useRef(celebrationSignal);
  const confettiStopRef = useRef<(() => void) | null>(null);
  // Keep the MagicCircle celebration visually identical to the subscription-unlocked celebration.
  const runContinuousCelebration = useCallback(async (duration: number, _turbo = false) => {
    confettiStopRef.current?.();
    const stop = startEliteCelebration(Math.min(duration, 5000), true);
    confettiStopRef.current = stop;
    window.setTimeout(() => {
      if (confettiStopRef.current === stop) confettiStopRef.current = null;
      stop();
    }, Math.min(duration, 5000));
  }, []);
  useEffect(() => {
    if (previousCelebrationSignal.current !== celebrationSignal && celebrationSignal) {
      void runContinuousCelebration(5200, false);
    }
    previousCelebrationSignal.current = celebrationSignal;
  }, [celebrationSignal, runContinuousCelebration]);

  useEffect(() => {
    const clampAnchor = (p: Point): Point => ({
      x: clamp(p.x, EDGE, window.innerWidth - SIZE - EDGE),
      y: clamp(p.y, 72, window.innerHeight - SIZE - 16),
    });
    const fallback = { x: window.innerWidth - SIZE - 18, y: window.innerHeight - SIZE - 100 };
    try {
      const stored = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as Point | null;
      setPos(clampAnchor(stored && Number.isFinite(stored.x) && Number.isFinite(stored.y) ? stored : fallback));
    } catch { setPos(clampAnchor(fallback)); }

    // Show the gesture hint only during the first 24 hours this account uses the wheel.
    // It then stays dismissed across reloads and future sessions.
    const hintKey = HINT_KEY + ":" + (userKey || "local");
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      let firstSeen = Number(localStorage.getItem(hintKey) || 0);
      if (!firstSeen) {
        firstSeen = Date.now();
        localStorage.setItem(hintKey, String(firstSeen));
      }
      const remaining = 24 * 60 * 60 * 1000 - (Date.now() - firstSeen);
      setShowHint(remaining > 0);
      if (remaining > 0) hintTimer = setTimeout(() => setShowHint(false), remaining);
    } catch { setShowHint(false); }

    const measure = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      setPos((current) => current ? clampAnchor(current) : current);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      if (hintTimer) clearTimeout(hintTimer);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (spinFrame.current !== null) cancelAnimationFrame(spinFrame.current);
      soundNodesRef.current.forEach((node) => { try { node.stop(); } catch {} });
      audioRef.current?.close().catch(() => {});
    };
  }, [userKey]);

  const count = Math.max(items.length, 1);
  const preferredRadius = count <= 4 ? 82 : count <= 6 ? 96 : 106;
  const minDimension = Math.min(viewport.w || 390, viewport.h || 700);
  const radius = Math.min(preferredRadius, Math.max(54, (minDimension - 170) / 2));
  const center = pos ? (open ? {
    x: clamp(pos.x + SIZE / 2, EDGE + radius + 44, (viewport.w || 390) - EDGE - radius - 44),
    y: clamp(pos.y + SIZE / 2, 92 + radius + 44, (viewport.h || 700) - EDGE - radius - 44 - 22),
  } : { x: pos.x + SIZE / 2, y: pos.y + SIZE / 2 }) : null;

  function unlockSpinAudio() {
    try {
      if (!audioRef.current) {
        const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtor) audioRef.current = new AudioCtor();
      }
      if (audioRef.current?.state === "suspended") void audioRef.current.resume().catch(() => {});
    } catch { /* Spin remains available without audio support. */ }
  }

  function startSpinSound() {
    const audio = audioRef.current;
    if (!audio) return;
    const build = () => {
      if (audioRef.current !== audio || !spinActive.current || audio.state !== "running") return;
      try {
        const master = audio.createGain();
        master.gain.setValueAtTime(0.0001, audio.currentTime);
        master.connect(audio.destination);
        const oscillator = audio.createOscillator();
        const overtone = audio.createOscillator();
        const toneGain = audio.createGain();
        const overtoneGain = audio.createGain();
        const now = audio.currentTime;
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(190, now);
        oscillator.frequency.exponentialRampToValueAtTime(920, now + 1.4);
        oscillator.frequency.exponentialRampToValueAtTime(1180, now + 2.4);
        overtone.type = "triangle";
        overtone.frequency.setValueAtTime(380, now);
        overtone.frequency.exponentialRampToValueAtTime(1840, now + 1.4);
        overtone.frequency.exponentialRampToValueAtTime(2360, now + 2.4);
        toneGain.gain.setValueAtTime(0.0001, now);
        toneGain.gain.linearRampToValueAtTime(0.16, now + 1.1);
        overtoneGain.gain.setValueAtTime(0.0001, now);
        overtoneGain.gain.linearRampToValueAtTime(0.045, now + 1.1);
        oscillator.connect(toneGain).connect(master);
        overtone.connect(overtoneGain).connect(master);
        oscillator.start(now);
        overtone.start(now);
        soundNodesRef.current.push(oscillator, overtone);
        soundGainRef.current = master;
      } catch { /* Audio is optional; do not interrupt the wheel. */ }
    };
    if (audio.state === "running") build();
    else void audio.resume().then(build).catch(() => {});
  }

  function stopSpinSound() {
    const audio = audioRef.current;
    if (audio && soundGainRef.current) {
      try {
        soundGainRef.current.gain.cancelScheduledValues(audio.currentTime);
        soundGainRef.current.gain.setTargetAtTime(0.0001, audio.currentTime, 0.12);
      } catch {}
    }
    soundNodesRef.current.forEach((node) => { try { node.stop(audio?.currentTime ?? 0); } catch {} });
    soundNodesRef.current = [];
    soundGainRef.current = null;
    if (audio) window.setTimeout(() => {
      if (audioRef.current === audio && !spinActive.current) {
        void audio.close().catch(() => {});
        audioRef.current = null;
      }
    }, 350);
  }

  function endAutomaticSpin() {
    if (!spinActive.current || releasingAt.current !== null) return;
    releaseSpeed.current = spinVelocity.current;
    releasingAt.current = performance.now();
  }

  function beginAutomaticSpin() {
    if (spinActive.current) return;
    spinActive.current = true;
    setSpinning(true);
    void runContinuousCelebration(MAX_SPIN_MS + SPIN_DECEL_MS + 700, true);
    spinStartedAt.current = performance.now();
    lastSpinFrame.current = spinStartedAt.current;
    spinVelocity.current = 0;
    releasingAt.current = null;
    startSpinSound();
    const animate = (now: number) => {
      const dt = Math.min(now - lastSpinFrame.current, 40);
      lastSpinFrame.current = now;
      const elapsed = now - spinStartedAt.current;
      if (elapsed >= MAX_SPIN_MS && releasingAt.current === null) endAutomaticSpin();
      let speed = MAX_SPIN_SPEED * Math.min(1, elapsed / SPIN_ACCEL_MS);
      if (releasingAt.current !== null) {
        const brakeElapsed = now - releasingAt.current;
        speed = releaseSpeed.current * Math.max(0, 1 - brakeElapsed / SPIN_DECEL_MS);
        if (brakeElapsed >= SPIN_DECEL_MS) {
          spinActive.current = false;
          confettiStopRef.current?.();
          setSpinning(false);
          spinFrame.current = null;
          stopSpinSound();
          return;
        }
      }
      spinVelocity.current = speed;
      const audio = audioRef.current;
      const gain = soundGainRef.current;
      if (audio && gain) {
        try {
          gain.gain.setTargetAtTime(Math.max(0.0001, 0.075 * speed / MAX_SPIN_SPEED), audio.currentTime, 0.07);
        } catch {}
      }
      const next = rotationRef.current + speed * dt;
      rotationRef.current = next;
      setRotation(next);
      spinFrame.current = requestAnimationFrame(animate);
    };
    spinFrame.current = requestAnimationFrame(animate);
  }

  function clearLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function closeWheel() {
    clearLongPress();
    dragRef.current = null;
    if (spinFrame.current !== null) cancelAnimationFrame(spinFrame.current);
    spinFrame.current = null;
    spinActive.current = false;
    confettiStopRef.current?.();
    releasingAt.current = null;
    setSpinning(false);
    stopSpinSound();
    setOpen(false);
  }

  function onCrownDown(event: PointerEvent<HTMLButtonElement>) {
    if (spinning) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = null;
    longPressedRef.current = false;
    unlockSpinAudio();
    if (openRef.current) {
      longPressTimer.current = window.setTimeout(() => {
        longPressedRef.current = true;
        beginAutomaticSpin();
      }, LONG_PRESS_MS);
    }
    (event.currentTarget as HTMLButtonElement).dataset["startX"] = String(event.clientX);
    (event.currentTarget as HTMLButtonElement).dataset["startY"] = String(event.clientY);
  }

  function onCrownMove(event: PointerEvent<HTMLButtonElement>) {
    if (openRef.current || !pos) return;
    const button = event.currentTarget;
    const startX = Number(button.dataset["startX"]);
    const startY = Number(button.dataset["startY"]);
    if (!Number.isFinite(startX) || !Number.isFinite(startY)) return;
    const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (moved < 6) return;
    const next = {
      x: clamp(event.clientX - SIZE / 2, EDGE, window.innerWidth - SIZE - EDGE),
      y: clamp(event.clientY - SIZE / 2, 72, window.innerHeight - SIZE - 16),
    };
    setPos(next);
    try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch {}
  }

  function onWheelPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!center) return;
    const captureTarget = (event.target as HTMLElement).closest("button") ?? event.currentTarget;
    captureTarget.setPointerCapture(event.pointerId);
    suppressShortcutClick.current = false;
    dragRef.current = { pointerId: event.pointerId, lastAngle: pointerAngle(event.clientX, event.clientY, center), moved: false };
  }

  function onWheelPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !center) return;
    const nextAngle = pointerAngle(event.clientX, event.clientY, center);
    const delta = angleDelta(nextAngle, drag.lastAngle);
    if (Math.abs(delta) > 0.012) drag.moved = true;
    const nextRotation = rotationRef.current + delta;
    drag.lastAngle = nextAngle;
    rotationRef.current = nextRotation;
    setRotation(nextRotation);
  }

  function onWheelPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    suppressShortcutClick.current = dragRef.current.moved;
    dragRef.current = null;
  }

  if (!pos || !center) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">

      {open && (
        <button type="button" aria-label="Close shortcut wheel"
          className="pointer-events-auto absolute inset-0 cursor-default bg-black/10"
          onClick={closeWheel} />
      )}

      {open && (
        <div
          className="pointer-events-auto absolute z-[62] touch-none"
          style={{
            left: center.x - radius - 44,
            top: center.y - radius - 44,
            width: (radius + 44) * 2,
            height: (radius + 44) * 2,
            transform: `rotate(${rotation}rad)`,
            transformOrigin: "50% 50%",
            transition: "none",
          }}
          onPointerDown={onWheelPointerDown}
          onPointerMove={onWheelPointerMove}
          onPointerUp={onWheelPointerUp}
          onPointerCancel={onWheelPointerUp}
          aria-label="Draggable shortcut wheel"
        >
          {items.map((shortcut, index) => {
            const angle = -Math.PI / 2 + index * (TAU / count);
            const x = radius + 44 + Math.cos(angle) * radius;
            const y = radius + 44 + Math.sin(angle) * radius;
            return (
              <button key={shortcut.id} type="button" aria-label={shortcut.label}
                onClick={() => {
                  if (suppressShortcutClick.current) { suppressShortcutClick.current = false; return; }
                  closeWheel(); shortcut.onSelect();
                }}
                className="pointer-events-auto absolute flex w-[88px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-transform duration-150 active:scale-95"
                style={{ left: x, top: y }}>
                <span className="relative grid size-[46px] place-items-center rounded-full border border-line bg-card text-brand shadow-lg">
                  {shortcut.icon}
                  {!!shortcut.badge && shortcut.badge > 0 && (
                    <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-primary-foreground">
                      {shortcut.badge > 99 ? "99+" : shortcut.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-[88px] truncate rounded-full bg-ink px-2 py-0.5 text-center text-[10px] font-semibold text-background shadow">
                  {shortcut.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button type="button" aria-label={open ? "Close shortcut wheel" : "Open shortcut wheel"}
        aria-expanded={open}
        onPointerDown={onCrownDown}
        onPointerMove={onCrownMove}
        onPointerUp={(event) => {
          clearLongPress();
          if (longPressedRef.current) {
            longPressedRef.current = false;
            endAutomaticSpin();
          } else if (openRef.current) closeWheel();
          else if (Math.hypot(event.clientX - Number(event.currentTarget.dataset["startX"]), event.clientY - Number(event.currentTarget.dataset["startY"])) < 6) setOpen(true);
          delete event.currentTarget.dataset["startX"];
          delete event.currentTarget.dataset["startY"];
        }}
        onPointerCancel={(event) => {
          clearLongPress();
          if (longPressedRef.current) { longPressedRef.current = false; endAutomaticSpin(); }
          delete event.currentTarget.dataset["startX"];
          delete event.currentTarget.dataset["startY"];
        }}
        onContextMenu={(event) => event.preventDefault()}
        className="pointer-events-auto absolute z-[64] grid touch-none select-none place-items-center rounded-full bg-brand text-primary-foreground shadow-xl ring-4 ring-brand/25 transition-transform active:scale-95"
        style={{ left: center.x - SIZE / 2, top: center.y - SIZE / 2, width: SIZE, height: SIZE }}>
        <Crown className={`size-5 transition-transform duration-300 ${open ? "scale-110 rotate-[-12deg]" : ""}`} />
        {!open && !!badge && badge > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full border-2 border-background bg-ink px-1 text-[10px] font-bold text-background">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && showHint && (
        <p className="pointer-events-none absolute z-[63] rounded-full bg-card/90 px-2 py-1 text-[10px] font-medium text-ink-soft shadow"
          style={{ left: center.x - 90, top: center.y + 42 }}>
          Drag the wheel with your finger to rotate it.
        </p>
      )}
    </div>
  );
}
