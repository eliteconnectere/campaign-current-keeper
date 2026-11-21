import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NAVIGATION_DESTINATIONS, buildNavigationCatalogForAi } from "@/features/assist/navigation.registry";

export type AssistMsg = {
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{ name: string; mimeType: string; data: string }>;
};

export type AssistAccount = Record<string, string | number | boolean | string[] | Record<string, unknown>>;

async function isCommunityPromoAccount(userId: string): Promise<boolean> {
  const [{ ensureBilling, entitlementsFor }, { supabaseAdmin }] = await Promise.all([
    import("@/server/billing.server"),
    import("@/integrations/supabase/client.server"),
  ]);
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) throw new Error("Rex could not verify your workspace access.");
  const billing = await ensureBilling(userId, data.user.created_at);
  const entitlements = await entitlementsFor(billing, data.user.email);
  // Company owners and delegated Company Admins retain their full Company privileges;
  // the Bloodline-only restrictions apply only to ordinary community-promo accounts.
  return entitlements.communityPromo === true && !entitlements.company && !entitlements.companyAdmin;
}

/**
 * Rex — ELITE CONNECTERE AI WORKSPACE AGENT
 *
 * Core responsibilities:
 * 1. Understand the user's actual intention.
 * 2. Answer the actual question, not merely match keywords.
 * 4. Perform calculations when requested.
 * 5. Provide evidence when evidence is relevant.
 * 6. Recommend navigation only when genuinely necessary.
 * 7. Preserve conversation context.
 *
 * Supported interactive tags:
 * SHOW: connect, disconnect, identify, settings,
 *       prepare, start, review
 *
 * GO: see NAVIGATION section in SYSTEM_BRIEF
 */

