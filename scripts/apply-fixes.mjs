import { execSync } from "node:child_process";
import fs from "node:fs";

console.log("1. Restoring original app.tsx from git history commit 9266095...");
let app = execSync("git show 92660955be163be561d29e4a5bf9c931dce72251:src/routes/app.tsx", {
  maxBuffer: 15 * 1024 * 1024,
}).toString("utf8");

console.log("2. Applying tier gating, delay locks, and cleaning Plan 3 in app.tsx...");

// A. Map upgrade modal to Premium & ProMaxx
app = app.replace('setPremiumOnly(plan3Only ? ["plan3"] : undefined);', 'setPremiumOnly(plan3Only ? ["premium", "promaxx"] : undefined);');

// B. Chat eligible only on Premium, ProMaxx, or Company
app = app.replace(
  'const chatEligible = entitlements ? entitlements.plan === "plan3" || entitlements.company : false;',
  'const chatEligible = entitlements ? entitlements.plan === "premium" || entitlements.plan === "promaxx" || entitlements.company : false;'
);

// C. Permanent Send Protection is universal (active for all plans)
app = app.replace(
  'const duplicateProtectionEligible = GOOGLE_REVIEW_MODE || (entitlements ? entitlements.plan === "plan3" || entitlements.company : false);',
  'const duplicateProtectionEligible = true;'
);

// D. Night Mode Light: screen glow only applies if user is on Elite Studio ProMaxx (canCustomize)
app = app.replace(
  'root.classList.toggle("night-mode-light", settings.nightModeLight);',
  'root.classList.toggle("night-mode-light", Boolean(settings.nightModeLight && canCustomize));'
);

// E. Delays: lock 3s and 4s for Free/Starter/Standard (only unlocked for Premium & ProMaxx)
app = app.replace(
  'const locked = false;',
  'const locked = (d === 3 || d === 4) && !premium;'
);
app = app.replace(
  '"This delay is not available on your current plan."',
  '"3s and 4s delays require Premium or Elite Studio ProMaxx."'
);

// F. Floating Crown (MagicCircle): only show in Elite Engine mode for Chat-eligible subscribers
app = app.replace(
  '{signedIn && !chatOpen && !assistOpen && (',
  '{signedIn && mode === "elite" && chatEligible && !chatOpen && !assistOpen && ('
);

// G. Settings menu: Night Mode Light requires Elite Studio ProMaxx
app = app.replace(
  'onClick={() => { setFeatureStudio("nightMode"); setPanel("none"); }}',
  'onClick={() => { if (!canCustomize) { askUpgrade("Night Mode Light is an Elite Studio ProMaxx feature.", true); return; } setFeatureStudio("nightMode"); setPanel("none"); }}'
);

// H. Replace all legacy "Plan 3" copy with proper tier names
app = app.replace(
  '{view === "campaignProtection" && <span className="text-[10px] font-semibold text-brand">Plan 3</span>}',
  '{view === "campaignProtection" && <span className="text-[10px] font-semibold text-emerald-600">Active</span>}'
);
app = app.replace(
  'sub={canCustomize ? "Colours, type, shape and density" : "Plan 3"}',
  'sub={canCustomize ? "Colours, type, shape and density" : "Elite Studio ProMaxx"}'
);
app = app.replace(
  '<span className="rounded-full border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand">Plan 3</span>',
  '<span className="rounded-full border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand">Elite Studio ProMaxx</span>'
);
app = app.replace(
  '<span className="rounded-full border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand">Plan 3</span>',
  '<span className="rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span>'
);
app = app.replace(
  'askUpgrade("Custom daily targets up to 420 per profile are a Plan 3 feature.", true)',
  'askUpgrade("Custom daily targets up to 420 per profile are an Elite Studio ProMaxx feature.", true)'
);
app = app.replace(
  '{duplicateProtectionEligible ? "Blocks the exact same recipient, subject, and message permanently across Gmail rotation and revalidation." : "Plan 3 only. Upgrade to Plan 3 to permanently block duplicate sends across Gmail rotation and revalidation."}',
  '"Blocks the exact same recipient, subject, and message permanently across Gmail rotation and revalidation."'
);
app = app.replace(
  '"Interface Customization is a Plan 3 feature."',
  '"Interface Customization is an Elite Studio ProMaxx feature."'
);
app = app.replace(
  '"Private Chat is a Plan 3 feature."',
  '"Private Chat is a Premium and Elite Studio ProMaxx feature."'
);

fs.writeFileSync("src/routes/app.tsx", app, "utf8");
console.log("✓ src/routes/app.tsx restored and updated successfully.");

console.log("3. Updating src/features/chat/PrivateChat.tsx...");
if (fs.existsSync("src/features/chat/PrivateChat.tsx")) {
  let chat = fs.readFileSync("src/features/chat/PrivateChat.tsx", "utf8");
  chat = chat.replace("Private Chat is part of Plan 3", "Private Chat is part of Premium & Elite Studio ProMaxx");
  chat = chat.replace("Connect privately with other Plan 3 members while your campaigns keep running.", "Connect privately with other Premium & Elite Studio ProMaxx members while your campaigns keep running.");
  chat = chat.replace("See Plan 3", "See Premium & ProMaxx");
  chat = chat.replace("Choose how other Plan 3 members find you. Your email is never shown.", "Choose how other Premium & Elite Studio ProMaxx members find you. Your email is never shown.");
  chat = chat.replace("No Plan 3 members match", "No members match");
  chat = chat.replace("Search for a Plan 3 member above to send your first connection request.", "Search for a member above to send your first connection request.");
  fs.writeFileSync("src/features/chat/PrivateChat.tsx", chat, "utf8");
  console.log("✓ src/features/chat/PrivateChat.tsx updated.");
}

console.log("4. Disabling Google Review Mode in src/lib/reviewMode.ts...");
fs.writeFileSync(
  "src/lib/reviewMode.ts",
  `/**\n * Google OAuth verification is approved.\n * false = real Elite Engine workspace (plans, payment, full features).\n * true = temporary Review CRM only (used during Google verification).\n */\nexport const GOOGLE_REVIEW_MODE = false;\n`,
  "utf8"
);
console.log("✓ GOOGLE_REVIEW_MODE set to false.");

console.log("All updates applied cleanly!");
