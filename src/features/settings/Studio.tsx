import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Lock, RotateCcw } from "lucide-react";
import {
  DEFAULT_SETTINGS,
  FONT_CHOICES,
  hsl,
  type AppSettings,
  type FontChoice,
  type HSL,
} from "./settings";

function toHex({ h, s, l }: HSL) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function fromHex(hex: string): HSL | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function ColorWheel({ value, onChange, disabled }: { value: HSL; onChange: (c: HSL) => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState(toHex(value));
  useEffect(() => setHex(toHex(value)), [value]);

  function pick(e: React.PointerEvent) {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    const h = (Math.atan2(y, x) * 180) / Math.PI + 90;
    const s = Math.min(Math.hypot(x, y) / (r.width / 2), 1) * 100;
    onChange({ ...value, h: Math.round((h + 360) % 360), s: Math.round(s) });
  }
  const ang = ((value.h - 90) * Math.PI) / 180;
  const rad = value.s / 100;

  const slider = (label: string, key: "h" | "s" | "l", max: number, bg: string) => (
    <label className="block">
      <span className="flex justify-between text-[11px] font-semibold text-ink">
        {label} <span className="font-mono text-ink-soft">{value[key]}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value[key]}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
        className="mt-1 h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: bg }}
      />
    </label>
  );

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div
        ref={ref}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => e.buttons && pick(e)}
        className={`relative size-44 shrink-0 touch-none rounded-full border border-line ${disabled ? "opacity-40" : "cursor-crosshair"}`}
        style={{
          background: `radial-gradient(circle, hsl(0 0% ${value.l}%) 0%, transparent 70%), conic-gradient(from 0deg, ${Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} 100% ${value.l}%)`).join(",")})`,
        }}
        aria-label="Colour wheel"
      >
        <span
          className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background shadow"
          style={{
            left: `${50 + Math.cos(ang) * rad * 50}%`,
            top: `${50 + Math.sin(ang) * rad * 50}%`,
            background: hsl(value),
          }}
        />
      </div>
      <div className="w-full min-w-0 space-y-2.5">
        {slider("Hue", "h", 360, "linear-gradient(90deg,hsl(0 90% 50%),hsl(60 90% 50%),hsl(120 90% 50%),hsl(180 90% 50%),hsl(240 90% 50%),hsl(300 90% 50%),hsl(360 90% 50%))")}
        {slider("Vivid ↔ muted", "s", 100, `linear-gradient(90deg,hsl(${value.h} 0% ${value.l}%),hsl(${value.h} 100% ${value.l}%))`)}
        {slider("Darker ↔ lighter", "l", 100, `linear-gradient(90deg,#000,hsl(${value.h} ${value.s}% 50%),#fff)`)}
        <div className="flex items-center gap-2">
          <span className="size-8 shrink-0 rounded-lg border border-line" style={{ background: hsl(value) }} />
          <input
            value={hex}
            disabled={disabled}
            onChange={(e) => {
              setHex(e.target.value);
              const c = fromHex(e.target.value);
              if (c) onChange(c);
            }}
            className="w-full rounded-xl border border-line px-3 py-1.5 font-mono text-[12px] uppercase outline-none"
            aria-label="Hex colour"
          />
        </div>
      </div>
    </div>
  );
}

type ColorKey = "accent" | "inkColor" | "surfaceColor" | "lineColor";
const COLOR_TARGETS: { key: ColorKey; label: string; fallback: HSL }[] = [
  { key: "accent", label: "Accent & buttons", fallback: { h: 4, s: 74, l: 49 } },
  { key: "inkColor", label: "Text & headings", fallback: { h: 232, s: 55, l: 27 } },
  { key: "surfaceColor", label: "Panels & backgrounds", fallback: { h: 230, s: 30, l: 96 } },
  { key: "lineColor", label: "Borders & dividers", fallback: { h: 230, s: 25, l: 90 } },
];
const PRESETS: { name: string; patch: Partial<AppSettings> }[] = [
  { name: "Elite default", patch: { accent: null, inkColor: null, surfaceColor: null, lineColor: null, radius: 1, shadow: 0, font: "outfit", weight: 0 } },
  { name: "Ocean", patch: { accent: { h: 205, s: 80, l: 45 }, inkColor: { h: 215, s: 60, l: 22 }, surfaceColor: { h: 205, s: 60, l: 96 }, lineColor: { h: 205, s: 40, l: 88 } } },
  { name: "Forest", patch: { accent: { h: 155, s: 60, l: 36 }, inkColor: { h: 160, s: 45, l: 18 }, surfaceColor: { h: 140, s: 30, l: 95 }, lineColor: { h: 140, s: 20, l: 86 } } },
  { name: "Royal", patch: { accent: { h: 268, s: 60, l: 50 }, inkColor: { h: 262, s: 50, l: 24 }, surfaceColor: { h: 265, s: 40, l: 96 }, lineColor: { h: 265, s: 25, l: 89 } } },
  { name: "Sunset", patch: { accent: { h: 22, s: 90, l: 52 }, inkColor: { h: 12, s: 45, l: 22 }, surfaceColor: { h: 30, s: 70, l: 96 }, lineColor: { h: 30, s: 40, l: 88 } } },
  { name: "Soft & round", patch: { radius: 1.6, shadow: 3, font: "manrope" } },
  { name: "Sharp & bold", patch: { radius: 0.3, shadow: 0, font: "grotesk", weight: 1 } },
];

