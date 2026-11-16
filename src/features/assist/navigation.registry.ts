/** Free agent mode: no FAQ injection, no keyword phrase routing. */
export const REX_AUTONOMY_EXPERIMENT = true;

/**
 * Real destinations the workspace can open. Rex reasons over purpose text and
 * picks with navigate_to — there is no keyword router and no canned path table.
 * app.tsx onGo is the only execution adapter.
 *
 * SAFE (auto): navigation listed here opens without an approval pill — BUT only
 * when the user explicitly asked to go/open/take them there. Capability answers
 * and suggestions must NOT emit [[GO:]] / navigate_to.
 * SENSITIVE (red pill): send/schedule/stop campaign, delete data, disconnect,
 * send private chat, export private data — never auto-run those from navigate alone.
 */
export type NavDestination = {
  place: string;
  purpose: string;
  parent?: string;
  kind?: "page" | "panel" | "studio" | "settings" | "filter" | "record" | "external" | "action";
  params?: string[];
};

export const NAVIGATION_DESTINATIONS: readonly NavDestination[] = [
  { place: "workspace", purpose: "Return to the main Elite Connectere workspace dashboard and campaign builder; always lands at the top of the workspace", kind: "page" },
  { place: "workspace-menu", purpose: "Open the main workspace menu with activity, planner, settings, tools, billing and account actions; menu scrolls to top", kind: "panel" },
  { place: "export-data", purpose: "Navigate to the Export Data / CSV Backup control in the workspace menu; show the control but do not download private data without the user pressing it", parent: "workspace-menu", kind: "action" },
  { place: "clear-cache", purpose: "Open Settings and scroll to Clear Local Cache; does not clear until the user presses the control", parent: "settings", kind: "action" },
  { place: "erase-data", purpose: "Only locate/show the existing red DATA RESET / Erase Data control when explicitly asked to find it. NEVER execute it. Rex must refuse any request to erase data and explain that only the owner can choose the destructive control. Different from Reset Workspace.", parent: "settings", kind: "action" },
  { place: "reset-workspace", purpose: "Navigate to Reset Workspace only: clears current campaign/recipients draft, keeps saved app data. NOT Erase Data.", parent: "settings", kind: "action" },
  { place: "account", purpose: "Open the signed-in user's account page and account details", parent: "workspace-menu", kind: "page" },
  { place: "logout", purpose: "Sign out of the current Elite Connectere session when explicitly requested.", parent: "workspace-menu", kind: "action" },
  { place: "recipients", purpose: "Main recipient workspace: paste or edit email addresses, inspect validation results and manage the recipient list", kind: "panel" },
  { place: "recipient-valid", purpose: "Show the valid recipient filter in the main recipient list", parent: "recipients", kind: "filter" },
  { place: "recipient-duplicate", purpose: "Show duplicate recipient addresses in the main recipient list", parent: "recipients", kind: "filter" },
  { place: "recipient-risky", purpose: "Show risky recipient addresses in the main recipient list", parent: "recipients", kind: "filter" },
  { place: "campaign-execution", purpose: "Navigate to the campaign execution controls in the main workspace; does not start a campaign", kind: "action" },
  { place: "campaign-progress", purpose: "Navigate to campaign status, queue and progress information in the main workspace", kind: "panel" },
  { place: "connect-gmail", purpose: "Navigate to the connected Gmail profiles area and its connect-account control", parent: "gmail-profiles", kind: "action" },
  { place: "appearance", purpose: "Open the Appearance section inside workspace Settings", parent: "settings", kind: "settings" },
  { place: "rex-memory", purpose: "Rex conversation memory, saved chat history, memory preferences", parent: "rex-studio", kind: "settings" },
  { place: "rex-studio", purpose: "Rex control centre: personality, guardian, campaigns, alerts, memory, Rex Monitor controls", kind: "studio" },
  { place: "studio", purpose: "Customization: colours, theme, night mode, branding, wheel colour, fonts — applies across the full app including Rex UI", kind: "studio" },
  { place: "night-mode", purpose: "Night mode / dark mode controls; should take effect on the whole app including Rex chat and Rex Studio", parent: "studio", kind: "settings" },
  { place: "settings", purpose: "General settings menu root; always opens the menu scrolled to the top so Settings is visible", kind: "settings" },
  { place: "notifications", purpose: "Notification SETTINGS DASHBOARD under Settings: Notification and Sound Management (tones, vibration, sending sounds, which events notify you). Use for notification dashboard, notification management, sound settings — NOT the bell inbox.", parent: "settings", kind: "settings" },
  { place: "notifications-bell", purpose: "Notification CENTER / bell inbox: unread alerts feed at the top of the app. Use for notification center, bell, inbox, alerts list — NOT Settings notification management.", kind: "panel" },
  { place: "protection", purpose: "Campaign Protection and Permanent Send Protection rules", parent: "settings", kind: "settings" },
  { place: "subscription", purpose: "Subscription, plan, billing management", parent: "settings", kind: "settings" },
  { place: "upgrade", purpose: "Available plans and upgrade options", kind: "panel" },
  { place: "scope", purpose: "Scope of outreach settings", parent: "settings", kind: "settings" },
  { place: "history", purpose: "Smart Fill history of past list generations", parent: "settings", kind: "settings" },
  { place: "tools", purpose: "Tools and visibility preferences", parent: "settings", kind: "settings" },
  { place: "gmail-profiles", purpose: "Connected Gmail profiles: connect, disconnect, targets, 24h usage", parent: "settings", kind: "settings" },
  { place: "delay-settings", purpose: "Sending delay / pacing interval controls", parent: "settings", kind: "settings" },
  { place: "activity", purpose: "Activity log of sends, skips, workspace events", kind: "studio" },
  { place: "activity-campaign", purpose: "Campaign-only activity records", parent: "activity", kind: "filter" },
  { place: "activity-system", purpose: "System and workspace activity records", parent: "activity", kind: "filter" },
  { place: "tracker", purpose: "Campaign & Activity Centre with 24-hour Gmail tracker", kind: "studio" },
  { place: "tracker-skipped", purpose: "Skipped recipients and campaigns (Permanent Send Protection)", parent: "tracker", kind: "filter" },
  { place: "tracker-failed", purpose: "Failed sends and failed campaign recipients", parent: "tracker", kind: "filter" },
  { place: "tracker-completed", purpose: "Completed campaigns", parent: "tracker", kind: "filter" },
  { place: "tracker-paused", purpose: "Paused campaigns", parent: "tracker", kind: "filter" },
  { place: "tracker-running", purpose: "Currently running or queued campaigns", parent: "tracker", kind: "filter" },
  { place: "tracker-today", purpose: "Today's campaign results", parent: "tracker", kind: "filter" },
  { place: "sending", purpose: "Sending modes: Elite Engine vs Standard", kind: "studio" },
  { place: "planner", purpose: "Campaign planner, scheduled days, notes", kind: "studio" },
  { place: "smartfill", purpose: "Smart Fill recipient list generation and saved lists", kind: "studio" },
  { place: "monitor", purpose: "Live campaign send monitor / progress panel in Radar", parent: "radar", kind: "panel" },
  { place: "campaign-monitor", purpose: "Alias destination for Campaign Monitor (same as rex-monitor): current campaign real-time monitor inside Rex Studio.", parent: "rex-studio", kind: "settings" },
  { place: "rex-monitor", purpose: "Campaign Monitor in Rex Studio: real-time monitor for the CURRENT campaign only (not history, not multi-campaign tracking). When on, Rex owns the run across logout; turn off only here; next monitor request is asked again. Search/nav: campaign monitor, rex monitor.", parent: "rex-studio", kind: "settings" },
  { place: "templates", purpose: "Message templates and subject/body editor", kind: "panel" },
  { place: "radar", purpose: "Radar Hub: health, vault, snippets, monitor", kind: "panel" },
  { place: "vault", purpose: "Quarantine Vault for risky and invalid leads", parent: "radar", kind: "panel" },
  { place: "quarantine", purpose: "Quarantine Vault (same as vault)", parent: "radar", kind: "panel" },
  { place: "snippets", purpose: "Open saved message snippets library in Radar", parent: "radar", kind: "panel" },
  { place: "snippets-add", purpose: "Open Snippets with the add-template form ready so the user can save message bodies Rex prepared", parent: "snippets", kind: "action" },
  { place: "chat", purpose: "Private Chat inbox", kind: "panel" },
  { place: "chat-settings", purpose: "Private Chat settings", parent: "chat", kind: "settings" },
  { place: "hotspot", purpose: "Hotspot / team sharing access and seats", kind: "panel" },
  { place: "support", purpose: "Support and appeals centre", kind: "panel" },
  { place: "appeals", purpose: "Appeals panel", kind: "panel" },
  { place: "admin", purpose: "Admin panel (owner only)", kind: "panel" },
  { place: "learn-more", purpose: "Product guide and feature explanations", kind: "external" },
  { place: "privacy", purpose: "Privacy Policy", kind: "external" },
  { place: "terms", purpose: "Terms of Service", kind: "external" },
  { place: "tour", purpose: "Guided walkthrough of the workspace", kind: "panel" },
  
  // --- Settings panel rows (exact controls, not "nearby") ---
  { place: "settings-campaign-protection", purpose: "Open Settings → Campaign Protection (permanent duplicate protection and Gmail rotation)", parent: "settings", kind: "settings" },
  { place: "settings-smart-fill-history", purpose: "Open Settings → Smart Fill History (saved email sets)", parent: "settings", kind: "settings" },
  { place: "settings-notifications", purpose: "Same as notifications: Settings → Notification and Sound Management dashboard (not the bell).", parent: "settings", kind: "settings" },
  { place: "settings-night-mode-light", purpose: "Open Night Mode Light customization (colours, speed, edge coverage) from Settings", parent: "settings", kind: "settings" },
  { place: "settings-interface", purpose: "Open Interface Customization (colours, type, shape, density) from Settings", parent: "settings", kind: "settings" },
  { place: "settings-tools", purpose: "Open Settings → Tools & Visibility", parent: "settings", kind: "settings" },
  { place: "settings-subscription", purpose: "Open Settings → Subscription plan details", parent: "settings", kind: "settings" },
  { place: "settings-export-data", purpose: "Open Settings and highlight Export Data / CSV Backup control", parent: "settings", kind: "action" },
  { place: "settings-clear-cache", purpose: "Open Settings and highlight Clear Local Cache control", parent: "settings", kind: "action" },
  { place: "settings-erase-data", purpose: "Only open Settings and highlight the existing red DATA RESET / Erase Data control when explicitly asked to locate it. Never activate or execute it; Rex must refuse data-erasure requests.", parent: "settings", kind: "action" },
  { place: "settings-walkthrough", purpose: "Start or open the product walk-through from Settings", parent: "settings", kind: "action" },
  { place: "tracker-run", purpose: "Open a specific campaign run by ID (use tracker-run-{id})", parent: "tracker", kind: "record", params: ["runId"] },
] as const;

