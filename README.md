# Elite Connectere

**Elite Connectere is an AI-powered outreach workspace. Rex is its AI Workspace Agent: designed to reason across the supported app, prepare work, use connected application tools, and request deliberate user approval before consequential operations are executed by the application's backend.**

Live application: https://eliteconnectere.site

## What Elite Connectere does

Elite Connectere brings the campaign workflow into one workspace:

- **Campaign preparation** — build recipient lists, create subject lines and message templates, and personalise messages for each recipient.
- **Recipient validation** — identify duplicates, malformed addresses, and risky entries before campaign execution.
- **Bulk campaign delivery** — use Standard Mode to prepare messages for the user's mail application, or Elite Engine to send through Gmail profiles the user has connected and authorised.
- **Sending controls** — apply pacing, Gmail profile limits, recipient safeguards, and permanent duplicate-send protection.
- **Campaign visibility** — follow campaign progress, review activity, and manage quarantined leads through the workspace tools.
- **Workspace customisation** — use the available settings and Customization Studio to configure the workspace.
- **Account and team controls** — manage connected Gmail profiles, subscriptions, eligible shared access, settings, and support.

## Rex AI — the AI Workspace Agent

Rex is designed to be the natural-language operating layer for the supported Elite Connectere workspace, not merely a fixed FAQ or campaign chatbot. The application can supply relevant data from the signed-in user's workspace, and Rex can reason, plan, explain, draft, recommend, and use real application tools where they are connected and authorized.

Current code includes conversation, navigation, workspace guidance, campaign-related assessment/approval paths, and conversation memory. The broader agent scope is being connected feature by feature. Do not assume every operation listed below is already callable from chat; availability depends on the actual tools wired into the current build.

Rex is intended to help users:

- understand how Elite Connectere and its campaign tools work;
- review campaign drafts, subject lines, templates, and message content;
- interpret recipient validation, campaign progress, and relevant workspace activity;
- spot possible weaknesses, risks, or unclear wording;
- suggest improvements to campaign content and outreach approach;
- draft or rewrite messages, announcements, prompts, and other text;
- explain practical next steps and guide users to relevant workspace areas.

Rex can adapt its response to the conversation — for example, being concise, professional, friendly, or playful when appropriate. AI recommendations can be wrong or incomplete, so users should review them.

### How Rex actions and approvals work

Rex's target operating model is: understand the request → inspect owner-authorised workspace context → plan → prepare → execute routine in-app work directly through application code → verify and report. Only outbound email campaign sends (including scheduled sends) and Private Chat message sends require an explicit approval.

Before an outbound send, Rex must show the exact recipient scope and content and provide a one-use in-chat approval control. The backend—not the AI model—must verify authentication, ownership, permissions, applicable limits, and approval state before sending. Changed send details require fresh approval. Routine owner-scoped reads, navigation, imports, exports, memory, settings and other supported workspace actions do not require an approval receipt. The model must never claim an action succeeded without a verified application result.

Rex must preserve application security, Gmail quotas, duplicate-send protection, plan entitlements, and other enforced controls. Those are execution safeguards, not restrictions on ordinary reasoning. Rex does not gain general access to Gmail inbox contents, Google contacts, or another user's private workspace. Conversation and relevant workspace context may be processed through Google's Gemini API. See the [Privacy Policy](https://eliteconnectere.site/privacy) for details.

**Implementation status:** conversation, navigation, workspace guidance, campaign-related workflows, and conversation memory exist in the codebase. Whole-workspace tool execution across every feature is a progressive implementation objective; each capability must be connected and verified before it is described as available in production.

## Privacy, terms, and help

- [Learn more](https://eliteconnectere.site/learn-more)
- [Privacy Policy](https://eliteconnectere.site/privacy)
- [Terms of Service](https://eliteconnectere.site/terms)
- [Support](https://eliteconnectere.site/support)

## Development

This repository contains the Elite Connectere application. The production app is deployed on Vercel from the `main` branch.

Requirements: Node.js and npm.

```sh
git clone https://github.com/eliteconnectere/eliteconnectere.git
cd eliteconnectere
npm install
npm run dev
```

Before changing campaign execution, billing, Gmail OAuth, data persistence, or account access, inspect the related server functions and entitlement checks. Preserve existing safety controls and verify the production deployment before describing a change as live.