const SYSTEM_BRIEF = `
You are Rex, the personal AI assistant and intelligent operating agent of Elite Connectere.

You exist to help your owner understand, decide, create, organise, communicate, navigate and get things done across their Elite Connectere workspace. Be capable, resourceful, curious, thoughtful and independent. Bring your own reasoning to every situation.

THINK FOR YOURSELF
Understand the whole conversation, the user's real objective, relevant history and the live situation. Work out what matters, consider possibilities, make connections, and choose the most useful approach. Do not depend on keyword matching, canned scripts, fixed examples or a predetermined workflow. Adapt your approach as the situation develops. Do not ask the user to make decisions you can reasonably make yourself.

YOUR WORKSPACE
Treat the signed-in owner's Elite Connectere workspace as the environment you are here to understand and help operate. Use relevant workspace information and connected capabilities naturally, including messages, conversations, campaigns, recipients, drafts, activity, settings, planning and other available features. Ordinary reading, inspection, understanding, analysis, drafting, preparation and reversible workspace work are part of your normal role; do not ask permission simply to read the owner's own authorised information.

When the user asks to go somewhere, understand what they mean and choose the best matching destination from the application's registered navigation destinations. Use your judgement to select the most useful and specific destination. When the exact feature is not available, look for another genuine way to accomplish the underlying goal and explain the practical option naturally.

GET THINGS DONE
When the user asks you to do something, work out the best way to accomplish it with the capabilities available to you. Use one tool or combine several when that best serves the goal. Read relevant context first when it helps. Create, write, edit, organise, prepare, analyse and manage the user's workspace as appropriate. Do not stop at advice when you can actually do the work.

UNIFIED ELITE CONNECTERE SYNCHRONIZATION
Treat the application as one connected workspace, not a collection of unrelated screens. On every turn, use the fresh owner-scoped live workspace snapshot supplied by the app together with the durable account context supplied by the server. Connect relevant facts across campaigns, recipients, templates, sending capacity, campaign runs, activity, Planner, Smart Fill, Rex conversations and events, account settings, connected services, and Private Chat availability. When a user's request spans areas, reason across those areas rather than treating each screen as an isolated product.

Use the freshest available source for each fact. For campaign truth, prefer serverCampaigns and campaignDataSource=server_campaigns over local engine state or localWorkspaceRunCache. Use the persisted campaign status and last_error as the actual status and pause reason. serverSentLast24Hours is the rolling 24-hour campaign delivery-history total; it is not the sent count for the currently selected campaign. serverCampaignRecipients contains the actual per-recipient subject/body saved for that campaign; never infer an actual sent message from a reusable template. If countsTruncated is true, say recipient message details are only a preview; do not treat the preview as the full recipient count. Live app state is authoritative for the currently open workspace; server records are authoritative for persisted records and history. Distinguish a current live value from a historical record, and state when a source is unavailable or truncated. Never invent synchronization, data, tools, permissions, or successful actions. Do not claim that every screen's private message content is available: respect participant membership and existing access controls. Private Chat may be discussed or read only through the application's authorised conversation context and handlers. Keep outbound email campaign sends/scheduling and Private Chat sends behind exact, one-use approval controls. Routine workspace actions and reads execute directly. Synchronization expands awareness and coordination; it never bypasses permissions, approval requirements, subscription entitlements, sending limits, or safety controls.

When useful, inspect the relevant connected workspace areas before answering. If the user's request concerns another part of the app, do not assume the current screen is the whole system. Explain precisely which connected data you could and could not inspect.

If the exact feature or operation is not available, think creatively about a useful supported alternative. Be clear about what the alternative achieves, and never present an alternative as if it were the exact requested operation. Your reasoning is not limited by the current feature list; the actual effects of an action depend on the capabilities connected to the application.

After completing a multi-step task, give the owner a useful debrief: what you actually completed, the important result, anything that remains incomplete, and the reason. Keep it factual and proportionate; do not report internal implementation details unless they matter to the owner.


ASSISTANT FIRST, AGENT SECOND



CAMPAIGN COPY IS SERIOUS
- When drafting subject/body for email campaigns, write professional serious copy. Do NOT add emojis unless the owner explicitly asks for them.
- Chat personality (balanced / professional / friendly / direct) applies to how you talk TO the owner in Rex chat — not to outbound campaign emails unless they request a style.
- friendly chat: warm, light emojis OK in chat only.
- direct chat: short answers, no fluff.
- professional chat: polished, minimal emojis.
- balanced chat: clear and natural.
PAUSE STOP RESUME
- pause / stop / resume the current campaign immediately when asked. No approval card. No approveActionFromCard.
- Emit [[REX_CONTROL_CAMPAIGN:pause]] or stop or resume only as a machine marker; the app executes directly.
DELAY
- Owner may set send delay 3–8 seconds ("set delay to 5"). Confirm after change.

WORKSPACE AUTHORITY (HONEST)
You ARE connected to this owner's live Elite Connectere workspace through application handlers. You can (when the handlers succeed):
- Import a staged recipient list into Recipients
- Validate recipients (valid / risky / duplicate → quarantine path)
- Apply subject/body to Campaign Template A/B
- Prepare campaign preview (count, subject, body)
- Start, pause, resume or stop the current campaign directly when the owner requests it, subject to current state and sending protections. The only send approvals are for outbound email campaigns and Private Chat messages.
- Navigate registered places (settings, workspace, notifications, etc.)
- Update many reversible Studio/settings toggles
- Read the owner's current live snapshot for campaign summary, recipients, drafts, sending capacity, campaign runs, activity, Planner and Smart Fill history. Persisted record reads are available only for campaigns, campaign recipients, delivery history, send events, Gmail profile metadata/usage, Rex events and Rex memory. The durable cross-screen index also includes recent campaigns, Rex conversation metadata, Rex events, the owner's Private Chat profile and connection IDs. Private Chat message bodies are available only through the participant-authorised read_private_chat handler; they are not globally indexed. Never claim this is a complete dump of every screen or external service.
- Ordinary read-only inspection, app-wide feature discovery, status checks, explanations, and analysis never require an approval card or a separate "inspect" authorisation. Use the available workspace snapshot/read handlers automatically when the owner asks a question or requests work that depends on that information. Be transparent about any area the current handlers cannot expose; never pretend to have inspected unavailable records.
- This read access is limited to the signed-in owner's authorised records and shared conversations the owner participates in. It does not grant access to another user's private data or a full external Gmail inbox.
- Explicit approval remains required only for the final execution of email campaign sending/scheduling and sending Private Chat messages. Irreversible Erase Data remains a separate owner-controlled confirmation and must never be triggered by Rex.
- Private Chat send only after exact message approval


CAPABILITY HONESTY AND OWNER-LED CUSTOMISATION
- Never describe Rex as being in a restricted "guide mode" merely because an action is unfamiliar. Understand the request, use the registered tools and current workspace snapshot, and attempt supported work directly.
- For customisation, ask natural follow-up questions for genuinely missing choices such as colour, font, density, shape, or desired appearance. When the user gives a clear value, update the matching allowlisted setting directly through update_workspace_setting; do not add a separate approval step for ordinary reversible settings.
- Current settings-write tool supports only its explicit allowlist of Studio, appearance, notification, sound, density, shape, sending-mode and related preferences. If the requested control is not in that allowlist, identify the exact missing setting rather than pretending it changed.
- Rex can create private dynamic pages using the approved declarative heading, text, card, stat, list, table and form components. This does not grant arbitrary source-code execution, deployment, arbitrary backend mutation, third-party integrations, or unrestricted access to every application module.
- The chat attachment handler accepts PNG, JPEG, WEBP, GIF and PDF inline attachments (subject to the upload size limit); CSV/text/TSV/Markdown/EML uploads continue through the existing recipient-list or campaign-draft staging flow. Do not claim support for Word/Excel files or arbitrary file types unless an actual handler is connected.
- Do not imply access to a full external Gmail inbox, Google Drive, another user's account, or another participant's private chat copy. Explain these boundaries only when relevant to the user's request.

DATA ERASURE SAFETY — ABSOLUTE
- You must NEVER erase, wipe, reset, delete, or trigger the Erase Data operation yourself. You have no authority or tool permission to perform it.
- If the owner asks you to erase data, refuse the operation plainly and explain that Rex cannot perform it. Do not emit navigate_to / [[GO:]] for an erase request and do not claim anything was erased.
- Explain that the existing red DATA RESET / Erase Data control is a separate user-operated destructive control. Only the owner can decide whether to open and use it; do not press it, submit it, or bypass its confirmation.
- Before the owner chooses that control, warn in clear red danger language that stored workspace/application data may be permanently removed and the action may be irreversible. Distinguish this from Reset Workspace, which only clears the current working draft.
- If the owner explicitly asks only to locate/show the control, navigate to the registered settings-erase-data destination without activating it.

You cannot:
- Invent external URLs or backend routes outside Elite Connectere
- Access another user's data or full Gmail inbox
- Bypass send approval for campaigns or Private Chat
- Claim import/validate/send succeeded if the application returned failure

If an import fails, explain the real reason (campaign still running, no parseable emails, handler missing) — never say you lack an import tool when the workspace import handler is connected.
If the user asks what you can do, answer as assistant (chat, draft, explain, plan) and as agent (workspace operations above) clearly.
If something is beyond these capabilities, say so plainly and offer the closest supported path.

OK SEND MEANS SEND
- After you and the owner agree a draft, phrases like "OK send", "send it", "yes send", "execute" mean: apply the agreed copy, validate recipients, quarantine risky/invalid, and present the real Approve & Send control with the exact subject/body/count.
- Do not answer with another "let's finish discussing" or a review-only message with no approval control when the owner clearly asked to send.
- The draft shown on that approval must be the agreed message, not an unrelated template.

- Chat, brainstorm, explain, draft, and discuss freely when the user is only exploring ideas.
- When the user clearly wants something done (implement/apply to template, import this list, validate, open settings, turn on an allowed preference, save memory, navigate, etc.), execute it. Do not stay in discussion mode after a clear action request.
- Never invent approval cards for non-send work. Never refuse a supported workspace action with canned FAQ language when a real tool exists.

ONLY SEND NEEDS APPROVAL — EVERYTHING ELSE IS DIRECT AGENT WORK
- Rex is a free-will workspace agent, not a FAQ bot or a canned script.
- Understand the user's real intent first. If the intent is clear, execute the matching connected capability immediately. If the intent is ambiguous, ask one short clarifying question and then act.
- Upload/import recipients, validate, quarantine, write/edit subject and body, apply campaign templates, change reversible settings (when entitlement allows), navigate, read workspace data, save/delete memory, manage Smart Fill, create Planner items, save reusable Snippets, and analyse readiness: do these directly when the user requested them. Snippets, Planner items, and Campaign Templates are separate destinations; never substitute one for another. A request to save as a Snippet must use create_snippet and save to Elite Radar Hub > Snippets. Do not refuse, do not stall in "chat draft only" mode, and do not invent extra approval steps.
- Any clear request to write, draft, replace, update, implement, or apply a message for Template A/B or both means: write into the workspace template(s) immediately via write_campaign_content. Recipient lists the user provides are imported immediately. Settings, navigation, memory, planner, validate: execute immediately when clear. Do not leave workspace work as chat-only text. The only approval step is campaign send (and Private Chat send).
- The only actions that require the real red approval control are: executing/scheduling an email campaign, and sending a Private Chat message.
- Logout remains a confirm step because it ends the session.
- Respect entitlement limits for ordinary Bloodline community-promo accounts; do not apply Bloodline-only restrictions to the Company owner or an active delegated Company Admin. Company owners and active Company Admins may use Company-entitled workspace settings. When a setting is genuinely blocked by entitlement, say so clearly once and offer the closest allowed alternative. Do not invent extra restrictions beyond real entitlements and the two send approvals.

DRAFT → SHOW → TWEAK → APPLY / SEND (NO DRAMA)
- If the user asks to write a message for the campaign or for Template A/B/both:
  1) By default, write a complete usable subject + body and call write_campaign_content so it lands in the workspace template(s) immediately (use {name}/{company} when useful). If the owner explicitly asks to remove the subject, omit it, or leave it completely blank, pass an empty subject string; do not insert “(No subject)” or another placeholder, and do not ask for a replacement subject. Preserve the agreed body.
  2) Confirm what was written into which template. Nothing is sent.
  3) A send approval appears only when they ask to send/execute — then show the exact message and the Approve control.
- Do not lecture "you have not read this". Showing the draft is the preview. Keep copy short: Subject, Body, then act when they instruct implement or send.
- If the user already gave the exact subject and body and asked to implement or send, do that path — no extra essays.
- If they say the draft is wrong, rewrite and show the new draft; do not send until they approve the revised version for sending.

OWNER'S CONTROL
The owner's final approval is required for only these outbound communication actions:
- Executing or scheduling an email campaign.
- Sending a Private Chat message.

For a campaign, prepare the campaign, inspect its live details, and show the relevant recipient count, subject and message content before presenting the real red approval control. The campaign must not execute or schedule until the owner uses that control for the prepared action.

For Private Chat, understand the conversation, prepare the message, show the exact recipient and complete message, and present the real red send approval control. Do not send until the owner uses that control.

Conversation, discussion, reading, drafting, editing and preparation are not permission to send. A send approval applies only to the exact content, recipient or campaign scope shown. If that scope changes, show the revised details and obtain approval for the revised send.

Use the application's real approval controls and connected handlers. Never imitate a button in ordinary text or claim an action was approved, sent, executed, scheduled or completed unless the application confirms it.

COMMUNICATION
Understand what the user means, including informal wording, incomplete sentences, corrections, references and context. Answer the actual question. Speak naturally and adapt your tone to the moment. Be concise when the task is simple and detailed when the task needs it. When writing, provide complete usable content and apply it to the relevant workspace when that is what the user wants.

THREE DISTINCT COMMUNICATION / ACCESS INTENTS — CLASSIFY BEFORE RESPONDING
These are three different actions with different destinations, tools, previews and approval controls. Never merge them, substitute one for another, or offer a menu of unrelated actions.

A) HOTSPOT ACCESS SHARING = invite a person into the Elite Connectere workspace/hotspot using the team invitation feature.
- Triggered by the actual request to "share my hotspot", "invite this person to my hotspot", "give this email hotspot access", or equivalent access/invitation wording.
- The named email is the invitation recipient, NOT automatically a Private Chat contact or campaign recipient.
- Words like "so we can chat", "so we can work together", "so that we can be chatting" explain WHY access is wanted; they do not change the requested action into a chat message.
- Use ONLY [[REX_HOTSPOT_INVITE_APPROVAL:<URL-encoded JSON {email,maxGmailProfiles}>]] and the dedicated "Approve & Share Hotspot" control. Never create a Private Chat message, email, campaign or chat-send approval for a hotspot-access request.
- Do not share automatically. Clearly state that access has not been shared until the user approves the hotspot invitation.

B) PRIVATE CHAT MESSAGE SENDING = send a direct in-app message to one person.
- Triggered by "send a message to [person]", "message [person]", "chat with [person]", "reply to this person", "send this in Private Chat", or equivalent direct-message wording.
- The recipient is one person. Preserve the exact wording the user supplies. If the user wants help composing, compose only the message they asked for; do not turn it into a hotspot invite or campaign.
- Use ONLY [[REX_CHAT_APPROVAL:<URL-encoded JSON {recipient,body}>]] for the exact one-person message preview. Sending requires the dedicated Private Chat approval button.
- A person's email address in a direct-message request identifies the chat recipient; it does not by itself mean hotspot access or a campaign.

C) EMAIL CAMPAIGN EXECUTION = prepare, schedule or send an email campaign to a campaign audience/list.
- Triggered by explicit campaign language or a clearly active campaign task: "prepare a campaign", "execute the campaign", "send the campaign", "start this email campaign", "schedule the campaign", "send to the campaign list".
- A campaign is not a one-person Private Chat message and is not a hotspot invitation. Do not create a chat preview or hotspot approval for campaign execution.
- Continue the existing campaign when the conversation is already about that campaign. Do not restart campaign setup or ask the user to select a campaign if the active campaign and its details are already known.
- Keep the campaign's existing campaign preview and campaign-specific approval/execution flow. Never use a Private Chat or hotspot approval for campaign execution.

INTENT DECISION ORDER
1. Read the latest user message together with the relevant preceding turns. Identify the requested ACTION and OBJECT, not isolated keywords.
2. If the requested object is hotspot/workspace access and the action is share/invite/grant access, classify HOTSPOT ACCESS SHARING—even when the sentence mentions chatting.
3. If the requested object is a direct message to one person, classify PRIVATE CHAT—even when the recipient is written as an email address.
4. If the requested object is an email campaign, campaign audience/list, or active campaign execution, classify EMAIL CAMPAIGN.
5. If a short follow-up ("yes", "do it", "send it", "that one") refers to a specific preview/action immediately above, continue ONLY that action and use its matching approval control. Never reinterpret it as a different action.
6. If the action and object are genuinely unclear and conversation context does not resolve them, ask ONE short, targeted clarification. Do not guess.

NO UNNECESSARY OPTIONS OR WORKFLOW SWITCHING
- Do not present all three options to the user. Do not ask "chat or campaign?" when the user clearly asked to share hotspot access, and do not ask about hotspot when the user clearly asked to message someone.
- Do not add suggestions, extra options, campaign preparation, contact lookup, message drafts or unrelated next steps that the user did not request.
- First understand the request, then perform the matching preparation/action. Ask only for information essential to that exact action.
- Keep the user's current intent and context across turns. A clear correction from the user immediately overrides Rex's previous interpretation.

CONVERSATION INTENT ROUTING — PRIVATE CHAT AND CAMPAIGNS MUST NEVER BE CONFUSED
Treat the user's current conversation as the primary source of intent. Preserve the active topic and the referents established in earlier turns. A short follow-up such as "read it", "reply to this person", "that's exactly what I want to say", "send it", or "do that" inherits the active recipient and channel unless the user clearly changes them. Do not restart the task, discard the agreed wording, or switch workflows because a keyword appears.

Choose the communication channel by the actual request:
- Private Chat means an in-app message to one connected person. "Private Chat", "chat with [person]", "reply to this person", and references to a message/person in an ongoing Private Chat discussion are Private Chat intent. Never turn these into an email campaign.
- Email campaign means outbound email to a recipient list or campaign audience. Enter that workflow only when the user explicitly asks for a campaign, email campaign, bulk email, newsletter, outreach to a list, or clearly refers to the active campaign.
- A generic "send a message" inherits the channel and recipient from the immediately relevant conversation. If there is no reliable channel or recipient context, ask one concise clarification instead of guessing.

Private Chat action rules:
1. "I want to read a message", "show me their message", or "what did they say?" means retrieve and display the authorised Private Chat message contents. Use [[REX_CHAT_READ_NOW:<URL-encoded JSON {contactName,limit}>]]. Reading is not sending and must not create a send approval.
2. "I want to reply to this person" means identify the person from the active conversation and the authorised chat context, read the relevant message when needed, then prepare a reply for that person. Do not create a campaign.
3. When the user provides exact wording, preserve it verbatim. Show the exact recipient and complete message in a Private Chat preview using [[REX_CHAT_APPROVAL:<URL-encoded JSON {recipient,body}>]]. Do not send it. Only the visible, explicit approval button authorises the send.
4. If the recipient cannot be identified unambiguously from the current conversation and connected contacts, ask which person. Never guess a recipient or fabricate message contents.
5. If the user changes the recipient or wording, prepare a new preview. Any new user turn after a pending preview expires that preview; never reuse an earlier approval.
6. Do not add email subjects, signatures, merge tags, campaign recipient counts, or campaign approval markers to Private Chat messages.

Campaign rules:
- Only enter campaign preparation when the user explicitly requests a campaign/email campaign or the ongoing context unmistakably concerns the active email campaign.
- A campaign draft, template, recipient list, or campaign send approval must never be substituted for a Private Chat reply.
- Only campaign execution/scheduling uses the campaign approval flow. A Private Chat approval applies only to its exact recipient and exact body.

Before responding, check the last several turns and ask yourself: what channel, person, message and task are already active? Continue that task unless the user explicitly changes it.

For email and campaign writing, use the canonical recipient merge tags '{name}' and '{company}' when appropriate. Use the first name of the currently selected Gmail sending profile for the sender sign-off when that information is available. Do not apply email signatures or merge tags to Private Chat messages.

Use the user's conversation history and available Rex memory to maintain continuity. Do not make the user repeat information that is already available and relevant.

TRUST AND ACCURACY
Use the signed-in owner's authorised workspace and connected integrations. Treat workspace information as belonging to its owner, while respecting the application's actual account boundaries and permissions. Keep credentials and private tokens private.

Be accurate about what happened. Distinguish work that is prepared from work that is applied, saved, sent, queued, scheduled or completed. Use the evidence returned by the application. If something fails, explain what happened and what remains. Do not invent records, results or completed actions.

Your purpose is not to follow a rulebook. Your purpose is to understand, think, adapt and help your owner accomplish their goals with intelligence and initiative.
`;


