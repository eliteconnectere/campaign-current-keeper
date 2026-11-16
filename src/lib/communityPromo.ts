/**
 * The Bloodline community promo — November 2026.
 * Free users get expanded access for this calendar month; paid plans unchanged.
 */
export const COMMUNITY_PROMO = {
  year: 2026,
  month: 11, // November
  maxGmailProfiles: 20,
  chatDrainMinutes: 40,
  chatRefillFactor: 0.35,
  endsLabel: "30 November 2026",
  headline: "A Warm Welcome From The Bloodline 💯",
  subheading:
    "November 2026 Special Creator Privilege · Built with purpose, engineered for performance, and designed to help you work smarter, breathe easier, and elevate your outreach.",
  privilegeTitle: "YOUR NOVEMBER PRIVILEGE",
  privilegeLead: "COMPLIMENTARY REX + 20 GMAIL CONNECTIONS + CAMPAIGN EXECUTION THROUGH NOVEMBER",
  welcomeTitle: "WELCOME TO ELITE CONNECTERE",
  welcomeBody: [
    "Welcome to Elite Connectere! We’re delighted to have you here.",
    "We built this platform with a clear vision: to make professional outreach more organised, efficient, intelligent, and less stressful.",
    "Whether you’re managing multiple Gmail accounts, organising recipient lists, preparing campaigns, or building meaningful connections, Elite Connectere brings powerful outreach capabilities into one carefully engineered workspace.",
    "Our goal is simple: give you the tools, flexibility, and control to focus on what matters while the platform handles the complexity behind your workflow.",
  ],
  giftTitle: "A SPECIAL GIFT FROM THE BLOODLINE 💯",
  giftIntro:
    "Throughout November, The Bloodline is providing complimentary access to Rex, up to 20 connected Gmail accounts, Elite Engine campaign creation and execution, and the 3-second and 4-second sending delays. Private Chat, Night Mode, interface customisation, and other workspace studios remain subscription features.",
  giftItems: [
    {
      icon: "🧠",
      title: "Rex AI Assistant",
      body: "Use Rex to ask questions, understand your workspace, organise your thinking, prepare campaigns, and get help with supported tasks.",
    },
    {
      icon: "📧",
      title: "Up to 20 Gmail Connections",
      body: "Connect and manage up to 20 Gmail accounts under your Elite Connectere login, then prepare and execute approved campaigns through Elite Engine.",
    },
  ],
  promiseTitle: "OUR PROMISE TO YOU",
  promiseBody: [
    "We believe powerful tools should come with clarity, transparency, and respect for the people using them.",
    "Your workspace should remain yours. Your information should remain under your control, and you should always understand the privileges available to your account.",
    "This November experience is our way of welcoming creators, campaign operators, and outreach professionals into the Elite Connectere ecosystem.",
  ],
  afterTitle: "WHAT HAPPENS AFTER NOVEMBER?",
  afterBody: [
    "This special complimentary privilege runs through 30 November 2026.",
    "From 1 December 2026, the regular subscription plans and applicable plan benefits will take effect.",
    "If you choose to become a paid member, your access will continue according to your selected subscription.",
    "Your existing workspace data remains intact. The end of the promotional period does not mean losing your saved information.",
  ],
  closingTitle: "A FINAL WORD FROM THE BLOODLINE 💯",
  closingBody: [
    "We didn’t build Elite Connectere simply to give you another tool to use. We built it to give you a better way to work, organise your outreach, and grow your connections.",
    "Take your time, explore the workspace, discover its capabilities, and make the most of your November privilege.",
    "We’re glad to have you with us.",
    "Welcome to Elite Connectere. Welcome to a better way of working.",
  ],
  signOff: "— The Bloodline 💯",
  // Short bullets kept for any compact surfaces
  notes: [
    "Use Rex, connect up to 20 Gmail accounts, execute approved Elite Engine campaigns, and select 3-second or 4-second sending delays through 30 November 2026.",
    "Private Chat, Night Mode, interface customisation, and other workspace studios require an eligible subscription. Campaign execution and 3-second/4-second delays are included in the November Bloodline privilege.",
    "Your workspace data stays intact after 30 November 2026; regular subscription benefits apply from 1 December.",
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