export function Studio({
  settings,
  allowed,
  onChange,
  onClose,
  onUpgrade,
}: {
  settings: AppSettings;
  allowed: boolean;
  onChange: (p: Partial<AppSettings>) => void;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const [target, setTarget] = useState<ColorKey>("accent");
  const t = COLOR_TARGETS.find((c) => c.key === target)!;
  const current = settings[target] ?? t.fallback;
  const set = (p: Partial<AppSettings>) => allowed && onChange(p);

  const range = (label: string, key: "uiDensity" | "textDensity" | "radius" | "shadow", min: number, max: number, step: number) => (
    <label className="block">
      <span className="flex justify-between text-[11.5px] font-semibold text-ink">
        {label} <span className="font-mono text-ink-soft">{settings[key]}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        disabled={!allowed}
        onChange={(e) => set({ [key]: Number(e.target.value) })}
        className="mt-1.5 w-full accent-brand disabled:opacity-40"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background animate-fade-in">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={onClose} className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink">
          <ChevronLeft className="size-4 text-brand" /> Back to workspace
        </button>
        <span className="label-caps ml-auto">Customization Studio</span>
      </header>

      <div className="mx-auto max-w-xl space-y-4 p-4 pb-16">
        {!allowed && (
          <div className="flex items-start gap-2 rounded-2xl border border-brand/25 bg-brand-soft p-3 text-[12px] leading-snug text-brand">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              Interface Customization is included with Elite Studio ProMaxx. You can look around, but changes are locked.
              <button onClick={onUpgrade} className="mt-2 block rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-background">
                See Elite Studio ProMaxx
              </button>
            </div>
          </div>
        )}

        <section id="settings-presets" className="card-shell scroll-mt-24 rounded-2xl border border-line">
          <p className="label-caps">Quick presets</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                disabled={!allowed}
                onClick={() => set(p.patch)}
                className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-40"
              >
                <span className="size-3 rounded-full" style={{ background: p.patch.accent ? hsl(p.patch.accent) : "var(--brand)" }} />
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <section id="settings-colours" className="card-shell scroll-mt-24 rounded-2xl border border-line">
          <p className="label-caps">Colours</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {COLOR_TARGETS.map((c) => (
              <button
                key={c.key}
                onClick={() => setTarget(c.key)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11.5px] font-semibold text-ink ${target === c.key ? "border-brand bg-brand-soft" : "border-line"}`}
              >
                <span className="size-4 shrink-0 rounded-full border border-line" style={{ background: hsl(settings[c.key] ?? c.fallback) }} />
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <ColorWheel value={current} disabled={!allowed} onChange={(c) => set({ [target]: c })} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {[{ h: 4, s: 74, l: 49 }, { h: 220, s: 70, l: 45 }, { h: 160, s: 60, l: 36 }, { h: 268, s: 60, l: 50 }, { h: 38, s: 92, l: 50 }, { h: 330, s: 70, l: 50 }].map((c, i) => (
              <button
                key={i}
                disabled={!allowed}
                onClick={() => set({ [target]: c })}
                className="size-7 rounded-full border-2 border-line disabled:opacity-40"
                style={{ background: hsl(c) }}
                aria-label={`Preset colour ${i + 1}`}
              />
            ))}
            <p className="mt-1 text-[11px] text-ink-soft">Interface shape mode is optional and can be changed any time.</p>
            <button
              disabled={!allowed}
              onClick={() => set({ [target]: null })}
              className="ml-auto flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink disabled:opacity-40"
            >
              <RotateCcw className="size-3" /> Default
            </button>
          </div>
        </section>

        <section id="settings-typography" className="card-shell scroll-mt-24 space-y-3 rounded-2xl border border-line">
          <p className="label-caps">Typography</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FONT_CHOICES) as FontChoice[]).map((f) => (
              <button
                key={f}
                disabled={!allowed}
                onClick={() => set({ font: f })}
                style={{ fontFamily: FONT_CHOICES[f] }}
                className={`rounded-xl border px-3 py-1.5 text-[13px] text-ink disabled:opacity-40 ${settings.font === f ? "border-brand bg-brand-soft" : "border-line"}`}
              >
                {f === "grotesk" ? "Grotesk" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {range("Text size", "textDensity", 0.85, 1.2, 0.05)}
          <label className="flex items-center justify-between text-[11.5px] font-semibold text-ink">
            Bolder text
            <input type="checkbox" disabled={!allowed} checked={settings.weight > 0} onChange={(e) => set({ weight: e.target.checked ? 1 : 0 })} className="accent-brand" />
          </label>
        </section>

        <section id="settings-layout" className="card-shell scroll-mt-24 space-y-3 rounded-2xl border border-line">
          <p className="label-caps">Cards, buttons & spacing</p>
          {range("Corner roundness", "radius", 0, 2, 0.1)}
          {range("Shadow depth", "shadow", 0, 8, 1)}
          {range("Spacing / density", "uiDensity", 0.8, 1.2, 0.05)}
          <div className="rounded-xl border border-line bg-soft p-3">
            <p className="text-[12.5px] font-semibold text-ink">Live preview</p>
            <p className="text-[11.5px] text-ink-soft">Cards, buttons and text follow your choices.</p>
            <button className="mt-2 rounded-full bg-brand px-4 py-1.5 text-[12px] font-semibold text-background">Start campaign</button>
          </div>
        </section>

        <button
          disabled={!allowed}
          onClick={() =>
            set({
              accent: null, inkColor: null, surfaceColor: null, lineColor: null,
              radius: DEFAULT_SETTINGS.radius, shapeMode: DEFAULT_SETTINGS.shapeMode, shadow: 0, font: "outfit", weight: 0,
              uiDensity: 1, textDensity: 1,
            })
          }
          className="w-full rounded-full border border-line py-2.5 text-[12.5px] font-semibold text-ink disabled:opacity-40"
        >
          Reset everything to the Elite default
        </button>
        <section className="card-shell space-y-3 rounded-2xl border border-line">
          <p className="label-caps">Interface shape mode</p>
          <p className="text-[11px] text-ink-soft">Choose the overall control style. This optional setting is lowest so reset remains easy to find.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([['rectangle', 'Rectangle', 'Straight controls, no pills'], ['mixed', 'Mixed', 'Previous rounded rectangle mix'], ['glass-pill', 'Glass pill', 'Optional water-glass UI']] as const).map(([value, label, description]) => (
              <button key={value} type="button" onClick={() => set({ shapeMode: value })} className={`min-h-16 rounded-xl border p-3 text-left ${settings.shapeMode === value ? 'border-brand bg-brand/10' : 'border-line'}`}><span className="block text-[12px] font-semibold text-ink">{label}</span><span className="mt-1 block text-[10px] leading-snug text-ink-soft">{description}</span></button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Profile target display. ProMaxx: long-press to edit (1–420). */
export function TargetValue({
  used,
  limit,
  editable,
  onSave,
  onLocked,
}: {
  used: number;
  limit: number;
  editable: boolean;
  onSave: (n: number) => Promise<void>;
  onLocked?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(limit));
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  if (editing) {
    const commit = async () => {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 1 || n > 420) {
        setErr("1–420");
        return;
      }
      await onSave(n);
      setEditing(false);
    };
    return (
      <span className="flex shrink-0 items-center gap-1">
        <span className="font-mono text-[11.5px] text-ink">{used}/</span>
        <input
          autoFocus
          inputMode="numeric"
          value={val}
          onChange={(e) => {
            setErr(null);
            setVal(e.target.value.replace(/\D/g, "").slice(0, 3));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={() => void commit()}
          className={`w-12 rounded-md border px-1 py-0.5 text-center font-mono text-[11.5px] outline-none ${err ? "border-brand" : "border-line"}`}
          aria-label="Daily target (max 420)"
        />
        {err && <span className="text-[10px] font-semibold text-brand">{err}</span>}
      </span>
    );
  }

  return (
    <span
      data-tour="target"
      onPointerDown={() => {
        timer.current = window.setTimeout(() => {
          if (!editable) {
            onLocked?.();
            return;
          }
          setVal(String(limit));
          setEditing(true);
        }, 550);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => editable && e.preventDefault()}
      title={editable ? "Long-press to edit the target (max 420)" : undefined}
      className="shrink-0 select-none font-mono text-[11.5px] font-semibold text-ink"
    >
      {used}/{limit}
    </span>
  );
}