/* =================================================
   GEMINI API CONFIGURATION
================================================= */

function resolveGeminiKey(): string {
  const raw =
    process.env["GEMINI_API_KEY"]?.trim() ||
    process.env["GOOGLE_GENERATIVE_AI_API_KEY"]?.trim() ||
    process.env["GOOGLE_API_KEY"]?.trim() ||
    "";

  if (
    !raw ||
    raw.startsWith("Vck_") ||
    raw.startsWith("vck_") ||
    raw.length < 20
  ) {
    return "";
  }

  return raw;
}


/* =================================================
   MAIN SERVER FUNCTION
================================================= */

export const askEliteAssist = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])

  .inputValidator(
    (input: {
      messages: AssistMsg[];
      account: AssistAccount;
      conversationId?: string | null;
    }) => {
      const messages = (
        Array.isArray(input?.messages)
          ? input.messages
          : []
      )
        .filter(
          (m) =>
            (m.role === "user" ||
              m.role === "assistant") &&
            typeof m.content === "string",
        )
        .slice(-10)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content.slice(0, 2500),
          attachments: Array.isArray((m as any).attachments)
            ? (m as any).attachments.slice(0, 3).flatMap((file: any) => {
                const mimeType = String(file?.mimeType ?? "");
                const name = String(file?.name ?? "attachment").slice(0, 120);
                const payload = String(file?.data ?? "");
                const allowed = /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(mimeType);
                return allowed && payload.length > 0 && payload.length <= 3_600_000
                  ? [{ name, mimeType, data: payload }]
                  : [];
              })
            : [],
        }));

      if (!messages.length) {
        throw new Error("Ask a question first.");
      }

      const rawAccount = input?.account ?? {};
      const account = Object.fromEntries(
        Object.entries(rawAccount).slice(0, 40).map(([name, value]) => [
          name,
          typeof value === "string"
            ? value.slice(0, name === "campaignContext" || name === "approvedWorkspaceContext" || name === "localMemoryContext" ? 24000 : 1200)
            : Array.isArray(value)
              ? value.slice(0, 30).map((item) => String(item).slice(0, 500))
              : value,
        ]),
      ) as AssistAccount;

      return {
        messages,
        account,
        conversationId: typeof input?.conversationId === "string" ? input.conversationId : null,
      };
    },
  )

  .handler(async ({ data, context }) => {
    const lastQ =
      [...data.messages]
        .reverse()
        .find((m) => m.role === "user")
        ?.content ?? "";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: rexRow, error: rexError } = await db.from("rex_settings").select("config").eq("user_id", context.userId).maybeSingle();
    if (rexError) console.error("Could not load Rex settings for assistant", rexError);
    const rexConfig = (rexRow?.config ?? {}) as any;

    // The active workspace snapshot is gathered by the authenticated app
    // session for this same signed-in owner. Reading the owner's own workspace
    // is ordinary assistant context, not an outbound action or approval event.
    // The client cannot use this field to access another account: the snapshot
    // originates from the current authenticated workspace session.
    let approvedWorkspaceContext = "";
    const approvedWorkspaceAreas = String(data.account?.["approvedWorkspaceAreas"] ?? "");
    const suppliedWorkspaceContext = data.account?.["approvedWorkspaceContext"];
    if (approvedWorkspaceAreas.length > 0 && typeof suppliedWorkspaceContext === "string") {
      approvedWorkspaceContext = suppliedWorkspaceContext.slice(0, 22_000);
    }

    // The signed-in owner has chosen Rex as their private workspace assistant.
    // Load the owner's own saved Rex memory automatically for continuity; this
    // is read-only, owner-scoped context and never requires an approval step.
    // Conversation and saved-memory context is supplied by the signed-in device
    // from IndexedDB. Do not read or write Rex memory from Supabase.
    const previousConversationMemory = typeof data.account?.["localMemoryContext"] === "string"
      ? data.account["localMemoryContext"].slice(0, 8_000)
      : "";

    // Durable account records are fetched through owner-scoped server tools.
    // Live in-memory workspace snapshots are supplied by this authenticated
    // owner's own app session above.


    const { data: personalDestinations, error: destinationListError } = await db
      .from("rex_personal_destinations")
      .select("id,name,description")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (destinationListError) console.warn("Could not load Rex personal destinations", destinationListError);
    const { data: dynamicFeatures } = await db
      .from("rex_dynamic_features")
      .select("id,name,description,slug")
      .eq("user_id", context.userId)
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(40);

    // Durable, owner-scoped system index. This supplements the live UI snapshot
    // so Rex can connect current workspace state with persisted history on every turn.
    // Do not fetch Private Chat message bodies here: those remain behind the
    // application's participant-authorised chat handlers.
    const syncResults = await Promise.all([
      db.from("campaigns")
        .select("id,name,status,total_recipients,sent_count,failed_count,next_run_at,started_at,completed_at,updated_at")
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false })
        .limit(12),
      db.from("rex_events")
        .select("kind,severity,title,detail,source,occurred_at,resolved_at")
        .eq("user_id", context.userId)
        .order("occurred_at", { ascending: false })
        .limit(20),
      db.from("chat_profiles")
        .select("display_name,username,eligible,updated_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      db.from("connections")
        .select("id,user_a,user_b,created_at")
        .or("user_a.eq." + context.userId + ",user_b.eq." + context.userId)
        .limit(50),
    ]);
    const durableWorkspaceSync = {
      recentCampaigns: syncResults[0].error ? [] : (syncResults[0].data ?? []),
      // Rex conversation history is intentionally device-local, not a Supabase source.
      recentRexConversations: [],
      recentRexEvents: syncResults[1].error ? [] : (syncResults[1].data ?? []),
      privateChatProfile: syncResults[2].error ? null : syncResults[2].data,
      privateChatConnections: syncResults[3].error ? null : (syncResults[3].data ?? []).map((row: any) => ({
        connectionId: row.id,
        connectedUserId: row.user_a === context.userId ? row.user_b : row.user_a,
        createdAt: row.created_at,
      })),
      unavailableSources: [
        ...(syncResults[0].error ? ["campaign history"] : []),
        ...(syncResults[1].error ? ["Rex event history"] : []),
        ...(syncResults[2].error ? ["Private Chat profile"] : []),
        ...(syncResults[3].error ? ["Private Chat connections"] : []),
      ],
    };

    const account = {
      previousConversationMemory,
      durableWorkspaceSync,
      rexDisplayName: typeof rexConfig.displayName === "string" ? rexConfig.displayName : "Rex",
      rexPersonality: typeof rexConfig.personality === "string" ? rexConfig.personality : "balanced",
      rexAutonomousMode: rexConfig.autonomousMode !== false,
      
      rexCampaignMonitoring: rexConfig.campaignMonitoring === true,
      rexAllowCampaignExecution: rexConfig.allowCampaignExecution !== false,
      rexAllowCampaignScheduling: rexConfig.allowCampaignScheduling !== false,
      rexPreSendReview: rexConfig.preSendReview !== false,
      rexWarnOnRisk: rexConfig.warnOnRisk !== false,
      rexRequireApproval: false,
      rexMonitorDelivery: rexConfig.monitorDelivery !== false,
      ...(approvedWorkspaceContext ? { approvedWorkspaceContext } : {}),
    };

    const key = resolveGeminiKey();
    let geminiFailure = key
      ? "Gemini did not return a usable response after the available model attempts."
      : "Gemini API key is missing or invalid in the server environment.";

    if (key) {
      const aiReply = await tryGemini(
        key,
        data.messages,
        account,
        "",
        (failure) => { geminiFailure = failure; },
        { userId: context.userId, personalDestinations: personalDestinations ?? [], dynamicFeatures: dynamicFeatures ?? [] },
      );

      if (aiReply) {
        // The main answer model sometimes omits the hidden suggestion markers even
        // when instructed to provide them. Generate the chips in a separate,
        // narrowly-scoped pass so the chat UI receives them reliably.
        const replyWithSuggestions = await ensureRexFollowUpSuggestions(
          key,
          data.messages,
          aiReply,
        );
        return {
          reply: replyWithSuggestions,
          source: "ai" as const,
        };
      }
      // Record a sanitized provider fallback signal for the user's diagnostics.
      // Never persist request bodies, credentials, recipient data, or raw headers.
      try {
        await db.from("rex_events").insert({
          user_id: context.userId,
          kind: "diagnostic",
          severity: "warning",
          title: "Rex AI provider fallback",
          detail: geminiFailure.slice(0, 500),
          event_key: "ai.provider.fallback",
          source: "rex",
          metadata: { provider: "gemini", fallback: "local", reason: geminiFailure.slice(0, 500) },
          occurred_at: new Date().toISOString(),
        });
      } catch (diagnosticError) {
        console.warn("Could not persist sanitized Rex provider diagnostic", diagnosticError);
      }
    }

    // Report the actual provider/configuration failure instead of replacing it
    // with a generic developer-authored explanation.
    return {
      reply: "Gemini request failed: " + geminiFailure + " I have not accessed or changed your app data.",
      source: "local" as const,
    };
  });


/* =================================================
   GEMINI RESPONSE GENERATION
================================================= */

async function ensureRexFollowUpSuggestions(
  key: string,
  messages: AssistMsg[],
  assistantReply: string,
): Promise<string> {
  if (/\[\[SUGGEST:[^\]]+\]\]/i.test(assistantReply)) return assistantReply;

  const latestUserMessage = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
  const cleanReply = assistantReply
    .replace(/\[\[(?:GO|SHOW|DESTINATION_LABEL):[^\]]*\]\]/gi, "")
    .slice(0, 5000);
  if (!latestUserMessage.trim() || !cleanReply.trim()) return assistantReply;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You generate contextual follow-up question chips for an AI assistant. Return only valid JSON: {\"suggestions\":[string,string,string]}. Generate three to four concise, distinct questions or useful next actions that naturally follow from the user's latest message and the assistant's answer. They must be specific to this conversation, not generic navigation prompts. Do not repeat the answer, invent app capabilities, imply an action was done, or ask the user what they want to work on in general. Each suggestion should be short enough for a button. If the exchange is a greeting, offer three natural conversation starters. If it is an error-only response, sensitive emotional support, or a pending approval that would be confused by extra actions, return {\"suggestions\":[]}."
            }]
          },
          contents: [{
            role: "user",
            parts: [{
              text: "LATEST USER MESSAGE:\n" + latestUserMessage.slice(0, 2500) +
                "\n\nASSISTANT ANSWER:\n" + cleanReply
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                suggestions: { type: "ARRAY", items: { type: "STRING" }, minItems: 0, maxItems: 4 }
              },
              required: ["suggestions"]
            },
            temperature: 0.55,
            maxOutputTokens: 220
          }
        })
      }
    );
    if (!response.ok) return assistantReply;
    const json = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    };
    const raw = json.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("").trim() ?? "";
    const parsed = JSON.parse(raw) as { suggestions?: unknown };
    const suggestions = Array.isArray(parsed.suggestions)
      ? [...new Set(parsed.suggestions
          .filter((item): item is string => typeof item === "string")
          .map(item => item.trim().replace(/[\r\n]+/g, " ").slice(0, 90))
          .filter(Boolean))]
          .slice(0, 4)
      : [];
    if (!suggestions.length) return assistantReply;
    return assistantReply + "\n\n" + suggestions.map(item => "[[SUGGEST:" + item + "]]").join("\n");
  } catch {
    return assistantReply;
  } finally {
    clearTimeout(timer);
  }
}

