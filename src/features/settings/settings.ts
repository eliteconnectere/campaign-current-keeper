/** Application configuration — separate from the campaign workspace snapshot. */

export const SETTINGS_KEY = "ec.settings.v1";

export const NOTIFICATION_KINDS = [
  ["gmailExhausted", "Gmail profile exhausted"],
  ["gmailUnavailable", "No usable Gmail profile"],
  ["gmailDisconnected", "Gmail profile disconnected"],
  ["gmailAuth", "Gmail authorization needs attention"],
  ["campaignStarted", "Campaign started"],
  ["campaignCompleted", "Campaign completed"],
  ["campaignPaused", "Campaign paused or stopped"],
  ["campaignIssue", "Campaign sending issue"],
  ["validation", "Validation completed"],
  ["rotation", "Active sending profile rotated"],
  ["subscription", "Trial & subscription status"],
  ["chatMessage", "New private message"],
  ["chatRequest", "New connection request"],
  ["chatAccepted", "Connection request accepted"],
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number][0];

export type HSL = { h: number; s: number; l: number };
export const FONT_CHOICES = {
  outfit: '"Outfit", ui-sans-serif, system-ui, sans-serif',
  manrope: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  grotesk: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  lora: '"Lora", Georgia, serif',
  mono: '"Roboto Mono", ui-monospace, monospace',
} as const;
export type FontChoice = keyof typeof FONT_CHOICES;

export type AppSettings = {
  notifications: Record<NotificationKind, boolean>;
  smartFill: boolean;
  smartFillMemory: boolean;
  sendingMode: "both" | "elite" | "standard";
  activityRecording: boolean;
  tracker: boolean;
  planner: boolean;
  uiDensity: number;
  textDensity: number;
  accent: HSL | null;
  inkColor: HSL | null;
  surfaceColor: HSL | null;
  lineColor: HSL | null;
  radius: number;
  shapeMode: "rectangle" | "mixed" | "glass-pill";
  shadow: number;
  font: FontChoice;
  weight: number;
  profileImage: string | null;
  /** Notification sounds on/off. */
  sounds: boolean;
  /** The one-shot tone used for notification alerts. */
  notificationSound: "note" | "bell" | "popcorn";
  /** Sound played after each confirmed email send. */
  sendingSound: boolean;
  /** Selected sending swish profile. */
  sendingSoundVariant: "air-swish" | "air-swish-long" | "air-swish-soft" | "soft-sweep" | "pass-by";
  /** Ringtone used when a scheduled alarm fires. */
  alarmRingtone: "note" | "bell" | "popcorn";
  /** Haptic feedback where the browser/device supports it. */
  vibration: boolean;
  /** Chat-only: message/request sounds. */
  chatSounds: boolean;
  /** Chat-only: Enter sends on keyboards (Shift+Enter for new line). */
  chatEnterToSend: boolean;
  /** Chat-only: links in messages are tappable. */
  chatLinkPreview: boolean;
  /** Decorative edge lighting for night workspace ambience. */
  nightModeLight: boolean;
  nightModeColor: "rainbow" | "aurora" | "ocean" | "sunset";
  nightModeAnimation: "electric" | "aurora" | "plasma" | "comet" | "circuit";
  /** Optional accent selected from the Night Mode color wheel. */
  nightModeCustomColor: string;
  nightModeSpeed: "slow" | "medium" | "fast";
  nightModeIntensity: number;
  /** Show live campaign countdown chip next to Promo while sending. */
  showCampaignTimer: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: Object.fromEntries(NOTIFICATION_KINDS.map(([k]) => [k, true])) as Record<
    NotificationKind,
    boolean
  >,
  smartFill: true,
  smartFillMemory: true,
  sendingMode: "both",
  activityRecording: true,
  tracker: true,
  planner: true,
  uiDensity: 1,
  textDensity: 1,
  accent: null,
  inkColor: null,
  surfaceColor: null,
  lineColor: null,
  radius: 1,
  shapeMode: "mixed",
  shadow: 0,
  font: "outfit",
  weight: 0,
  profileImage: null,
  sounds: true,
  notificationSound: "note",
  sendingSound: true,
  sendingSoundVariant: "air-swish-long",
  alarmRingtone: "note",
  vibration: true,
  chatSounds: true,
  chatEnterToSend: true,
  chatLinkPreview: true,
  nightModeLight: false,
  nightModeColor: "rainbow",
  nightModeAnimation: "electric",
  nightModeCustomColor: "#ff4d6d",
  nightModeSpeed: "medium",
  nightModeIntensity: 2,
  showCampaignTimer: true,
};

/** Preferences are stored per Master Login account so they never leak between users. */
const keyFor = (uid: string) => `${SETTINGS_KEY}:${uid}`;

export function loadSettings(uid: string | null): AppSettings {
  if (typeof window === "undefined" || !uid) return DEFAULT_SETTINGS;
  try {
    let raw = window.localStorage.getItem(keyFor(uid));
    if (!raw) {
      // One-time migration of the old device-wide value to the first account that signs in.
      raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        window.localStorage.setItem(keyFor(uid), raw);
        window.localStorage.removeItem(SETTINGS_KEY);
      }
    }
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings, uid: string | null) {
  if (typeof window === "undefined" || !uid) return;
  try {
    window.localStorage.setItem(keyFor(uid), JSON.stringify(settings));
  } catch {
    /* storage unavailable — the session still works in memory */
  }
}

export const hsl = (c: HSL) => `hsl(${c.h} ${c.s}% ${c.l}%)`;

const RADII = ["sm", "md", "lg", "xl", "2xl", "3xl"] as const;
const RADII_REM = [0.25, 0.375, 0.5, 0.75, 1, 1.5];

/**
 * Interface Customization is Plan 3 / company-only. `allowed` comes from the
 * server entitlement; without it every customization is removed so the
 * default Elite Connectere look is always restored.
 */
export function applyAppearance(settings: AppSettings, allowed: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (k: string, v: string | null) =>
    v == null ? root.style.removeProperty(k) : root.style.setProperty(k, v);
  const on = allowed;
  set("--ui-scale", String(on ? settings.uiDensity : 1));
  set("--text-scale", String(on ? settings.textDensity : 1));
  const a = on ? settings.accent : null;
  set("--brand", a ? hsl(a) : null);
  set("--brand-soft", a ? `hsl(${a.h} ${Math.min(a.s, 60)}% 96%)` : null);
  const ink = on ? settings.inkColor : null;
  set("--ink", ink ? hsl(ink) : null);
  set("--ink-soft", ink ? `hsl(${ink.h} ${Math.round(ink.s * 0.45)}% ${Math.min(ink.l + 22, 70)}%)` : null);
  const surf = on ? settings.surfaceColor : null;
  set("--soft", surf ? hsl(surf) : null);
  const line = on ? settings.lineColor : null;
  set("--line", line ? hsl(line) : null);
  RADII.forEach((r, i) =>
    set(`--radius-${r}`, on && settings.radius !== 1 ? `${RADII_REM[i]! * settings.radius}rem` : null),
  );
  set(
    "--shadow-sm",
    on && settings.shadow > 0
      ? `0 ${settings.shadow}px ${settings.shadow * 3}px rgb(0 0 0 / ${0.04 + settings.shadow * 0.012})`
      : null,
  );
  root.classList.toggle("ec-shadowed", on && settings.shadow > 0);
  document.body.style.fontFamily = on && settings.font !== "outfit" ? FONT_CHOICES[settings.font] : "";
  set("--ec-weight-shift", on && settings.weight ? String(settings.weight) : null);
  root.classList.toggle("ec-bold", on && settings.weight > 0);
}
