/** Foreground notification, alarm, and sending feedback sounds. */
export type SendSoundVariant = "air-swish" | "air-swish-long" | "air-swish-soft" | "soft-sweep" | "pass-by";

export type SoundKind =
  | "note"
  | "bell"
  | "popcorn"
  | "send"
  | "message"
  | "request"
  | "accepted"
  | "campaign"
  | "campaignLong"
  | "campaignAir"
  | "warning"
  | "unlock"
  | "alarm";

const TONES: Record<SoundKind, Array<[number, number, number]>> = {
  // [frequency Hz, start s, duration s]
  note: [[880, 0, 0.12], [1318.5, 0.1, 0.22]],
  bell: [[659.3, 0, 0.12], [987.8, 0.08, 0.3], [1318.5, 0.18, 0.42]],
  popcorn: [[1046.5, 0, 0.07], [1568, 0.09, 0.08], [1318.5, 0.2, 0.09]],
  // `send` is one filtered-noise pass-by swoosh. Its quick rise and fall
  // gives the sound a Doppler-like flyby character without layering tones.
  send: [],
  message: [[880, 0, 0.12], [1318.5, 0.1, 0.22]],
  request: [[659.3, 0, 0.1], [987.8, 0.1, 0.1], [1318.5, 0.2, 0.16]],
  accepted: [[783.99, 0, 0.1], [1046.5, 0.09, 0.1], [1567.98, 0.18, 0.22]],
  campaign: [[1046.5, 0, 0.12], [784, 0.12, 0.16]],
  campaignLong: [[1046.5, 0, 0.16], [932.3, 0.14, 0.14], [784, 0.27, 0.28]],
  campaignAir: [[1174.7, 0, 0.14], [1396.9, 0.1, 0.18], [1046.5, 0.24, 0.22], [784, 0.4, 0.34]],
  warning: [[587.3, 0, 0.14], [587.3, 0.2, 0.14]],
  unlock: [[523.25, 0, 0.12], [659.25, 0.1, 0.12], [783.99, 0.2, 0.12], [1046.5, 0.3, 0.3]],
  // A longer foreground reminder; it stops automatically after three pulses.
  alarm: [[880, 0, 0.32], [660, 0.42, 0.32], [880, 0.84, 0.32], [660, 1.26, 0.32], [880, 1.68, 0.32], [660, 2.1, 0.32]],
};

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Call synchronously from a real user gesture before any async work begins. */
export function unlockAudioFromGesture(): void {
  const audio = getAudioContext();
  if (audio && audio.state !== "running") void audio.resume().catch(() => {});
}

function withReadyAudio(action: (audio: AudioContext) => void) {
  const audio = getAudioContext();
  if (!audio) return;
  if (audio.state === "running") {
    action(audio);
    return;
  }
  void audio.resume().then(() => {
    if (ctx === audio && audio.state === "running") action(audio);
  }).catch(() => {});
}

export function vibrate(pattern: number | number[] = [45, 35, 45], enabled = true) {
  if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* vibration unavailable — stay silent */
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (window.Notification.permission === "default") await window.Notification.requestPermission();
  return window.Notification.permission;
}

export async function showSystemNotification(title: string, body: string, enabled = true): Promise<boolean> {
  if (!enabled || typeof window === "undefined" || !("Notification" in window)) return false;
  if (window.Notification.permission !== "granted") return false;
  const options: NotificationOptions = { body, icon: "/icon-192.png", badge: "/icon-192.png" };
  try {
    // Installed iOS web apps require notifications to be shown through a service worker.
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && "showNotification" in registration) {
        await registration.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // Fall through to the standard Notification constructor where supported.
  }
  try {
    new window.Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export function playAlarmRingtone(kind: "note" | "bell" | "popcorn", enabled = true) {
  if (!enabled) return;
  withReadyAudio((audio) => {
    // Repeat the selected tune so the completion alert remains noticeable.
    const tones = TONES[kind];
    for (let repeat = 0; repeat < 8; repeat += 1) {
      const offset = repeat * 1.1;
      for (const [freq, start, dur] of tones) playTone(audio, freq, offset + start, dur);
    }
  });
}

function playTone(audio: AudioContext, freq: number, start: number, dur: number) {
  const soundStart = audio.currentTime + 0.01 + start;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, soundStart);
  gain.gain.linearRampToValueAtTime(0.12, soundStart + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, soundStart + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(soundStart);
  osc.stop(soundStart + dur + 0.02);
}

function playSendSoundWithContext(audio: AudioContext, start: number, variant: SendSoundVariant) {
  const profiles: Record<SendSoundVariant, { duration: number; startHz: number; peakHz: number; endHz: number; volume: number; curve: "noise" | "tone" }> = {
    "soft-sweep": { duration: 0.52, startHz: 380, peakHz: 2600, endHz: 1500, volume: 0.24, curve: "noise" },
    "pass-by": { duration: 0.42, startHz: 180, peakHz: 3200, endHz: 240, volume: 0.28, curve: "noise" },
    "air-swish": { duration: 0.86, startHz: 220, peakHz: 2100, endHz: 620, volume: 0.18, curve: "noise" },
    "air-swish-long": { duration: 1.08, startHz: 180, peakHz: 1900, endHz: 520, volume: 0.17, curve: "noise" },
    "air-swish-soft": { duration: 0.98, startHz: 260, peakHz: 1650, endHz: 700, volume: 0.14, curve: "noise" },
  };
  const profile = profiles[variant];
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * profile.duration), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const progress = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * progress) ** 0.7;
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.Q.value = variant === "pass-by" ? 0.9 : 0.55;
  filter.frequency.setValueAtTime(profile.startHz, start);
  filter.frequency.exponentialRampToValueAtTime(profile.peakHz, start + profile.duration * 0.55);
  filter.frequency.exponentialRampToValueAtTime(profile.endHz, start + profile.duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(profile.volume, start + profile.duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.duration);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(start);
  source.stop(start + profile.duration);

  if (profile.curve === "tone") {
    const oscillator = audio.createOscillator();
    const toneGain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(profile.startHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(profile.peakHz, start + profile.duration * 0.55);
    oscillator.frequency.exponentialRampToValueAtTime(profile.endHz, start + profile.duration);
    toneGain.gain.setValueAtTime(0.0001, start);
    toneGain.gain.exponentialRampToValueAtTime(0.08, start + profile.duration * 0.25);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, start + profile.duration);
    oscillator.connect(toneGain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + profile.duration + 0.02);
  }
}

export function playSendSound(variant: SendSoundVariant, enabled = true) {
  if (!enabled) return;
  withReadyAudio((audio) => playSendSoundWithContext(audio, audio.currentTime + 0.01, variant));
}

export function playSound(kind: SoundKind, enabled = true) {
  if (!enabled) return;
  withReadyAudio((audio) => {
    const t0 = audio.currentTime + 0.01;
    if (kind === "send") {
      playSendSoundWithContext(audio, t0, "soft-sweep");
      return;
    }
    for (const [freq, start, dur] of TONES[kind]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const soundStart = t0 + start;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, soundStart);
      gain.gain.linearRampToValueAtTime(0.12, soundStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, soundStart + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(soundStart);
      osc.stop(soundStart + dur + 0.02);
    }
  });
}