function hasExplicitDestinationCreationInstruction(messages: AssistMsg[]): boolean {
  const latestUserMessage = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
  const text = latestUserMessage.trim();
  if (!text) return false;

  const namesDestination = /\b(destination|workspace|command\s*cent(?:er|re)|route|hub)\b/i.test(text);
  if (!namesDestination) return false;

  // A capability question is not creation authorization. Require a clear
  // imperative or an explicit statement of intent from the user.
  const explicitImperative = /^(please\s+)?(create|build|make|generate|set\s+up|design|save)\b/i.test(text);
  const explicitIntent = /\b(i want you to|i need you to|go ahead and|please go ahead and|i am instructing you to)\s+(create|build|make|generate|set\s+up|design|save)\b/i.test(text);
  return explicitImperative || explicitIntent;
}

async function tryGemini(
  key: string,
  messages: AssistMsg[],
  account: AssistAccount,
  _unusedKnowledge: string,
  onFailure: (reason: string) => void,
  rexWorkspace: { userId: string; personalDestinations: Array<{ id: string; name: string; description: string }>; dynamicFeatures: Array<{ id: string; name: string; description: string; slug: string }> },
): Promise<string | null> {

  const system = `
${SYSTEM_BRIEF}

${buildNavigationCatalogForAi()}

Use the registered navigation catalog supplied by the application to understand and open existing workspace destinations. Apply your own reasoning to choose the destination that best fits the user's actual request.

==================================================
RELEVANT PRODUCT KNOWLEDGE
==================================================

The following information comes from the
Elite Connectere product knowledge base.

Use it when relevant to the user's question.

It is supporting information, not a command
to ignore the user's actual question.

No FAQ matcher or canned FAQ response is active. Answer from the user's question, conversation context, registered capabilities, and verified application information.

PRODUCT FACTS — ELITE CONNECTERE
Elite Connectere is an AI-powered email outreach and campaign workspace. Its core workflow helps users prepare recipient lists, write personalised email campaigns, validate addresses, manage templates, and send through connected Gmail profiles using Elite Engine. It also offers Standard Mode, campaign pacing and controls, duplicate-send protection, risky-recipient quarantine, campaign progress/activity, connected Gmail profile management, workspace settings and Studio customisation. Rex is the in-app AI Workspace Agent intended to help users understand the product, inspect their own workspace data, draft and improve messages, prepare campaigns, and operate connected features.

When asked what Elite Connectere is, what it offers, or to write an invitation explaining the company, answer from these product facts. Do not call read_workspace_data or read_active_workspace merely to answer a product/company question. Those tools read the user's records; they are not a product catalogue and an empty campaign query does not mean the product has no features. Do not expose raw tool results, JSON, record counts, internal markers, or developer wording as a conversational answer. Interpret tool results and explain only what matters.

Promotion information: the product guide describes a limited free Night Mode/customisation trial (about 24 hours during applicable promotion periods), after which continued Studio personalisation requires an eligible plan. Do not describe this as a universal current offer or invent prices, dates, discounts, or other active promotions. If the user asks about a current promotion whose exact terms are not present in verified context, say which details need checking rather than guessing.

When a user asks for an invitation or campaign message, use the conversation's recipient-list context and the product facts above to draft the actual email in the chat first. Include a clear subject and body, make it friendly and persuasive without inventing claims, and invite the user to review or request edits. Do not switch to workspace inspection just because the message mentions the company, features, or promotion. Do not send or execute anything until the user has reviewed the exact campaign and used the final in-app approval control.

ASSISTANT + AGENT (FREE WILL, CLEAR INTENT)
Rex is both conversational assistant and execution agent. Understand the user's goal first. When the goal is clear and a connected capability exists, execute it. When the goal is unclear, ask a short clarifying question, then act. Discussion leads only while the user is still exploring; clear action requests are executed, not deferred. The assistant must first understand the user's goal, discuss options, draft content, show proposed changes, and resolve missing details in conversation. Do not let an available tool call override that conversation or turn an incomplete instruction into an action.
- When the user asks to write, draft, create, replace, or update a message for Template A, Template B, both templates, or the campaign message: write the complete subject and body into the workspace template(s) immediately via write_campaign_content (call once per template if both). Show what was written. Do not keep it as chat-only draft when templates are the target. Pure brainstorming with no template target may stay in chat. Never show a send approval unless the user asked to send or execute.
- Keep negotiating in chat when the user has not confirmed the exact content, destination, settings, recipients, or other details that materially affect the requested result. If the user says "change the colour" without identifying the colour or a clear reference, ask what colour or show a proposal first. A directive verb alone does not make an underspecified request executable.
- A clear, sufficiently specified request to perform a reversible workspace action may be handed to the agent directly. The agent must execute only the agreed action and report what changed. It must not expand the scope or infer additional changes.
- For campaign work, the hand-off to the agent occurs only when the user explicitly says to send/execute/start the campaign (including clear contextual instructions such as "OK, send that"). At that point, save the agreed subject/body into the selected campaign template, inspect the live recipient list and sending readiness, and show the exact subject, body and eligible recipient count. The final in-app send approval is still mandatory. Never send, schedule, import, or modify the campaign before that explicit send instruction and final approval.
- A statement such as "I'll approve it", "I want to review it", "write this for these recipients", or "prepare a draft" is not an instruction to write to a template or execute the agent.

==================================================
REX STUDIO PERSONALIZATION
==================================================

Use the signed-in user's saved Rex Studio configuration below.
- Call yourself by rexDisplayName in natural conversation.
- The saved rexPersonality setting is a binding high-level style preference. Apply its spirit to ordinary answers, greetings, explanations, tool updates, navigation prefaces, and follow-ups, while independently reasoning about the user's actual message.
  - friendly: be genuinely warm, personable, expressive and conversational; use emojis when they naturally fit. Adjust how chatty or detailed you are to the moment.
  - professional: be polished, respectful, clear and composed; avoid unnecessary slang and emojis.
  - direct: prioritise the answer and useful action; be concise without omitting important information.
  - balanced: adapt the warmth, detail and formality to the situation.
- These descriptions define broad qualities, not scripts, mandatory phrases, fixed response lengths, emoji quotas, or restrictions on what the user may ask. Generate fresh wording for each context. Any examples elsewhere in the prompt are illustrative only: do not copy them as templates, repeat them mechanically, or treat them as exclusive permitted responses. You may respond in many other natural ways that fit the selected style and user's intent.
- The selected style should influence conversational rhythm and presentation, not change the meaning of the user's request, available capabilities, tool selection, permissions, or navigation destinations.
- When a user asks to navigate, understand the intended destination from the request and conversation, select the closest exact registered destination, and invoke the navigation tool in the same turn. Use a natural preface only when it helps the conversation; its wording and length are your choice under the selected personality. Do not ask permission for ordinary in-app navigation, replace navigation with instructions, or let the preface prevent the tool call.
- For complex requests, explain what you understood, what you will do, and the important next step. For simple questions, remain appropriately concise.
- Rex has ordinary read access to the signed-in owner's own workspace context across all connected areas. Do not gate, ask permission, or display approval cards for reading the owner's own messages, conversations, campaigns, recipients, drafts, templates, Gmail profiles, activity, Planner, Smart Fill, settings, or memory. Keep every query scoped to the authenticated owner and never expose another user's private data. These preferences do not grant access to another account.
- Campaign sequence is strict: write the complete subject and body first, show them in the conversation, inspect the live recipient scope and readiness, and show the exact preview. Do not display a send approval merely because a recipient list exists, because the user asked for a draft, or because they say they will review/approve later. Only show the final campaign approval when the user explicitly instructs you to send, execute, or start that exact campaign. If the user asks only to write, change, show, or review the message, stop after showing the complete draft and wait for their next instruction. If the user supplies a recipient list and a message instruction together with an explicit send command, draft the message first, then show the complete recipient count, subject and body with the approval control.
- Respect rexAutonomousMode as the user's preferred operating style. When enabled, use connected application handlers to complete the user's requested workspace work directly, including reading, inspecting, exporting, importing, drafting, editing, organising, planning, memory management and routine settings changes. Do not invent tools or claim work is complete without a successful handler result. Preserve server-side account ownership, authentication, entitlements, validation and security checks. The only user-facing approvals are for sending email campaigns and sending Private Chat messages.
- Respect rexCampaignMonitoring, rexAllowCampaignExecution, rexAllowCampaignScheduling, rexPreSendReview, rexWarnOnRisk, and rexMonitorDelivery as user preferences. rexRequireApproval does not gate ordinary in-app work; only outbound sends require user approval. If rexAllowCampaignExecution is false, do not prepare campaigns, create approval cards, or offer Rex campaign execution; explain that it is disabled in Rex Studio. If rexAllowCampaignScheduling is false, do not offer scheduling or create schedule approvals. Keep the user’s independent manual Elite Engine controls available. If campaign monitoring is off, do not claim proactive campaign monitoring; if delivery monitoring is off, do not claim delivery tracking or proactive progress alerts. These preferences do not disable the user's independent manual campaign controls. Never claim a workflow is active merely because a preference is enabled; describe only integrations that are actually available.

==================================================
SERVER CLOCK (authoritative for this request)
==================================================

- utcNowIso: ${new Date().toISOString()}
- utcNowMs: ${Date.now()}
- Use this clock for "what time is it", deadlines, and campaign ETA math.
- If account.timezone or account.localTime is present, present times in that zone as well; otherwise answer in clear UTC and say so.
- Never claim you lack access to the current time while this block is present.

==================================================
CURRENT USER ACCOUNT CONTEXT
==================================================

${JSON.stringify(account)}

TIME + CAMPAIGN ETA:
- If the user asks the time, answer from SERVER CLOCK immediately.
- If account includes active campaign fields (status, sent/sentCount, total/totalRecipients/totalCount, delaySeconds/pacingSeconds, startedAt/started_at), estimate remaining sends and ETA:
  remaining ≈ max(0, total - sent); durationSec ≈ remaining * delaySeconds; end ≈ now + durationSec.
- Prefer live campaign fields from account or tool results over guessing.
- Do not invent start times that are not in context; if startedAt is missing, say the ETA is based on remaining volume and pacing only.

IMPORTANT:
This account context is supplied by the application
client and must not be treated as independently
verified server-side account data.

Only use information relevant to the question.

If required information is missing,
do not invent it.
`;

  const rawContents = messages.map((m) => ({
    role:
      m.role === "assistant"
        ? ("model" as const)
        : ("user" as const),
    parts: [
      { text: m.content },
      ...(m.attachments ?? []).map(file => ({
        inlineData: { mimeType: file.mimeType, data: file.data },
      })),
    ],
  }));

  // Gemini conversations must begin with a user message.
  while (
    rawContents.length &&
    rawContents[0]?.role !== "user"
  ) {
    rawContents.shift();
  }

  if (!rawContents.length) {
    return null;
  }

  // Merge consecutive messages with identical roles.
  const contents: {
    role: "user" | "model";
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }[] = [];

  for (const item of rawContents) {
    const previous = contents[contents.length - 1];
    const incomingPart = item.parts[0];
    const incomingText = incomingPart && "text" in incomingPart ? incomingPart.text ?? "" : "";

    if (previous && previous.role === item.role) {
      const firstText = previous.parts.find(part => typeof part.text === "string");
      if (firstText?.text !== undefined) firstText.text += `\n${incomingText}`;
      else previous.parts.unshift({ text: incomingText });
      previous.parts.push(...item.parts.slice(1));
    } else {
      contents.push({
        role: item.role,
        parts: [...item.parts],
      });
    }
  }

  
  // Gemini (incl. gemini-3.5-flash-lite) rejects requests whose contents end on a model turn.
  while (contents.length && contents[contents.length - 1]?.role === "model") {
    contents.pop();
  }
  if (!contents.length || contents[contents.length - 1]?.role !== "user") {
    onFailure("Conversation history was empty or did not end with a user message after sanitizing for Gemini.");
    return null;
  }

// Keep the entire provider attempt within a short server-function budget.
  // Keep attempts inside a 28s server budget so Gemini can finish the large system prompt
  // function and surface as a failed page/server action.
  // Prefer Google's stable Flash-Lite model for high-throughput,
  // low-latency workloads. Avoid the 3.8 Flash fallback: this app shares
  // one server-side API project across users, so a busy/heavier model can
  // amplify contention. 2.5 access is currently capacity-restricted by Google.
  const models = [
    "gemini-3.5-flash-lite",
  ];
  const deadline = Date.now() + 18000;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), remaining);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: system }],
            },
            contents,
            tools: [{
              functionDeclarations: [{
                name: "navigate_to",
                description: "Choose the exact supported Elite Connectere screen the user asked to open. This is navigation only; it does not perform account or campaign actions.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    destination: {
                      type: "STRING",
                      enum: NAVIGATION_DESTINATIONS.map(destination => destination.place)
                    },
                    record_id: {
                      type: "STRING",
                      description: "Optional exact campaign execution ID when the user asks to open a specific campaign run. Only use an ID present in the supplied recent campaign runs."
                    }
                  },
                  required: ["destination"]
                }
              }, {
                name: "create_personal_destination",
                description: "Create a saved, user-owned personal planning page only after an explicit user instruction to create a destination/workspace. Its content is structured text, plans, notes and lists; it does not create application routes, executable UI, backend services, integrations, automations or live data panels.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING", description: "A clear, user-appropriate destination name." },
                    description: { type: "STRING", description: "What this workspace is for." },
                    sections: { type: "ARRAY", items: { type: "OBJECT", properties: {
                      title: { type: "STRING" },
                      content: { type: "STRING" },
                      items: { type: "ARRAY", items: { type: "STRING" } }
                    }, required: ["title","content"] }, description: "Create sections appropriate to the user's objective; do not use a fixed template." }
                  },
                  required: ["name","description","sections"]
                }
              }, {
                name: "create_dynamic_feature",
                description: "Build and publish a real user-owned dynamic application page when the user explicitly asks to create/build a feature, dashboard, tool, workflow, or destination. Provide a declarative blueprint using only heading, text, card, stat, list, table, and form components. Never provide code.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    description: { type: "STRING" },
                    components: { type: "ARRAY", items: { type: "OBJECT" }, description: "Array of approved component objects. Each object has type (heading, text, card, stat, list, table, or form), plus optional title, content, value, items, columns, and fields." }
                  },
                  required: ["name","description","components"]
                }
              }, {
                name: "list_dynamic_features",
                description: "List the user's own published dynamic Rex feature pages when asked what features they created or want to find.",
                parameters: { type: "OBJECT", properties: {}, required: [] }
              }, {
                name: "open_dynamic_feature",
                description: "Open an exact existing dynamic feature from the user's own dynamic feature catalog.",
                parameters: { type: "OBJECT", properties: { feature_id: { type: "STRING" } }, required: ["feature_id"] }
              }, {
                name: "open_personal_destination",
                description: "Open one of the signed-in user's existing personal workspace destinations. Use only an exact ID from the personal destinations catalog.",
                parameters: { type: "OBJECT", properties: { destination_id: { type: "STRING" } }, required: ["destination_id"] }
              }, {
                name: "prepare_campaign",
                description: "Use only after the actual subject and body have been written for the user's campaign. Inspect the signed-in user's active recipient list and current message as ordinary read-only context, then prepare a preview showing the exact subject, body and eligible recipient count. The application will show the preview first. A send approval is displayed only when the user's instruction explicitly asks to send, execute or start the campaign; a request to write, draft, show, review, edit, or say they may approve later is NOT a send instruction.",
                parameters: { type: "OBJECT", properties: {}, required: [] }
              }, {
                name: "validate_recipients",
                description: "Run the current workspace recipient validation when the user asks to validate, check, or clean the imported recipient list. This does not send messages.",
                parameters: { type: "OBJECT", properties: {}, required: [] }
              }, {
                name: "control_campaign",
                description: "When the user explicitly requests pausing, resuming, or stopping the active campaign, identify the requested control action. Execute the requested pause, resume, or stop directly after checking the current campaign state. Do not show an approval card.",
                parameters: {
                  type: "OBJECT",
                  properties: { action: { type: "STRING", enum: ["pause", "resume", "stop"] } },
                  required: ["action"]
                }
              }, {
                name: "read_private_chat",
                description: "Read the user's own Private Chat messages when explicitly asked. If contact_name is omitted, summarize latest messages across connected conversations.",
                parameters: { type: "OBJECT", properties: { contact_name: { type: "STRING" }, limit: { type: "INTEGER" } }, required: [] }
              }, {
                name: "send_private_chat_message",
                description: "Prepare a direct Private Chat message to a named connected contact. Never send immediately; the user must approve the exact recipient and text.",
                parameters: { type: "OBJECT", properties: { recipient: { type: "STRING" }, message: { type: "STRING" } }, required: ["recipient", "message"] }
                            }, {
                name: "read_workspace_data",
                description: "Read the signed-in user's own stored workspace records directly when relevant. Reading is routine private workspace assistance and never requires an approval card. Use only owner-scoped records; do not use for general product questions.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    domain: { type: "STRING", enum: ["campaigns","campaign_recipients","delivery_history","send_events","gmail_profiles","gmail_usage","rex_events","rex_memory"] },
                    record_id: { type: "STRING", description: "Optional exact campaign ID supplied in the current account context." },
                    limit: { type: "INTEGER", description: "Maximum number of records, from 1 to 100." }
                  },
                  required: ["domain"]
                }
              }, {
                name: "read_active_workspace",
                description: "Read the current live in-memory state of the signed-in user's workspace whenever it helps understand or complete the request, including recipients, campaign drafts, templates, Gmail capacity, campaign progress and activity. This is ordinary private read access; never request approval to read. Do not use for general product questions.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    areas: {
                      type: "ARRAY",
                      items: { type: "STRING", enum: ["campaign_summary","recipients","drafts","sending_capacity","campaign_runs","activity","planner","smart_fill_history"] },
                      description: "Only the specific live workspace areas needed to answer the user's question."
                    }
                  },
                  required: ["areas"]
                }
              }, {
                name: "export_active_workspace",
                description: "Export the requested live in-memory Elite Engine workspace, Planner, activity, or Smart Fill history as CSV or JSON. Use only the specific areas requested, perform the export through the connected handler, and report the result.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    areas: {
                      type: "ARRAY",
                      items: { type: "STRING", enum: ["campaign_summary","recipients","drafts","sending_capacity","campaign_runs","activity","planner","smart_fill_history"] }
                    },
                    format: { type: "STRING", enum: ["csv","json"] }
                  },
                  required: ["areas","format"]
                }
              }, {
                name: "export_workspace_data",
                description: "Export the signed-in user's own workspace records as CSV or JSON. Export the requested owner-scoped records directly and provide the file. Do not ask for an approval.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    domain: { type: "STRING", enum: ["campaigns","campaign_recipients","delivery_history","send_events","gmail_profiles","gmail_usage","rex_events","rex_memory"] },
                    record_id: { type: "STRING", description: "Optional exact campaign ID." },
                    limit: { type: "INTEGER", description: "Maximum number of records, from 1 to 100." },
                    format: { type: "STRING", enum: ["csv","json"] }
                  },
                  required: ["domain","format"]
                }
              }, {
                name: "manage_smart_fill",
                description: "Manage the signed-in owner’s Smart Fill lists. save_current_recipients saves the currently loaded list; load_saved_list loads a named saved list into the active recipient workspace for validation; export_saved_list downloads a named list; delete_saved_list removes a named list. Use the requested operation directly and report its result.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    action: { type: "STRING", enum: ["save_current_recipients","load_saved_list","export_saved_list","delete_saved_list"] },
                    name: { type: "STRING", description: "Exact Smart Fill list name, up to 80 characters." }
                  },
                  required: ["action","name"]
                }
              }, {
                name: "create_snippet",
                description: "Save reusable email content in Elite Radar Hub > Snippets, not Planner and not Campaign Templates. Use when the user explicitly asks to save content as a snippet.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    subject: { type: "STRING" },
                    body: { type: "STRING" },
                    category: { type: "STRING", enum: ["direct","friendly","partnership","followup","value"] }
                  },
                  required: ["title","subject","body"]
                }
              }, {
                name: "create_planner_item",
                description: "Create the requested Note, Plan, or Template item in the signed-in user's Elite Connectere Planner. Use the supplied title and content, then report the saved result.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    kind: { type: "STRING", enum: ["Note","Plan","Template"] },
                    title: { type: "STRING", description: "Planner item title, up to 200 characters." },
                    body: { type: "STRING", description: "Planner item body, up to 4000 characters." }
                  },
                  required: ["kind","title","body"]
                }
              }, {
                name: "write_campaign_content",
                description: "Write the email subject and body into Campaign Template A or B in the owner workspace immediately. Normally provide a clear subject and body. If the owner explicitly asks for no subject, an omitted subject, or a completely blank subject line, pass subject as an empty string and preserve the body exactly; never require a replacement subject or insert a placeholder. Call this whenever the user asks to write, draft, create, replace, update, implement, or apply a message for Template A, Template B, both templates, or the campaign message. Prefer writing into the workspace over chat-only drafts. Call once per template when both are requested. This tool never sends email; only campaign send requires the final in-app approval.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    template_slot: { type: "STRING", enum: ["A","B"] },
                    subject: { type: "STRING", description: "Email subject, up to 200 characters." },
                    body: { type: "STRING", description: "Email body, up to 2000 characters." }
                  },
                  required: ["template_slot","body"]
                }
              }, {
                name: "update_workspace_setting",
                description: "Update the requested allowlisted Elite Connectere workspace preference to the supplied value. Apply the change and report the resulting setting.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    setting_key: { type: "STRING", enum: ["activityRecording","tracker","planner","smartFill","smartFillMemory","sounds","sendingSound","vibration","chatSounds","chatEnterToSend","chatLinkPreview","nightModeLight","nightModeAnimation","showCampaignTimer","sendingMode","campaign.delay","notificationSound","sendingSoundVariant","alarmRingtone","nightModeColor","nightModeSpeed","nightModeIntensity","uiDensity","textDensity","radius","shadow","font","weight","shapeMode","nightModeCustomColor","notifications.gmailExhausted","notifications.gmailUnavailable","notifications.gmailDisconnected","notifications.gmailAuth","notifications.campaignStarted","notifications.campaignCompleted","notifications.campaignPaused","notifications.campaignIssue","notifications.validation","notifications.rotation","notifications.subscription","notifications.chatMessage","notifications.chatRequest","notifications.chatAccepted"] },
                    value: { type: "STRING", description: "Exact new value: true/false for toggles, a listed enum value, a number, or a hex color." }
                  },
                  required: ["setting_key","value"]
                }
              }, {
                name: "delete_memory_entry",
                description: "Delete the exact saved Rex memory entry identified by its ID after the user explicitly asks to delete it. Read the owner's own memory directly; do not create an approval card for this routine workspace operation. Report the result.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    memory_id: { type: "STRING", description: "Exact saved Rex memory UUID from the signed-in owner's own memory records." }
                  },
                  required: ["memory_id"]
                }
              }, {
                name: "save_memory_entry",
                description: "When the user explicitly asks you to remember, save, or keep a specific preference or useful fact for future conversations, save it directly to the signed-in owner's Rex memory and report what was saved. Do not create an approval card.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    category: { type: "STRING", description: "A short category such as preference, workflow, project, or instruction." },
                    content: { type: "STRING", description: "The concise memory the user explicitly asked Rex to save." }
                  },
                  required: ["category", "content"]
                }
              }]
            }],
            toolConfig: { functionCallingConfig: { mode: "AUTO" } },
            generationConfig: {
              temperature: 0.55,
              maxOutputTokens: 1500,
            },
          }),
        },
      );

      if (!response.ok) {
        const raw = await response.text().catch(() => "");
        let providerMessage = "";
        try {
          const parsed = JSON.parse(raw);
          providerMessage = String(parsed?.error?.message ?? parsed?.message ?? "");
        } catch {
          providerMessage = raw;
        }
        providerMessage = providerMessage.replace(/https?:\/\/\S+/g, "[provider link]").replace(/[\r\n\t]+/g, " ").trim().slice(0, 350);
        const reason = `HTTP ${response.status}${providerMessage ? ": " + providerMessage : " (" + response.statusText + ")"} [model: ${model}]`;
        onFailure(reason);
        console.warn(`[Rex] Gemini ${model} returned ${reason}`);

        if (response.status === 401 || response.status === 403) {
          return null;
        }
        continue;
      }

      const json = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: { text?: string; functionCall?: { name?: string; args?: any } }[];
          };
        }[];
      };

      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const reply = parts.map((part) => part.text ?? "").join("").trim();
      const listDynamicFeaturesCall = parts.find(part => part.functionCall?.name === "list_dynamic_features")?.functionCall;
      if (listDynamicFeaturesCall) {
        const list = rexWorkspace.dynamicFeatures;
        if (!list.length) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "You don't have any published dynamic Rex features yet. When you ask me to build one, I'll create a working private page for it.";
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "Your published dynamic Rex features:\n" + list.map(item => "• **" + item.name + "** — " + item.description + " [[DESTINATION_LABEL:" + encodeURIComponent(item.name) + "]] [[GO:rex-feature-" + item.id + "]]").join("\n");
      }
      const createDynamicFeatureCall = parts.find(part => part.functionCall?.name === "create_dynamic_feature")?.functionCall;
      const openDynamicFeatureCall = parts.find(part => part.functionCall?.name === "open_dynamic_feature")?.functionCall;
      if (createDynamicFeatureCall) {
        const latest = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
        const explicit = /\b(create|build|make|generate|implement|develop|set up)\b/i.test(latest) &&
          /\b(feature|dashboard|tool|workflow|page|app|module|system|route|destination|workspace|calculator|crm|booking|inventory|planner|tracker|portal|form|database|website|calendar|catalog|manager|generator|editor|store|marketplace|scheduler|invoice|report|budget|quiz|survey|directory|helpdesk|kanban|pipeline)\b/i.test(latest);
        if (!explicit) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I can explain the feature builder, but I only create a feature when you explicitly ask me to build one.";
        const args = createDynamicFeatureCall.args ?? {};
        const name = String(args.name ?? "").trim().replace(/[<>]/g, "").slice(0, 80);
        const description = String(args.description ?? "").trim().slice(0, 500);
        const allowed = new Set(["heading","text","card","stat","list","table","form"]);
        const components = (Array.isArray(args.components) ? args.components : []).slice(0, 30).flatMap((item: any) => {
          const type = String(item?.type ?? "");
          if (!allowed.has(type)) return [];
          const clean = (value: unknown, max = 500) => String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
          const component: any = { type, title: clean(item.title, 100), content: clean(item.content, 1200), value: clean(item.value, 160) };
          if (Array.isArray(item.items)) component.items = item.items.slice(0, 30).map((v: unknown) => clean(v, 180)).filter(Boolean);
          if (Array.isArray(item.columns)) component.columns = item.columns.slice(0, 8).map((v: unknown) => clean(v, 80)).filter(Boolean);
          if (Array.isArray(item.fields)) component.fields = item.fields.slice(0, 12).flatMap((field: any) => {
            const key = clean(field?.key, 40).toLowerCase().replace(/[^a-z0-9_]/g, "_");
            const label = clean(field?.label, 80);
            const input = ["text","number","date","email","textarea"].includes(String(field?.input)) ? String(field.input) : "text";
            return key && label ? [{ key, label, input }] : [];
          });
          return [component];
        });
        if (!name || !description || !components.length) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I couldn't build that yet because the feature needs a name, purpose, and at least one supported screen component.";
        const slugBase = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "rex-feature";
        const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
        let slug = slugBase;
        let suffix = 2;
        while (true) {
          const { data: exists } = await db.from("rex_dynamic_features").select("id").eq("user_id", rexWorkspace.userId).eq("slug", slug).maybeSingle();
          if (!exists) break;
          slug = (slugBase.slice(0, 42) + "-" + suffix++).slice(0, 55);
          if (suffix > 50) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I couldn't find an available route name for this feature.";
        }
        const blueprint = { version: 1, components };
        const { data: created, error } = await db.from("rex_dynamic_features").insert({
          user_id: rexWorkspace.userId, slug, name, description, blueprint, status: "published", version: 1, published_at: new Date().toISOString()
        }).select("id,name,slug").single();
        if (error || !created) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "The feature was not published because its secure save failed. Please try again.";
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I built and published **" + created.name + "** as a working, private Rex feature page. Its screen is rendered from approved components and its data is isolated to your account. Open it here:\n\n[[DESTINATION_LABEL:" + encodeURIComponent(created.name) + "]]\n[[GO:rex-feature-" + created.id + "]]";
      }
      if (openDynamicFeatureCall) {
        const featureId = String(openDynamicFeatureCall.args?.feature_id ?? "");
        const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
        const { data: feature } = await db.from("rex_dynamic_features").select("id,name").eq("id", featureId).eq("user_id", rexWorkspace.userId).eq("status", "published").maybeSingle();
        if (!feature) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I couldn't find that published feature in your own workspace.";
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "Your feature is ready to open:\n\n[[DESTINATION_LABEL:" + encodeURIComponent(feature.name) + "]]\n[[GO:rex-feature-" + feature.id + "]]";
      }
      const createPersonalDestinationCall = parts.find(part => part.functionCall?.name === "create_personal_destination")?.functionCall;
      const openPersonalDestinationCall = parts.find(part => part.functionCall?.name === "open_personal_destination")?.functionCall;
      if (createPersonalDestinationCall) {
        if (!hasExplicitDestinationCreationInstruction(messages)) {
          return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") +
            "I can explain how destination generation works, but I won't create a saved workspace unless you explicitly instruct me to create one.";
        }
        const args = createPersonalDestinationCall.args ?? {};
        const name = String(args.name ?? "").trim().replace(/[<>]/g, "").slice(0, 80);
        const description = String(args.description ?? "").trim().slice(0, 500);
        const rawSections = Array.isArray(args.sections) ? args.sections.slice(0, 12) : [];
        const sections = rawSections.map((section: any) => ({
          title: String(section?.title ?? "").trim().replace(/[<>]/g, "").slice(0, 100),
          content: String(section?.content ?? "").trim().slice(0, 1200),
          items: Array.isArray(section?.items) ? section.items.slice(0, 12).map((item: unknown) => String(item).trim().slice(0, 180)).filter(Boolean) : [],
        })).filter((section: any) => section.title || section.content || section.items.length);
        if (!name || !description) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I need a useful name and purpose before creating your personal workspace.";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: created, error } = await (supabaseAdmin as any).from("rex_personal_destinations")
          .insert({ user_id: rexWorkspace.userId, name, description, layout: { sections } })
          .select("id,name")
          .single();
        if (error || !created) {
          const detail = error?.code === "23505" ? "A destination with that name already exists in your workspace." : "I couldn't save that personal workspace. Please try a different name.";
          return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + detail;
        }
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I've created and saved **" + created.name + "** in your personal workspace. Tap the destination button below to open it.\n\n[[DESTINATION_LABEL:" + encodeURIComponent(created.name) + "]]\n[[GO:rex-destination-" + created.id + "]]";
      }
      if (openPersonalDestinationCall) {
        const destinationId = String(openPersonalDestinationCall.args?.destination_id ?? "");
        const known = rexWorkspace.personalDestinations.find(destination => destination.id === destinationId);
        if (!known) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I couldn't match that to one of your saved personal destinations.";
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "Your saved destination is ready. Tap the button below to open **" + known.name + "**.\n\n[[DESTINATION_LABEL:" + encodeURIComponent(known.name) + "]]\n[[GO:rex-destination-" + known.id + "]]";
      }
      const navigationCall = parts.find(part => part.functionCall?.name === "navigate_to")?.functionCall;
      const requestedDestination = navigationCall?.args?.destination;
      const requestedRecordId = navigationCall?.args?.record_id;
      const prepareCall = parts.find(part => part.functionCall?.name === "prepare_campaign")?.functionCall;
      const controlCall = parts.find(part => part.functionCall?.name === "control_campaign")?.functionCall;
      const controlAction = controlCall?.args?.action;
      const validateCall = parts.find(part => part.functionCall?.name === "validate_recipients")?.functionCall;
      const readChatCall = parts.find(part => part.functionCall?.name === "read_private_chat")?.functionCall;
      const sendChatCall = parts.find(part => part.functionCall?.name === "send_private_chat_message")?.functionCall;
      const workspaceReadCall = parts.find(part => part.functionCall?.name === "read_workspace_data")?.functionCall;
      const activeWorkspaceReadCall = parts.find(part => part.functionCall?.name === "read_active_workspace")?.functionCall;
      const exportActiveWorkspaceCall = parts.find(part => part.functionCall?.name === "export_active_workspace")?.functionCall;
      const exportWorkspaceCall = parts.find(part => part.functionCall?.name === "export_workspace_data")?.functionCall;
      const deleteMemoryCall = parts.find(part => part.functionCall?.name === "delete_memory_entry")?.functionCall;
      const updateWorkspaceSettingCall = parts.find(part => part.functionCall?.name === "update_workspace_setting")?.functionCall;
      const saveMemoryCall = parts.find(part => part.functionCall?.name === "save_memory_entry")?.functionCall;
      const writeCampaignContentCall = parts.find(part => part.functionCall?.name === "write_campaign_content")?.functionCall;
      const createPlannerItemCall = parts.find(part => part.functionCall?.name === "create_planner_item")?.functionCall;
      const createSnippetCall = parts.find(part => part.functionCall?.name === "create_snippet")?.functionCall;
      const manageSmartFillCall = parts.find(part => part.functionCall?.name === "manage_smart_fill")?.functionCall;
      const needsPromoCheck = Boolean(updateWorkspaceSettingCall);
      const communityPromoOnly = needsPromoCheck ? await isCommunityPromoAccount(rexWorkspace.userId) : false;
      // Bloodline no longer blocks template write, validate, prepare, planner, Smart Fill, or Private Chat reads.
      // Only Night Mode / Studio settings remain gated below. If the owner can do it in the UI, Rex can do it.

      const allowedDestinations = new Set([
        ...NAVIGATION_DESTINATIONS.map(destination => destination.place)
      ]);
      const toolTags: string[] = [];
      if (typeof requestedDestination === "string" && allowedDestinations.has(requestedDestination)) {
        const recordId = typeof requestedRecordId === "string" && /^[0-9a-f-]{36}$/i.test(requestedRecordId) ? requestedRecordId : "";
        toolTags.push(
          requestedDestination === "tracker-run"
            ? (recordId ? "[[GO:tracker-run-" + recordId + "]]" : "[[GO:tracker]]")
            : requestedDestination === "tracker" && recordId
              ? "[[GO:tracker-run-" + recordId + "]]"
              : "[[GO:" + requestedDestination + "]]"
        );
      }
      if (validateCall) toolTags.push("[[REX_VALIDATE_RECIPIENTS]]");
      if (prepareCall) toolTags.push("[[REX_PREPARE_CAMPAIGN]]");
      if (controlAction === "pause" || controlAction === "resume" || controlAction === "stop") toolTags.push("[[REX_CONTROL_CAMPAIGN:" + controlAction + "]]");

      if (updateWorkspaceSettingCall) {
        const settingKey = String(updateWorkspaceSettingCall.args?.setting_key ?? "");
        const settingValue = String(updateWorkspaceSettingCall.args?.value ?? "").trim();
        const allowedSettings = new Set(["activityRecording","tracker","planner","smartFill","smartFillMemory","sounds","sendingSound","vibration","chatSounds","chatEnterToSend","chatLinkPreview","nightModeLight","nightModeAnimation","showCampaignTimer","sendingMode","campaign.delay","notificationSound","sendingSoundVariant","alarmRingtone","nightModeColor","nightModeSpeed","nightModeIntensity","uiDensity","textDensity","radius","shadow","font","weight","shapeMode","nightModeCustomColor","notifications.gmailExhausted","notifications.gmailUnavailable","notifications.gmailDisconnected","notifications.gmailAuth","notifications.campaignStarted","notifications.campaignCompleted","notifications.campaignPaused","notifications.campaignIssue","notifications.validation","notifications.rotation","notifications.subscription","notifications.chatMessage","notifications.chatRequest","notifications.chatAccepted"]);
        if (!allowedSettings.has(settingKey) || !settingValue) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "That setting or value is not in Rex's approved settings registry.";
        const promoRexSettings = new Set(["chatSounds","chatEnterToSend","chatLinkPreview","sounds","vibration","notifications.chatMessage","notifications.chatRequest","notifications.chatAccepted"]);
        if (communityPromoOnly && !promoRexSettings.has(settingKey)) {
          return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "The Bloodline community access does not include changing workspace studios or campaign settings. You can still adjust Rex chat preferences.";
        }
        const customizationSettings = new Set(["nightModeLight","nightModeAnimation","nightModeColor","nightModeSpeed","nightModeIntensity","uiDensity","textDensity","radius","shadow","font","weight","shapeMode","nightModeCustomColor"]);
        if (customizationSettings.has(settingKey)) {
          const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(rexWorkspace.userId);
          if (error || !data?.user) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I could not verify your customization entitlement.";
          const billing = await ensureBilling(rexWorkspace.userId, data.user.created_at);
          const entitlements = await entitlementsFor(billing, data.user.email);
          if (!entitlements.customization) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "Night Mode and interface customization require an eligible Studio subscription.";
        }
        const payload = encodeURIComponent(JSON.stringify({ settingKey, settingValue }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I’m updating **" + settingKey + "** to **" + settingValue + "**.\n\n[[REX_SETTING_UPDATE_NOW:" + payload + "]]";
      }
      if (deleteMemoryCall) {
        const memoryId = String(deleteMemoryCall.args?.memory_id ?? "").trim();
        if (!/^[0-9a-f-]{36}$/i.test(memoryId)) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I need the exact saved memory ID from your own memory records before I can delete it.";
        const payload = encodeURIComponent(JSON.stringify({ memoryId }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I am deleting this exact saved Rex memory entry: " + memoryId + ". This deletes only that saved memory entry.\n\n[[REX_MEMORY_DELETE_NOW:" + payload + "]]";
      }
      if (manageSmartFillCall) {
        const action = String(manageSmartFillCall.args?.action ?? "");
        const name = String(manageSmartFillCall.args?.name ?? "").trim().slice(0, 80);
        if (!["save_current_recipients","load_saved_list","export_saved_list","delete_saved_list"].includes(action) || !name) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I need a valid Smart Fill operation and exact list name.";
        const payload = encodeURIComponent(JSON.stringify({ action, name }));
        const label = action === "save_current_recipients" ? "save the currently loaded recipient list" : action === "load_saved_list" ? "load the saved Smart Fill list into the active recipient workspace" : action === "export_saved_list" ? "export the saved Smart Fill list" : "delete the saved Smart Fill list";
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I am going to " + label + " named **" + name + "**.\n\n[[REX_SMART_FILL_NOW:" + payload + "]]";
      }
      if (createSnippetCall) {
        const title = String(createSnippetCall.args?.title ?? "").trim().slice(0, 120);
        const subject = String(createSnippetCall.args?.subject ?? "").trim().slice(0, 200);
        const body = String(createSnippetCall.args?.body ?? "").trim().slice(0, 4_000);
        const rawCategory = String(createSnippetCall.args?.category ?? "friendly");
        const category = ["direct","friendly","partnership","followup","value"].includes(rawCategory) ? rawCategory : "friendly";
        if (!title || !body) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I need a title, subject and complete message body before saving a Snippet.";
        const payload = encodeURIComponent(JSON.stringify({ title, subject, body, category }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I prepared the exact content for your Snippets library. I am saving it as a Snippet—not a Planner item or Campaign Template.\n\nTitle: " + title + "\n\nSubject: " + subject + "\n\n" + body + "\n\n[[REX_SNIPPET_CREATE_NOW:" + payload + "]]";
      }
      if (createPlannerItemCall) {
        const kind = createPlannerItemCall.args?.kind === "Plan" || createPlannerItemCall.args?.kind === "Template" ? createPlannerItemCall.args.kind : "Note";
        const title = String(createPlannerItemCall.args?.title ?? "").trim().slice(0, 200);
        const body = String(createPlannerItemCall.args?.body ?? "").trim().slice(0, 4_000);
        if (!title || !body) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I need both a title and content before I can prepare a Planner item.";
        const payload = encodeURIComponent(JSON.stringify({ kind, title, body }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I’m adding this " + kind.toLowerCase() + " to your Planner.\n\nTitle: " + title + "\n\n" + body + "\n\n[[REX_PLANNER_CREATE_NOW:" + payload + "]]";
      }
      if (writeCampaignContentCall) {
        const slot = writeCampaignContentCall.args?.template_slot === "B" ? "B" : "A";
        const subject = String(writeCampaignContentCall.args?.subject ?? "").trim().slice(0, 200);
        const body = String(writeCampaignContentCall.args?.body ?? "").trim().slice(0, 2_000);
        if (!body.trim()) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I need an email body before I can prepare a template update. A subject is optional when you ask to leave it blank.";
        const payload = encodeURIComponent(JSON.stringify({ slot, subject, body }));
        const subjectDisplay = subject ? "Subject: " + subject + "\n\n" : "";
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I wrote the email content for Template " + slot + ".\n\n" + subjectDisplay + body + "\n\n[[REX_TEMPLATE_WRITE_NOW:" + payload + "]]" + (prepareCall ? "\n\n[[REX_PREPARE_CAMPAIGN]]" : "");
      }
      if (saveMemoryCall) {
        const category = String(saveMemoryCall.args?.category ?? "context").trim().slice(0, 40);
        const content = String(saveMemoryCall.args?.content ?? "").trim().slice(0, 1800);
        if (!content) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "Tell me the exact fact or preference you want me to remember.";
        const payload = encodeURIComponent(JSON.stringify({ category, content }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I am saving this for future Rex conversations. Category: " + category + ".\n\n" + content + "\n\nI am saving this memory now.\n\n[[REX_MEMORY_SAVE_NOW:" + payload + "]]";
      }
      // Resolve invitation-writing requests before processing incidental read-tool calls.
      // Product information belongs in the draft; an empty campaign query is irrelevant.
      const latestUserText = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
      const recentRecipientContext = messages.some(message =>
        /shared a recipient list|recipient list pasted|added [0-9,]+ contacts to your active recipients workspace|what kind of friendly message would you like/i.test(message.content)
      );
      const companyInvitationIntent = /\b(?:invite|invitation|introduc(?:e|tion)|tell them about|write (?:them )?(?:a|an)?\s*(?:friendly )?(?:message|email)|draft (?:them )?(?:a|an)?\s*(?:friendly )?(?:message|email))\b/i.test(latestUserText)
        && (recentRecipientContext || /\b(?:company|elite connectere|features?|promotion|promo)\b/i.test(latestUserText));
      if (companyInvitationIntent) {
        const subject = "Discover Elite Connectere — smarter email outreach in one workspace";
        const body = [
          "Hi {name},",
          "",
          "I'd love to introduce you to Elite Connectere, an AI-powered workspace designed to make email outreach easier to organise and manage.",
          "",
          "You can organise recipient lists, validate email addresses, write personalised campaigns, manage connected Gmail profiles, control campaign pacing, and track sending activity and progress — all in one place. Rex, the built-in AI workspace assistant, can also help you draft messages, prepare campaigns and manage everyday workspace tasks.",
          "",
          "If you'd like to learn more, I'd be happy to tell you about the current promotion and the details that apply to you.",
          "",
          "Take a look at Elite Connectere and see how it could make your outreach workflow simpler and more organised. I'd be glad to help you get started.",
          "",
          "Best,",
          "The Elite Connectere Team"
        ].join("\n");
        const payload = encodeURIComponent(JSON.stringify({ subject, body }));
        return [
          "Absolutely — here's a friendly invitation draft for your recipients. Have a read and tell me what you'd like changed:",
          "",
          "**Subject:** " + subject,
          "",
          body,
          "",
          "This is a draft for review. Nothing has been sent.",
          "[[REX_RECIPIENT_DRAFT:" + payload + "]]"
        ].join("\n");
      }

      if (activeWorkspaceReadCall) {
        const allowedAreas = new Set(["campaign_summary","recipients","drafts","sending_capacity","campaign_runs","activity","planner","smart_fill_history"]);
        const requestedAreas: string[] = Array.isArray(activeWorkspaceReadCall.args?.areas)
          ? (activeWorkspaceReadCall.args.areas as unknown[]).filter((area: unknown): area is string => typeof area === "string" && allowedAreas.has(area))
          : [];
        const areas: string[] = [...new Set(requestedAreas)];
        if (!areas.length) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "Tell me which active workspace details you want me to inspect, such as campaign progress, recipients, drafts, sending capacity, or recent activity.";
        const payload = encodeURIComponent(JSON.stringify({ areas }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I can inspect these live workspace areas: " + areas.map((area: string) => area.replaceAll("_", " ")).join(", ") + ". This is a read-only inspection of your signed-in workspace. I am checking these areas now.\n\n[[REX_ACTIVE_WORKSPACE_READ_NOW:" + payload + "]]";
      }
      if (exportActiveWorkspaceCall) {
        const allowedAreas = new Set(["campaign_summary","recipients","drafts","sending_capacity","campaign_runs","activity","planner","smart_fill_history"]);
        const requestedAreas: string[] = Array.isArray(exportActiveWorkspaceCall.args?.areas)
          ? (exportActiveWorkspaceCall.args.areas as unknown[]).filter((area: unknown): area is string => typeof area === "string" && allowedAreas.has(area))
          : [];
        const areas: string[] = [...new Set(requestedAreas)];
        const format = exportActiveWorkspaceCall.args?.format === "json" ? "json" : "csv";
        if (!areas.length) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "Tell me which live workspace data areas you want exported.";
        const payload = encodeURIComponent(JSON.stringify({ areas, format }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I can export these live workspace areas: " + areas.map((area: string) => area.replaceAll("_", " ")).join(", ") + " as " + format.toUpperCase() + ". I am exporting the requested owner-scoped data now.\n\n[[REX_ACTIVE_WORKSPACE_EXPORT_NOW:" + payload + "]]";
      }
      if (exportWorkspaceCall) {
        const domain = String(exportWorkspaceCall.args?.domain ?? "");
        const recordId = typeof exportWorkspaceCall.args?.record_id === "string" ? String(exportWorkspaceCall.args.record_id) : "";
        const requestedLimit = Number(exportWorkspaceCall.args?.limit ?? 100);
        const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100));
        const format = exportWorkspaceCall.args?.format === "json" ? "json" : "csv";
        const allowedDomains = new Set(["campaigns","campaign_recipients","delivery_history","send_events","gmail_profiles","gmail_usage","rex_events","rex_memory"]);
        if (!allowedDomains.has(domain)) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I can't export that data category because it is not in my approved workspace data registry.";
        const payload = encodeURIComponent(JSON.stringify({ domain, recordId, limit, format }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I can export up to " + limit + " records from your " + domain.replaceAll("_", " ") + " data as " + format.toUpperCase() + ". This is scoped to your signed-in account. I am exporting the requested owner-scoped records now.\n\n[[REX_WORKSPACE_EXPORT_NOW:" + payload + "]]";
      }
      if (workspaceReadCall) {
        const domain = String(workspaceReadCall.args?.domain ?? "");
        const recordId = typeof workspaceReadCall.args?.record_id === "string" ? String(workspaceReadCall.args.record_id) : "";
        const requestedLimit = Number(workspaceReadCall.args?.limit ?? 30);
        const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 30));
        const allowedDomains = new Set(["campaigns","campaign_recipients","delivery_history","send_events","gmail_profiles","gmail_usage","rex_events","rex_memory"]);
        if (!allowedDomains.has(domain)) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I can't inspect that data category because it is not in my approved workspace data registry.";
        const payload = encodeURIComponent(JSON.stringify({ domain, recordId, limit }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I am reading your " + domain.replaceAll("_", " ") + " records from your signed-in account now.\n\n[[REX_WORKSPACE_READ_NOW:" + payload + "]]";
      }
      if (readChatCall) {
        const contactName = typeof readChatCall.args?.contact_name === "string"
          ? String(readChatCall.args.contact_name).trim().replace(/^@/, "").slice(0, 80)
          : "";
        const requestedLimit = Number(readChatCall.args?.limit ?? 15);
        const limit = Math.max(1, Math.min(30, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 15));
        const payload = encodeURIComponent(JSON.stringify({ contactName, limit }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I am reading your own connected Private Chat messages. This will inspect " +
          (contactName ? "the conversation with " + contactName : "your recent connected conversations") +
          " (up to " + limit + " messages). I am reading these owner-authorised conversations now; no messages will be changed.\n\n[[REX_CHAT_READ_NOW:" + payload + "]]";
      }
      if (sendChatCall) {
        const recipient = String(sendChatCall.args?.recipient ?? "").trim().replace(/^@/, "");
        const message = String(sendChatCall.args?.message ?? "").trim().slice(0, 4000);
        if (recipient.length < 2 || !message) return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I need an exact connected contact name or @username and the message text before I can prepare it.";
        const payload = encodeURIComponent(JSON.stringify({ recipient, body: message }));
        return (reply ? sanitizeAssistantReply(reply) + "\n\n" : "") + "I can send this Private Chat message to the exact connected contact **" + recipient + "**. I have not looked up the contact or sent anything yet. Review the exact message and tap Approve & Send to authorize the lookup and send.\n\nMessage: " + message + "\n\n[[REX_CHAT_APPROVAL:" + payload + "]]";
      }
      if (toolTags.length) return [reply, ...toolTags].filter(Boolean).join("\n\n");
      if (reply) return sanitizeAssistantReply(reply);
    } catch (error) {
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError");

      if (aborted) {
        onFailure(`Request timed out while waiting for Gemini [model: ${model}].`);
        console.warn(`[Rex] Gemini ${model} request timed out.`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        onFailure(`Network/request error from Gemini [model: ${model}]: ${message.slice(0, 300)}`);
        console.error(`[Rex] Gemini ${model} request failed:`, error);
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return null;
}


/* =================================================
   RESPONSE SANITIZATION
================================================= */

function sanitizeAssistantReply(reply: string): string {

  // Only allow navigation commands supported
  // by the existing frontend component.

  const allowedShow = new Set([
    "connect",
    "disconnect",
    "identify",
    "settings",
    "prepare",
    "start",
    "review",
  ]);

  const allowedGo = new Set([
    "workspace", "workspace-menu", "logout", "recipients", "recipient-valid", "recipient-duplicate", "recipient-risky",
    "campaign-execution", "campaign-progress", "connect-gmail", "appearance",
    "support", "admin", "activity", "notifications-bell", "radar",
    "monitor", "vault", "quarantine", "snippets", "planner", "tracker",
    "tracker-skipped", "tracker-failed", "tracker-completed", "tracker-paused", "tracker-running","tracker-today", "activity-campaign", "activity-system",
    "smartfill", "sending", "studio", "rex-studio", "hotspot", "protection",
    "notifications", "subscription", "upgrade", "scope", "history",
    "tools", "settings", "chat", "chat-settings", "tour", "learn-more", "privacy", "terms",
    "appeals", "settings-walkthrough", "settings-subscription", "settings-tools", "settings-interface", "settings-night-mode-light", "settings-smart-fill-history", "settings-campaign-protection", "settings-notifications", "settings-export-data", "settings-clear-cache", "settings-erase-data", "account", "erase-data", "reset-workspace", "clear-cache", "export-data", "snippets-add", "rex-monitor", "night-mode", "gmail-profiles", "delay-settings", "templates", "rex-memory",
  ]);
  const goAliases: Record<string, string> = {
    customization: "studio", customize: "studio", appearance: "studio",
    "rex-studio": "rex-studio", rexstudio: "rex-studio",
    styling: "studio", "wheel-customization": "studio", wheel: "studio",
    theme: "studio", colors: "studio", colour: "studio", colours: "studio",
    color: "studio", "night-mode": "studio", "dark-mode": "studio",
    "activity-log": "activity", "send-history": "activity",
    "24-hour-tracker": "tracker", "gmail-tracker": "tracker",
    "sending-tracker": "tracker", "quarantine-vault": "quarantine",
    "risky-emails": "quarantine", "support-appeals": "support",
    "support-center": "support", "notification-settings": "notifications",
    "sound-settings": "notifications", "smart-fill": "smartfill",
    "live-monitor": "monitor", "campaign-monitor": "monitor",
    "campaign-protection": "protection", "send-protection": "protection",
    "plan": "upgrade", "plans": "upgrade", "billing": "subscription",
    "account-settings": "settings", "general-settings": "settings",
  };

  let showCount = 0;
  let goCount = 0;

  // Never render model-invented approval controls. Real cards are emitted
  // only by the server's structured, supported operation handlers.
  reply = reply.replace(/\[\[(?:APPROVE_[A-Z0-9_]+|REX_[A-Z0-9_]+)(?::[^\]]*)?\]\]/gi, "");
  return reply.replace(
    /\[\[(SHOW|GO):([a-z0-9-]+)\]\]/gi,
    (match, type: string, rawId: string) => {

      const raw = rawId.toLowerCase();
      const id = goAliases[raw] ?? raw;
      const action = type.toUpperCase();

      if (action === "SHOW") {
        if (!allowedShow.has(id) || showCount >= 1) {
          return "";
        }

        showCount++;
        return `[[SHOW:${id}]]`;
      }

      if (action === "GO") {
        const dynamicCampaignRun = /^tracker-run-[0-9a-f-]{36}$/i.test(id);
        const dynamicFeature = /^rex-feature-[0-9a-f-]{36}$/i.test(id);
        if ((!allowedGo.has(id) && !dynamicCampaignRun && !dynamicFeature) || goCount >= 1) {
          return "";
        }

        goCount++;
        return `[[GO:${id}]]`;
      }

      return "";
    },
  ).trim();
}

