#!/usr/bin/env python3
"""
Elite Connectere — Unified Patch Script
Applies Bloodline statement refinement, Hand Tour toggle in Settings,
execution Reset fix, MagicCircle persistence, and syntax repairs.
"""

import os
import re

print(">>> Starting Elite Connectere Unified Patch...")

# -----------------------------------------------------------------------------
# 1. Refine The Bloodline 💯 copy in src/lib/communityPromo.ts
# -----------------------------------------------------------------------------
promo_path = "src/lib/communityPromo.ts"
if os.path.exists(promo_path):
    new_promo_content = '''/**
 * The Bloodline community promo — November 2026.
 * Free users get expanded access for this calendar month; paid plans unchanged.
 */
export const COMMUNITY_PROMO = {
  year: 2026,
  month: 11, // November
  maxGmailProfiles: 20,
  unlockDelaySeconds: [3] as number[],
  customizationHours: 24,
  chatDrainMinutes: 40,
  chatRefillFactor: 0.35,
  endsLabel: "30 November 2026",
  headline: "A Warm Welcome From The Bloodline 💯",
  subheading: "November 2026 Special Creator Privilege · Built so you can work, breathe, and elevate your outreach",
  notes: [
    "Welcome to Elite Connectere. We engineered this platform so you can work with confidence, breathe easily, and scale genuine outreach without friction or anxiety.",
    "For this entire month of November, The Bloodline opens its doors: you have direct access to connect up to 20 Gmail accounts with high-performance 3-second pacing unlocked.",
    "Experience your first full day of Studio Night Mode, custom styling, and Private Assist intelligence without paying a single kobo upfront.",
    "No hidden deductions, no trapped data, and zero artificial limits. This is our honest gesture to help creators and operators build real momentum.",
    "Work freely, protect your sender reputation, and grow your connections. On 30 November 2026, standard tier options resume peacefully with your data completely intact.",
  ],
} as const;

export function isCommunityPromoMonth(now = new Date()): boolean {
  return now.getUTCFullYear() === COMMUNITY_PROMO.year && now.getUTCMonth() + 1 === COMMUNITY_PROMO.month;
}

/** End of November 2026 UTC → Dec 1 00:00 UTC */
export function communityPromoEndsAt(): string {
  return new Date(Date.UTC(COMMUNITY_PROMO.year, COMMUNITY_PROMO.month, 1)).toISOString();
}

/** Whole days left until promo ends (0 on last day). */
export function communityPromoDaysLeft(now = new Date()): number {
  const end = new Date(communityPromoEndsAt()).getTime();
  const ms = end - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
'''
    with open(promo_path, "w", encoding="utf-8") as f:
        f.write(new_promo_content)
    print("✓ Updated src/lib/communityPromo.ts with refined Bloodline statement")


# -----------------------------------------------------------------------------
# 2. Update PromoChip modal in src/features/billing/PromoChip.tsx
# -----------------------------------------------------------------------------
chip_path = "src/features/billing/PromoChip.tsx"
if os.path.exists(chip_path):
    with open(chip_path, "r", encoding="utf-8") as f:
        chip_content = f.read()

    if "COMMUNITY_PROMO.subheading" not in chip_content:
        chip_content = chip_content.replace(
            '<h3 className="text-base font-bold text-ink">{COMMUNITY_PROMO.headline}</h3>',
            '<h3 className="text-base font-bold text-ink">{COMMUNITY_PROMO.headline}</h3>\n                  <p className="mt-0.5 text-[11px] text-ink-soft">{COMMUNITY_PROMO.subheading}</p>',
        )
        with open(chip_path, "w", encoding="utf-8") as f:
            f.write(chip_content)
        print("✓ Updated src/features/billing/PromoChip.tsx with subheading support")
    else:
        print("✓ PromoChip already has subheading")


# -----------------------------------------------------------------------------
# 3. Patch HandTour.tsx: Add tourToggle export & interactive listener
# -----------------------------------------------------------------------------
tour_path = "src/features/workspace/HandTour.tsx"
if os.path.exists(tour_path):
    with open(tour_path, "r", encoding="utf-8") as f:
        tour_content = f.read()

    toggle_helper = '''
export function setTourEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) {
    resetTour();
    window.dispatchEvent(new CustomEvent("ec:tour-toggle", { detail: true }));
  } else {
    localStorage.setItem(OFF_KEY, "1");
    window.dispatchEvent(new CustomEvent("ec:tour-toggle", { detail: false }));
  }
}
'''
    if "export function setTourEnabled" not in tour_content:
        if "export function resetTour() {" in tour_content:
            tour_content = tour_content.replace(
                "export function resetTour() {",
                toggle_helper + "\nexport function resetTour() {",
            )
        # Listener inside EliteTips
        if 'window.addEventListener("ec:show-tip", on);' in tour_content and "ec:tour-toggle" not in tour_content:
            tour_content = tour_content.replace(
                'window.addEventListener("ec:show-tip", on);',
                '''window.addEventListener("ec:show-tip", on);
    const onToggle = (e: Event) => {
      const val = (e as CustomEvent<boolean>).detail;
      setOff(!val);
      if (val) setDismissed([]);
    };
    window.addEventListener("ec:tour-toggle", onToggle);''',
            )
            tour_content = tour_content.replace(
                'return () => window.removeEventListener("ec:show-tip", on);',
                '''return () => {
      window.removeEventListener("ec:show-tip", on);
      window.removeEventListener("ec:tour-toggle", onToggle);
    };''',
            )
        with open(tour_path, "w", encoding="utf-8") as f:
            f.write(tour_content)
        print("✓ Updated src/features/workspace/HandTour.tsx with toggle listener")
    else:
        print("✓ HandTour already has setTourEnabled")