/** Catalog for Gemini — reasoning over purposes, not keyword matching. */
export function buildNavigationCatalogForAi(): string {
  return [
    "REGISTERED DESTINATIONS (use navigate_to with one of these place ids):",
    "Choose from your understanding of the user's goal. Prefer the most specific place.",
    "The examples below are illustrative only, never exhaustive and never a whitelist. Do not limit understanding to example phrases or exact destination names.",
    "Users may describe any registered feature in their own words, with misspellings, missing/extra letters, synonyms, abbreviations, phonetic spellings, or long descriptions. Match by meaning and context, not exact wording. Behave like the in-app Settings search: typo-tolerant ranking over the registered catalog.",
    "The full registered destination catalog is the searchable universe for static app destinations. User-owned published Rex features and personal destinations are also supplied dynamically; include them when relevant.",
    "If no candidate is an adequate match, do not force a wrong destination. Ask a concise clarification or explain the destination is not registered; never invent a route or capability.",
    "CRITICAL: Emit navigate_to / [[GO:]] ONLY when the user explicitly asked to open, go to, take them to, show, or land on a place.",
    "Do NOT navigate when only listing capabilities, answering 'what can you do', or offering suggestions. Suggestions use [[SUGGEST:]] chips only.",
    "SAFE navigation is automatic (no approval pill) for explicit go-requests. SENSITIVE actions still require the red approval control.",
    "Examples: logout/sign out → logout; valid leads → recipient-valid; risky leads → vault; add templates to snippets → snippets-add; Rex Monitor → rex-monitor; night mode → night-mode; settings → settings.",
    ...NAVIGATION_DESTINATIONS.map((d) => `- ${d.place}: ${d.purpose}`),
  ].join("\n");
}