# -----------------------------------------------------------------------------
# 4. Patch src/routes/app.tsx
# -----------------------------------------------------------------------------
app_path = "src/routes/app.tsx"
if os.path.exists(app_path):
    with open(app_path, "r", encoding="utf-8") as f:
        app_code = f.read()

    # A) Fix syntax error duplicate /> around Assistants MenuRow
    app_code = re.sub(
        r'(\s*<MenuRow\s+icon=\{Users\}\s+label="Assistants"[^>]*/>)\s*/>',
        r"\1",
        app_code,
    )

    # B) Import setTourEnabled & tourDismissed if available
    if "setTourEnabled" not in app_code and "HandTour" in app_code:
        app_code = app_code.replace(
            'import { EliteTips, ELITE_TIPS, resetTour } from "@/features/workspace/HandTour";',
            'import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed } from "@/features/workspace/HandTour";',
        )

    # C) Fix Reset near Execute — clear sent flags
    old_reset_button = '''                  <button
                    onClick={() => {
                      setEngine("idle");
                      setScout(false);
                      log("Campaign paused. Tap Reset before a full new run, or Execute to continue remaining unsent rows.");
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink"
                  >
                    <RotateCcw className="size-3.5" /> Reset
                  </button>'''

    new_reset_button = '''                  <button
                    onClick={() => {
                      setEngine("idle");
                      setScout(false);
                      setGenerated((prev) => prev.map((g) => ({ ...g, sent: false })));
                      if (typeof generatedRef !== "undefined" && generatedRef.current) {
                        generatedRef.current = generatedRef.current.map((g) => ({ ...g, sent: false }));
                      }
                      sentRecipientEmailsRef.current = new Set();
                      setSentRecipientEmails([]);
                      setCleanupHandled(false);
                      toast.success("Campaign progress reset. Recipients in range are ready to send again.");
                      log("Campaign progress reset. Sent flags cleared for this list.");
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-soft"
                    title="Reset campaign run state"
                  >
                    <RotateCcw className="size-3.5 text-brand" /> Reset
                  </button>'''

    if old_reset_button in app_code:
        app_code = app_code.replace(old_reset_button, new_reset_button)
        print("✓ Repaired Campaign Execution Reset button")
    else:
        # Soft: any Reset near Execute that only pauses
        soft = re.search(
            r'<button\s+onClick=\{\(\)\s*=>\s*\{\s*setEngine\("idle"\);\s*setScout\(false\);\s*log\("Campaign paused[^"]*"\);\s*\}\}[^>]*>\s*<RotateCcw[^/]*/>\s*Reset\s*</button>',
            app_code,
        )
        if soft:
            app_code = app_code[: soft.start()] + new_reset_button + app_code[soft.end() :]
            print("✓ Repaired Reset via regex")
        else:
            print("⚠ Reset button pattern not found — may already be fixed")

    # D) Hand Tour toggle in settings — only inject if Compass import exists or use Info
    if "Interactive Hand Tour" not in app_code and 'menuView === "settings"' in app_code:
        # Inject a compact toggle block after settings header if possible
        marker = 'label="Campaign Protection"'
        if marker in app_code and "Interactive Hand Tour" not in app_code:
            inject = '''                      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                        <div className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-ink">Interactive Hand Tour & Tips</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">
                            Step-by-step pointers showing what to tap next
                          </span>
                        </div>
                        <Toggle
                          on={typeof tourDismissed === "function" ? !tourDismissed() : true}
                          onClick={() => {
                            if (typeof setTourEnabled !== "function" || typeof tourDismissed !== "function") {
                              resetTour();
                              toast.info("Hand Tour tips refreshed");
                              return;
                            }
                            const currentlyOff = tourDismissed();
                            setTourEnabled(currentlyOff);
                            toast.info(currentlyOff ? "Interactive Hand Tour turned ON" : "Interactive Hand Tour turned OFF");
                          }}
                        />
                      </div>
'''
            # Find MenuRow Campaign Protection and insert before it
            idx = app_code.find(marker)
            # walk back to start of MenuRow
            start = app_code.rfind("<MenuRow", 0, idx)
            if start > 0:
                app_code = app_code[:start] + inject + app_code[start:]
                print("✓ Added Hand Tour toggle in Settings")

    # E) Chat always on MagicCircle (locked upgrade if not eligible) — careful partial replace
    if 'label: chatEligible ? "Chat" : "Chat (Locked)"' not in app_code:
        old_chat = '''...(chatEligible ? [{
              id: "chat",
              label: "Chat",
              icon: <MessageCircle className="size-5" />,
              badge: chatHub.totalUnread + chatHub.incoming,
              onSelect: () => setChatOpen(true),
            }] : []),'''
        new_chat = '''{
              id: "chat",
              label: chatEligible ? "Chat" : "Chat (Locked)",
              icon: <MessageCircle className="size-5" />,
              badge: chatEligible ? chatHub.totalUnread + chatHub.incoming : 0,
              onSelect: () => {
                if (chatEligible) setChatOpen(true);
                else askUpgrade("Private Chat is a Premium & Elite Studio ProMaxx feature.", true);
              },
            },'''
        if old_chat in app_code:
            app_code = app_code.replace(old_chat, new_chat, 1)
            print("✓ Chat always visible on floating crown")
        else:
            print("⚠ Chat MagicCircle pattern not exact — skipped")

    with open(app_path, "w", encoding="utf-8") as f:
        f.write(app_code)
    print("✓ Saved src/routes/app.tsx")

print(">>> Patch complete!")
