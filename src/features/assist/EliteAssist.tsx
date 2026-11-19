import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Copy, Send, Upload, X } from "lucide-react";
import { RexAvatar } from "@/features/assist/RexAvatar";
import { showTip } from "@/features/workspace/HandTour";
import { askEliteAssist, type AssistAccount, type AssistMsg } from "@/lib/assist.functions";
import { sendPrivateChatMessageForRex } from "@/lib/chat.functions";
import { createRexOperationApproval, consumeRexOperationApproval, finishRexOperationApproval, readPrivateChatForRex, readRexWorkspaceData } from "@/lib/rex.operator.functions";
import { getLocalRexConfig } from "@/features/assist/local-memory";
import { appendLocalRexConversationMessages, buildLocalRexMemoryContext, deleteLocalRexMemoryEntry, getLocalRexConversation, getLocalRexMemorySettings, listLocalRexConversations, saveLocalRexMemoryEntry, type RexMemorySettings } from "@/features/assist/local-memory";
import { approveRexCampaign } from "@/lib/campaign.functions";
import { NAVIGATION_DESTINATIONS, REX_AUTONOMY_EXPERIMENT } from "@/features/assist/navigation.registry";
import { searchApplicationCatalog, type SearchableDestination } from "@/features/assist/application-search";
import { createRexPersonalDestination } from "@/lib/rex-destinations.functions";
import { inviteTeamMember } from "@/lib/team.functions";

export type AssistPlace = string;

// Human-readable labels for registered destinations. Keep this derived from the
// registry so every registered route has a safe label without a fragile global.
const PLACE_LABEL: Record<string, string> = Object.fromEntries(
  NAVIGATION_DESTINATIONS.map(({ place }) => [
    place,
    "Open " + place.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
  ]),
);

const REX_WELCOME_STARTERS = [
  "Help me understand what Rex can do across Elite Connectere",
  "Check my campaign readiness and available sending capacity",
  "Help me create a campaign plan",
  "Review my workspace and identify what needs attention",
  "Help me build a new feature or destination",
  "Help me automate a task in my workspace",
];
function extractSuggests(content: string): string[] {
  const out: string[] = [];
  const re = /\[\[SUGGEST:([^\]]+)\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const suggestion = match[1]!.trim();
    if (suggestion && !out.includes(suggestion)) out.push(suggestion);
  }
  return out.slice(0, 4);
}

function playRexExecutionChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(); const now = ctx.currentTime;
    [660, 880].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.frequency.value = frequency; oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.12 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.22);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(now + index * 0.12); oscillator.stop(now + index * 0.12 + 0.24);
    });
    window.setTimeout(() => void ctx.close(), 700);
  } catch { /* Browser audio may be unavailable. */ }
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2" aria-live="polite" aria-label="Rex is typing">
      <span className="grid size-8 place-items-center rounded-full bg-brand/15 text-brand">
        <RexAvatar size="tiny" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-card px-3 py-2.5 shadow-sm">
        <span className="ec-rex-dot size-1.5 rounded-full bg-ink-soft" />
        <span className="ec-rex-dot size-1.5 rounded-full bg-ink-soft" style={{ animationDelay: "0.15s" }} />
        <span className="ec-rex-dot size-1.5 rounded-full bg-ink-soft" style={{ animationDelay: "0.3s" }} />
      </div>
      <style>{`
        @keyframes ec-rex-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .ec-rex-dot { animation: ec-rex-bounce 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export function EliteAssist({
  uid,
  onClose,
  account,
  onGo,
  onPrepareCampaign,
  onExecuteCurrentCampaign,
  onPauseCurrentCampaign,
  onStopCurrentCampaign,
  onImportRecipients,
  onValidateRecipients,
  onReadActiveWorkspace,
  onApplyCampaignTemplate,
  onUpdateWorkspaceSetting,
  onCreatePlannerItem,
  onManageSmartFill,
  resumeConversationId,
  onConfirmLogout,
  searchResources = [],
  initialPrompt = "",
}: {
  uid: string;
  onClose: () => void;
  account: AssistAccount;
  onGo?: (place: AssistPlace) => void;
  onPrepareCampaign?: () => Promise<string>;
  onExecuteCurrentCampaign?: () => Promise<boolean>;
  onPauseCurrentCampaign?: () => boolean;
  onStopCurrentCampaign?: () => boolean;
  onImportRecipients?: (raw: string, sourceName?: string) => boolean;
  onValidateRecipients?: () => Promise<{ ok: boolean; valid: number; risky: number; duplicate: number }>;
  onReadActiveWorkspace?: (areas: string[]) => Promise<Record<string, unknown>> | Record<string, unknown>;
  onApplyCampaignTemplate?: (slot: "A" | "B", subject: string, body: string) => void;
  onUpdateWorkspaceSetting?: (settingKey: string, settingValue: string) => boolean;
  onCreatePlannerItem?: (kind: "Note" | "Plan" | "Template", title: string, body: string) => boolean;
  onManageSmartFill?: (action: "save_current_recipients" | "load_saved_list" | "export_saved_list" | "delete_saved_list", name: string) => boolean;
  resumeConversationId?: string | null;
  onConfirmLogout?: () => Promise<void> | void;
  searchResources?: SearchableDestination[];
  initialPrompt?: string;
}) {
  const newChatStorageKey = `rex-new-chat:${uid}`;
  const [rexName, setRexName] = useState("Rex");
  useEffect(() => { let active = true; void getLocalRexConfig(uid).then(r => { if (active) setRexName(r.config.displayName); }).catch(() => {}); return () => { active = false; }; }, [uid]);
  const [msgs, setMsgs] = useState<AssistMsg[]>([]);
  const engineSessionApprovalIds = useRef(new Set<string>());
  const actionApprovalIds = useRef(new Map<string, "pause" | "resume" | "stop">());
  const conversationId = useRef<string | null>(null);
  const [memorySettings, setMemorySettings] = useState<RexMemorySettings>({ saveHistory: true, rememberContext: true });
  const [historyReady, setHistoryReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const prefs = await getLocalRexMemorySettings(uid);
        if (!active) return;
        setMemorySettings(prefs.settings);
        const { conversations } = await listLocalRexConversations(uid);
        let keepBlankChat = !prefs.settings.saveHistory;
        if (!resumeConversationId) {
          try { keepBlankChat = keepBlankChat || window.localStorage.getItem(newChatStorageKey) === "1"; } catch {}
        }
        if (active && keepBlankChat) {
          try {
            const draft = window.sessionStorage.getItem(`rex-live-session:${uid}`);
            if (draft) {
              const parsed = JSON.parse(draft);
              if (Array.isArray(parsed) && parsed.length) {
                setMsgs(parsed.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"));
              }
            }
          } catch {}
        }
        if (active && !keepBlankChat && conversations[0]) {
          const targetId = resumeConversationId && conversations.some(item => item.id === resumeConversationId) ? resumeConversationId : conversations[0].id;
          const restored = await getLocalRexConversation(uid, targetId);
          if (active && restored.conversation) {
            conversationId.current = restored.conversation.id;
            try { window.localStorage.setItem(`rex-last-conversation:${uid}`, restored.conversation.id); } catch {}
            const restoredMessages = restored.messages.map((message, index) => {
              if (message.content.includes("[[REX_CHAT_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_CHAT_APPROVAL:[^\]]+\]\]/g, "[[REX_CHAT_EXPIRED]]") };
              if (message.content.includes("[[REX_CHAT_READ_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_CHAT_READ_APPROVAL:[^\]]+\]\]/g, "[[REX_CHAT_READ_EXPIRED]]") };
              if (message.content.includes("[[REX_WORKSPACE_READ_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_WORKSPACE_READ_APPROVAL:[^\]]+\]\]/g, "[[REX_WORKSPACE_READ_EXPIRED]]") };
              if (message.content.includes("[[REX_WORKSPACE_EXPORT_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_WORKSPACE_EXPORT_APPROVAL:[^\]]+\]\]/g, "[[REX_WORKSPACE_EXPORT_EXPIRED]]") };
              if (message.content.includes("[[REX_ACTIVE_WORKSPACE_EXPORT_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_ACTIVE_WORKSPACE_EXPORT_APPROVAL:[^\]]+\]\]/g, "[[REX_ACTIVE_WORKSPACE_EXPORT_EXPIRED]]") };
              if (message.content.includes("[[REX_ACTIVE_WORKSPACE_READ_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_ACTIVE_WORKSPACE_READ_APPROVAL:[^\]]+\]\]/g, "[[REX_ACTIVE_WORKSPACE_READ_EXPIRED]]") };
              if (message.content.includes("[[REX_IMPORT_APPROVAL]]")) return { role: message.role, content: message.content.replace("[[REX_IMPORT_APPROVAL]]", "[[REX_IMPORT_EXPIRED]]") };
              if (message.content.includes("[[REX_TEMPLATE_WRITE_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_TEMPLATE_WRITE_APPROVAL:[^\]]+\]\]/g, "[[REX_TEMPLATE_WRITE_EXPIRED]]") };
              if (message.content.includes("[[REX_SETTING_UPDATE_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_SETTING_UPDATE_APPROVAL:[^\]]+\]\]/g, "[[REX_SETTING_UPDATE_EXPIRED]]") };
              if (message.content.includes("[[REX_PLANNER_CREATE_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_PLANNER_CREATE_APPROVAL:[^\]]+\]\]/g, "[[REX_PLANNER_CREATE_EXPIRED]]") };
              if (message.content.includes("[[REX_SMART_FILL_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_SMART_FILL_APPROVAL:[^\]]+\]\]/g, "[[REX_SMART_FILL_EXPIRED]]") };
              if (message.content.includes("[[REX_MEMORY_DELETE_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_MEMORY_DELETE_APPROVAL:[^\]]+\]\]/g, "[[REX_MEMORY_DELETE_EXPIRED]]") };
              if (message.content.includes("[[REX_MEMORY_SAVE_APPROVAL:")) return { role: message.role, content: message.content.replace(/\[\[REX_MEMORY_SAVE_APPROVAL:[^\]]+\]\]/g, "[[REX_MEMORY_SAVE_EXPIRED]]") };
              if (message.content.includes("[[REX_LOGOUT_APPROVAL]]")) return { role: message.role, content: message.content.replace("[[REX_LOGOUT_APPROVAL]]", "[[REX_LOGOUT_EXPIRED]]") };
              const pending = message.content.match(/\[\[REX_APPROVAL:([a-z0-9-]+):(pause|resume|stop)\]\]/i);
              if (!pending) return { role: message.role, content: message.content };
              const approvalId = pending[1]!;
              const completed = restored.messages.slice(index + 1).some(item => item.content.includes("[[REX_ACTION_DONE:" + approvalId + "]]"));
              const replacement = completed
                ? "[[REX_APPROVED:" + approvalId + ":" + pending[2] + "]]"
                : "[[REX_EXPIRED:" + approvalId + ":" + pending[2] + "]]";
              return { role: message.role, content: message.content.replace(pending[0], replacement) };
            });

            setMsgs(restoredMessages);
            const latestAssistantReply = [...restoredMessages].reverse().find(message => message.role === "assistant");
            setSuggests(latestAssistantReply ? extractSuggests(latestAssistantReply.content) : []);
          }
        }
      } catch (error) {
        console.error("Could not restore Rex local conversation", error);
        toast.error("Rex could not open device memory. Your saved data has not been deleted.");
      } finally {
        if (active) setHistoryReady(true);
      }
    })();
    return () => { active = false; };
  }, [uid, resumeConversationId]);

  async function persistMessage(role: "user" | "assistant", content: string) {
    if (!memorySettings.saveHistory) return;
    try {
      const saved = await appendLocalRexConversationMessages(uid, conversationId.current, [{ role, content }]);
      if (saved.conversationId) {
        conversationId.current = saved.conversationId;
        try {
          window.localStorage.setItem(`rex-last-conversation:${uid}`, saved.conversationId);
          window.localStorage.removeItem(newChatStorageKey);
        } catch {}
      }
    } catch (error) {
      console.error("Could not save Rex device-local conversation", error);
      toast.error("Rex could not save to this device. Check available browser storage; nothing was sent to Supabase.");
    }
  }
  const [text, setText] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [lastSource, setLastSource] = useState<"ai" | "local" | null>(null);
  const [suggests, setSuggests] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const inputGrowRef = useRef<HTMLTextAreaElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Array<{name:string;mimeType:string;data:string}>>([]);
  const [pendingImport, setPendingImport] = useState<{ raw: string; fileName: string; sha256: string; byteLength: number; emailCount: number; campaignWorkflow: boolean } | null>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  useLayoutEffect(() => {
    const ta = inputGrowRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 130) + "px";
  }, [text]);


  /** Gemini sometimes invents fake [[APPROVE ...]] text. Only registered REX_* markers render as pills. */
  
  async function approveChatMessage(payload: { recipient: string; body: string }) {
    if (busy) return;
    const recipient = String(payload.recipient ?? "").trim().replace(/^@/, "");
    const body = String(payload["body"] ?? "").trim();
    if (!recipient || !body) { toast.error("The exact recipient and message are required. Nothing was sent."); return; }
    setBusy(true);
    let approvalId = "";
    try {
      const hasActivePreview = msgs.some(message => {
      if (message.role !== "assistant") return false;
      const marker = message.content.match(/\[\[REX_CHAT_APPROVAL:([^\]]+)\]\]/i);
      if (!marker?.[1]) return false;
      try {
        const preview = JSON.parse(decodeURIComponent(marker[1])) as { recipient?: unknown; body?: unknown };
        return String(preview.recipient ?? "").trim().replace(/^@/, "") === recipient
          && String(preview.body ?? "").trim() === body;
      } catch {
        return false;
      }
    });
    if (!hasActivePreview) {
      toast.info("This Private Chat preview has expired. Ask Rex to prepare it again and approve the new exact message.");
      return;
    }
    const plan = [{ action: "send_private_chat", label: "Send the exact approved Private Chat message", scope: { recipient, body } }];
      const receipt = await createRexOperationApproval({ data: {
        title: "Send Private Chat message to " + recipient,
        summary: "Send only the exact message displayed in Rex to the exact connected contact after this approval.",
        plan,
      } });
      approvalId = receipt.approval.id;
      const authorized = (await consumeRexOperationApproval({ data: { approvalId } })) as Record<string, any>;
      const planSteps: any[] = Array.isArray(authorized?.plan) ? authorized.plan : [];
      const approvedStep = planSteps.find((step: any) =>
        step?.action === "send_private_chat" && step?.scope?.recipient === recipient && step?.scope?.body === body
      );
      if (!approvedStep || planSteps.length !== 1) throw new Error("The approved recipient or message did not match the preview. Nothing was sent.");
      const result = (await sendPrivateChatMessageForRex({ data: { approvalId, recipient, body } })) as { recipient?: string };
      await finishRexOperationApproval({ data: { approvalId, ok: true, result: "Sent the exact approved Private Chat message to " + (result?.recipient ?? recipient) + "." } });
      const tag = "[[REX_CHAT_APPROVAL:" + encodeURIComponent(JSON.stringify({ recipient, body })) + "]]";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_CHAT_SENT]]") }
        : message));
      const reply = "Your Private Chat message was sent to " + result.recipient + ".";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Private Chat message sent.");
      playRexExecutionChime();
    } catch (error) {
      if (approvalId) { try { await finishRexOperationApproval({ data: { approvalId, ok: false, result: "Private Chat send failed or was rejected. No successful delivery was confirmed." } }); } catch {} }
      const reply = error instanceof Error ? error.message : "The Private Chat message could not be sent. Nothing was confirmed as delivered.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveChatRead(payload: { contactName: string; limit: number }, automatic = false) {
    if (busy && !automatic) return;
    const contactName = String(payload["contactName"] ?? "").trim().replace(/^@/, "");
    const limit = Math.max(1, Math.min(30, Math.floor(Number(payload["limit"]) || 15)));
    setBusy(true);
    try {
      const result = await readPrivateChatForRex({ data: { contactName, limit } });
      const tag = "[[REX_CHAT_READ_APPROVAL:" + encodeURIComponent(JSON.stringify(payload)) + "]]";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_CHAT_READ_DONE]]") }
        : message));
      const details = result.records.map((record: any) =>
        "[" + new Date(record.at).toLocaleString() + "] " + record.contact + " — " + record.direction + ": " + record.message
      ).join("\\n");
      const reply = result.message || (details ? "Here are your Private Chat messages:\\n\\n" + details : "No Private Chat messages were found.");
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Private Chat history loaded.");
    } catch (error) {
      const reply = error instanceof Error ? error.message : "Private Chat history could not be read.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }


  function downloadRexData(name: string, value: unknown, format: "csv" | "json") {
    const rows = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [{ value }];
    let content = "";
    let mime = "";
    if (format === "json") {
      content = JSON.stringify(value, null, 2);
      mime = "application/json";
    } else {
      const keys = [...new Set(rows.flatMap((row: any) => row && typeof row === "object" ? Object.keys(row) : ["value"]))];
      const quote = (cell: unknown) => '"' + String(cell ?? "").replace(/"/g, '""') + '"';
      content = [keys.map(quote).join(","), ...rows.map((row: any) => keys.map(key => quote(row?.[key])).join(","))].join("\\r\\n");
      mime = "text/csv";
    }
    const blob = new Blob([content], { type: mime + ";charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name.replace(/[^a-z0-9._-]+/gi, "-") + (format === "json" ? ".json" : ".csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function approveWorkspaceRead(payload: { domain: string; recordId?: string; limit?: number }, automatic = false) {
    if (busy && !automatic) return;
    setBusy(true);
    try {
      const result = await readRexWorkspaceData({ data: { domain: payload["domain"], ...(payload["recordId"] ? { recordId: payload["recordId"] } : {}), ...(payload["limit"] !== undefined ? { limit: payload["limit"] } : {}) } });
      const reply = "Here are your " + result.domain.replaceAll("_", " ") + " records (" + result.count + "):\\n\\n" +
        JSON.stringify(result.records, null, 2).slice(0, 18_000);
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "I could not read those workspace records.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply); toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveActiveWorkspaceRead(areas: string[], automatic = false) {
    if (busy && !automatic) return;
    if (!onReadActiveWorkspace) { toast.error("Live workspace reading is not connected."); return; }
    setBusy(true);
    try {
      const result = await onReadActiveWorkspace(areas);
      const reply = "I checked your live workspace for: " + areas.join(", ") + ".\\n\\n" + JSON.stringify(result, null, 2).slice(0, 18_000);
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "I could not inspect the live workspace.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply); toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveWorkspaceExport(payload: { domain: string; recordId?: string; limit?: number; format: "csv" | "json" }, automatic = false) {
    if (busy && !automatic) return;
    setBusy(true);
    try {
      const result = await readRexWorkspaceData({ data: { domain: payload["domain"], ...(payload["recordId"] ? { recordId: payload["recordId"] } : {}), ...(payload["limit"] !== undefined ? { limit: payload["limit"] } : {}) } });
      downloadRexData("rex-" + result.domain, result.records, payload["format"]);
      const reply = "Exported " + result.count + " of your " + result.domain.replaceAll("_", " ") + " records.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply); toast.success(reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "The workspace export failed.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply); toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveActiveWorkspaceExport(payload: { areas: string[]; format: "csv" | "json" }, automatic = false) {
    if (busy && !automatic) return;
    if (!onReadActiveWorkspace) { toast.error("Live workspace export is not connected."); return; }
    setBusy(true);
    try {
      const result = await onReadActiveWorkspace(payload["areas"]);
      downloadRexData("rex-live-workspace", result, payload["format"]);
      const reply = "Exported your live workspace data for: " + payload["areas"].join(", ") + ".";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply); toast.success(reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "The live workspace export failed.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply); toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveRecipientValidation(automatic = false) {
    if (busy && !automatic) return;
    if (!onValidateRecipients) { toast.error("Recipient validation is not connected."); return; }
    setBusy(true);
    try {
      const result = await onValidateRecipients();
      const reply = result.ok
        ? "Recipient validation completed: " + result.valid + " valid, " + result.risky + " risky, and " + result.duplicate + " duplicate addresses. Nothing was sent."
        : "Recipient validation could not be completed. Nothing was sent.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply);
      if (result.ok) toast.success("Recipient validation complete."); else toast.error(reply);
    } catch (error) {
      const reply = error instanceof Error ? error.message : "Recipient validation failed.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]); await persistMessage("assistant", reply); toast.error(reply);
    } finally { setBusy(false); }
  }


  async function approveHotspotInvite(payload: { email: string; maxGmailProfiles: number }, automatic = false) {
    if (busy && !automatic) return;
    setBusy(true);
    try {
      const res = await inviteTeamMember({ data: { email: payload.email, maxGmailProfiles: payload.maxGmailProfiles } });
      if (!(res as any).ok) throw new Error((res as any).error || "Could not share hotspot access");
      const reply = "Hotspot access shared with " + payload.email + " (max " + payload.maxGmailProfiles + " Gmail profiles).";
      setMsgs((current) => current.map((m) => m.content.includes("[[REX_HOTSPOT_INVITE_APPROVAL:")
        ? { ...m, content: m.content.replace(/\[\[REX_HOTSPOT_INVITE_APPROVAL:[^\]]+\]\]/g, "[[REX_HOTSPOT_INVITE_DONE]]") }
        : m).concat([{ role: "assistant", content: reply }]));
      await persistMessage("assistant", reply);
      toast.success(reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hotspot share failed";
      toast.error(msg);
      setMsgs((c) => [...c, { role: "assistant", content: msg }]);
    } finally {
      setBusy(false);
    }
  }

  function sanitizeAssistantApprovals(content: string, userQuestion: string): string {
    let out = content
      .replace(/\[\[\s*APPROVE[^\]]*\]\]/gi, "")
    .replace(/\[\[REX_HOTSPOT_INVITE_APPROVAL:[^\]]*\]\]/gi, "")
    .replace(/\[\[REX_HOTSPOT_INVITE_DONE\]\]/gi, "")
      .replace(/\[\s*APPROVE[^\]]*\]/gi, "")
      .replace(/tap the approval button below\.?/gi, "")
      .replace(/just tap the approval button below\.?/gi, "");
    const wantsInspect = /(read|inspect|check|see|look at|show)[\s\S]{0,80}(message|subject|body|draft|workspace|campaign content|what i (wrote|prepared)|current message)/i.test(userQuestion)
      || /(my current message|message (i want to|to) (send|execute)|campaign (message|content|draft))/i.test(userQuestion);
    const hasReal = /\[\[REX_(ACTIVE_WORKSPACE_READ|WORKSPACE_READ|APPROVAL|VALIDATE|IMPORT|LOGOUT|TEMPLATE|SETTING|PLANNER|SMART_FILL|MEMORY|CHAT)/i.test(out);
    if (wantsInspect && !hasReal && onReadActiveWorkspace) {
      const areas = ["subject", "body", "recipients", "status", "templates"];
      const marker = "[[REX_ACTIVE_WORKSPACE_READ_APPROVAL:" + encodeURIComponent(JSON.stringify({ areas })) + "]]";
      out = out.trimEnd() + "\n\n" + marker;
    }

    const hotspotMatch = userQuestion.match(/\b(?:share|invite|hotspot)\b[\s\S]{0,80}?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
      || userQuestion.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})[\s\S]{0,40}\bhotspot\b/i);
    if (hotspotMatch && !/REX_HOTSPOT_INVITE_APPROVAL/i.test(out)) {
      const email = (hotspotMatch[1] || hotspotMatch[0] || "").toLowerCase();
      if (email.includes("@")) {
        const maxMatch = userQuestion.match(/\b(\d{1,2})\s*(?:gmail|seat|profile)s?\b/i);
        const maxGmailProfiles = maxMatch ? Math.min(75, Math.max(1, Number(maxMatch[1]))) : 5;
        out = out.trimEnd() + "\n\n[[REX_HOTSPOT_INVITE_APPROVAL:" + encodeURIComponent(JSON.stringify({ email, maxGmailProfiles })) + "]]";
      }
    }
    return out;
  }

  async function runRexCampaignCommand(question: string): Promise<string | null> {
    const existingApproval = msgs.slice().reverse().find(message =>
      message.role === "assistant" && message.content.includes("[[APPROVE_CAMPAIGN:")
    );
    const shortAffirmation = /^(yes|yeah|yep|ok|okay|approved|go ahead|do it|proceed|confirm|send it)$/i.test(question.trim())
      || isClearSendCommand(question);
    if (existingApproval && shortAffirmation) return "[[TYPED_APPROVE_CAMPAIGN]]";
    // Preview was shown without a button (old path); user now says send → return null so full prepare+approve runs
    if (!existingApproval) return null;
    // Questions about a visible draft are discussion, not approval.
    // Only an explicit short send confirmation may activate an existing approval above.
    return null;
  }

  
  async function approveActionFromCard(id: string, automatic = false) {
    const action = actionApprovalIds.current.get(id);
    if (!action) {
      toast.error("That control expired. Say pause, stop, or continue again.");
      return;
    }
    actionApprovalIds.current.delete(id);
    let note = "";
    let ok = false;
    if (action === "pause") {
      ok = Boolean(onPauseCurrentCampaign && onPauseCurrentCampaign());
      note = ok ? "Campaign paused." : "Could not pause.";
    } else if (action === "stop") {
      ok = Boolean(onStopCurrentCampaign && onStopCurrentCampaign());
      note = ok ? "Campaign stopped." : "Could not stop.";
    } else {
      ok = onExecuteCurrentCampaign ? await onExecuteCurrentCampaign() : false;
      note = ok ? "Campaign continued." : "Could not continue.";
    }
    setMsgs((current) => current.map((m) =>
      m.content.includes("[[REX_APPROVAL:" + id + ":")
        ? { ...m, content: m.content.replace(/\[\[REX_APPROVAL:[^\]]+\]\]/g, "[[REX_APPROVED:" + id + ":" + action + "]]") }
        : m
    ).concat([{ role: "assistant", content: note }]));
    await persistMessage("assistant", note);
    if (ok) toast.success(note); else toast.error(note);
  }

  async function approveCampaignFromCard(campaignId: string, scheduledAt: string, mode: "send" | "schedule" = "send") {
    if (busy) return;
    setBusy(true);
    let operationApprovalId = "";
    let operationApprovalFinished = false;
    try {
      if (campaignId.startsWith("engine-") || engineSessionApprovalIds.current.has(campaignId)) {
        if (mode === "schedule") throw new Error("This approval is for immediate execution only. Future scheduling must use the dedicated scheduler.");
        if (!onPrepareCampaign || !onExecuteCurrentCampaign) throw new Error("The complete campaign workflow is not connected to this workspace session.");
        if (account["engineStatus"] === "sending") throw new Error("Elite Engine is already sending. This approval cannot start a second run.");
        const plan = [
          { action: "prepare_campaign", label: "Inspect and prepare the active campaign", scope: { source: "active_elite_engine_current_session" } },
          { action: "control_campaign", label: "Start the prepared campaign", scope: { action: "execute", target: "active_elite_engine_current_session" } },
        ];
        const receipt = await createRexOperationApproval({ data: {
          title: "Execute active Elite Engine campaign",
          summary: "Inspect the active recipient list and campaign content, validate recipients, classify valid, risky and duplicate entries and apply the workspace's sending protections, verify protected Gmail capacity, then start sending only to safe unsent recipients if all readiness checks pass.",
          plan,
        } });
        operationApprovalId = receipt.approval.id;
        const authorized = await consumeRexOperationApproval({ data: { approvalId: operationApprovalId } }) as any;
        const canonical = (value: unknown): unknown => Array.isArray(value)
          ? value.map(canonical)
          : value && typeof value === "object"
            ? Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]))
            : value;
        if (JSON.stringify(canonical(authorized.plan)) !== JSON.stringify(canonical(plan))) throw new Error("The approved campaign workflow did not match the requested scope.");
        const rexPreferences = await getLocalRexConfig(uid);
        if (!rexPreferences.config.allowCampaignExecution) throw new Error("Campaign execution through Rex is disabled in Rex Studio. No campaign data was inspected and nothing was sent.");
        // The approval receipt is consumed before any workspace preflight or send operation.
        await onPrepareCampaign();
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const started = await onExecuteCurrentCampaign();
        await finishRexOperationApproval({ data: { approvalId: operationApprovalId, ok: started, result: started ? "Elite Engine accepted the approved campaign start." : "Readiness changed or Elite Engine did not start; no start was confirmed." } });
        operationApprovalFinished = true;
        const reply = started
          ? "Approved. Elite Engine has started sending."
          : "The Engine did not start because a live readiness check failed. Nothing was sent. Please resolve the blocker shown in Elite Engine and ask Rex to prepare again.";
        if (started) {
          setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes("[[APPROVE_CAMPAIGN:" + campaignId + ":") ? { ...message, content: message.content.replace(/\[\[APPROVE_CAMPAIGN:[^\]]+\]\]/g, "[[CAMPAIGN_APPROVED:" + campaignId + ":send]]") } : message));
          try { window.localStorage.setItem("rex-approved-campaign:" + campaignId, "send"); } catch {}
          toast.success("Elite Engine started — sending.");
          playRexExecutionChime();
        } else toast.error("Elite Engine did not start.");
        setMsgs(current => [...current, { role: "assistant", content: reply }]);
        await persistMessage("assistant", reply);
        return;
      }
      if (mode === "send") {
        throw new Error("This is an older Rex campaign approval, not an active Elite Engine approval. I have not queued or sent it. Ask Rex to prepare the current Elite Engine session and use its new Approve & Send Now button.");
      }
      const rexPreferences = await getLocalRexConfig(uid);
      if (!rexPreferences.config.allowCampaignExecution) throw new Error("Campaign execution through Rex is disabled in Rex Studio. No campaign was approved or sent.");
      if (mode === "schedule" && !rexPreferences.config.allowCampaignScheduling) throw new Error("Campaign scheduling through Rex is disabled in Rex Studio. No campaign was scheduled.");
      const result = await approveRexCampaign({ data: { campaignId, scheduledAt } });
      const reply = result.ok
        ? (mode === "schedule"
          ? `Campaign approved and scheduled successfully.\n\n• Campaign: ${result.assessment.campaign.name}\n• Recipients: ${result.assessment.campaign.total.toLocaleString()}\n• Scheduled start: ${new Date(result.campaign.scheduled_at ?? scheduledAt).toLocaleString()}\n\nThe campaign worker will start it at that time.`
          : `Campaign approved. The worker has confirmed execution started.\n\n• Campaign: ${result.assessment.campaign.name}\n• Recipients: ${result.assessment.campaign.total.toLocaleString()}\n• Worker processed in this run: ${Number((result as any).worker?.processed ?? 0).toLocaleString()}\n• Current status: ${result.campaign.status}\n\nDelivery progress will update as recipients are processed.`)
        : `I could not approve this campaign because a readiness check no longer passes. No campaign start was authorized.\n\n${result.assessment.checks.filter(check => !check.ok).map(check => `• ${check.label}: ${check.detail}`).join("\n")}`;
      if (result.ok) { try { window.localStorage.setItem("rex-approved-campaign:" + campaignId, mode); } catch {} setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes("[[APPROVE_CAMPAIGN:" + campaignId + ":") ? { ...message, content: message.content.replace(/\[\[APPROVE_CAMPAIGN:[^\]]+\]\]/g, "[[CAMPAIGN_APPROVED:" + campaignId + ":" + mode + "]]") } : message)); }
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      if (result.ok) { toast.success(mode === "schedule" ? "Campaign scheduled." : "Campaign worker started — sending."); playRexExecutionChime(); }
      else toast.error("Campaign is not ready for approval.");
    } catch (error) {
      if (operationApprovalId && !operationApprovalFinished) {
        try { await finishRexOperationApproval({ data: { approvalId: operationApprovalId, ok: false, result: "Approved campaign workflow failed before a start was confirmed." } }); } catch {}
      }
      const reply = error instanceof Error ? error.message : "The campaign approval could not be completed.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally {
      setBusy(false);
    }
  }
  async function approveNavigationFromCard(place: string) {
    if (busy) return;
    setBusy(true);
    let approvalId = "";
    try {
      const receipt = await createRexOperationApproval({ data: {
        title: "Open " + place,
        summary: "Navigate to the exact " + place + " destination in Elite Connectere. No records will be changed.",
        plan: [{ action: "navigate", label: "Open " + place, scope: { destination: place } }],
      } });
      approvalId = receipt.approval.id;
      const authorized = await consumeRexOperationApproval({ data: { approvalId } }) as any;
      if (authorized.plan.length !== 1 || authorized.plan[0]?.action !== "navigate" || authorized.plan[0]?.scope.destination !== place) throw new Error("The approved navigation destination did not match.");
      if (place === "learn-more" || place === "privacy" || place === "terms") window.open("/" + place, "_blank");
      else {
        onClose();
        window.setTimeout(() => onGo?.(place as AssistPlace), 150);
      }
      await finishRexOperationApproval({ data: { approvalId, ok: true, result: "Navigated to " + place + "." } });
    } catch (error) {
      if (approvalId) { try { await finishRexOperationApproval({ data: { approvalId, ok: false, result: "Navigation failed." } }); } catch {} }
      toast.error(error instanceof Error ? error.message : "The approved navigation failed.");
    } finally { setBusy(false); }
  }

  async function approveSmartFillAction(payload: { action: "save_current_recipients" | "load_saved_list" | "export_saved_list" | "delete_saved_list"; name: string }, automatic = false) {
    if (busy && !automatic) return;
    if (!onManageSmartFill) { toast.error("Smart Fill list management is not connected."); return; }
    setBusy(true);
    try {
      if (!onManageSmartFill(payload["action"], payload["name"])) {
        throw new Error("The Smart Fill operation could not be completed. Check that the named list exists and that there is room to save another list.");
      }
      const tag = "[[REX_SMART_FILL_APPROVAL:" + encodeURIComponent(JSON.stringify(payload)) + "]]";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_SMART_FILL_DONE]]") }
        : message));
      const reply = payload["action"] === "save_current_recipients"
        ? "Saved the current recipient list as Smart Fill list **" + payload["name"] + "**."
        : payload["action"] === "load_saved_list"
          ? "Loaded Smart Fill list **" + payload["name"] + "** into the active recipient workspace. The list is ready for validation; no messages were sent."
          : payload["action"] === "export_saved_list"
            ? "Exported Smart Fill list **" + payload["name"] + "**."
            : "Deleted Smart Fill list **" + payload["name"] + "**.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Smart Fill operation completed.");
    } catch (error) {
      const reply = error instanceof Error ? error.message : "The Smart Fill operation failed.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approvePlannerItemCreate(payload: { kind: "Note" | "Plan" | "Template"; title: string; body: string }, automatic = false) {
    if (busy && !automatic) return;
    if (!onCreatePlannerItem) { toast.error("Planner item creation is not connected."); return; }
    setBusy(true);
    let approvalId = "";
    try {
      const scope = { target: "planner_item", kind: payload["kind"], title: payload["title"], body: payload["body"] };
      const receipt = await createRexOperationApproval({ data: {
        title: "Add " + payload["kind"] + " to Planner",
        summary: "Add the exact approved " + payload["kind"].toLowerCase() + " titled " + payload["title"] + " to your Planner.",
        plan: [{ action: "update_settings", label: "Create the approved Planner item", scope }],
      } });
      approvalId = receipt.approval.id;
      const authorized = await consumeRexOperationApproval({ data: { approvalId } }) as any;
      if (authorized.plan.length !== 1 || authorized.plan[0]?.action !== "update_settings" ||
          authorized.plan[0]?.scope.target !== "planner_item" ||
          authorized.plan[0]?.scope.kind !== payload["kind"] ||
          authorized.plan[0]?.scope.title !== payload["title"] ||
          authorized.plan[0]?.scope.body !== payload["body"]) throw new Error("The approved Planner item did not match.");
      if (!onCreatePlannerItem(payload["kind"], payload["title"], payload["body"])) throw new Error("The Planner item could not be added.");
      await finishRexOperationApproval({ data: { approvalId, ok: true, result: "Added the approved " + payload["kind"] + " to Planner." } });
      const tag = "[[REX_PLANNER_CREATE_APPROVAL:" + encodeURIComponent(JSON.stringify(payload)) + "]]";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_PLANNER_CREATE_DONE]]") }
        : message));
      const reply = "Added **" + payload["title"] + "** to your Planner as a " + payload["kind"] + ".";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Planner item added.");
    } catch (error) {
      if (approvalId) { try { await finishRexOperationApproval({ data: { approvalId, ok: false, result: "Planner item creation failed." } }); } catch {} }
      const reply = error instanceof Error ? error.message : "The Planner item was not added.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveWorkspaceSetting(payload: { settingKey: string; settingValue: string }, automatic = false) {
    if (busy && !automatic) return;
    if (!onUpdateWorkspaceSetting) { toast.error("Workspace setting updates are not connected."); return; }
    setBusy(true);
    let approvalId = "";
    try {
      const scope = { target: "app_setting", settingKey: payload.settingKey, settingValue: payload.settingValue };
      const receipt = await createRexOperationApproval({ data: {
        title: "Update workspace setting",
        summary: "Change only " + payload.settingKey + " to " + payload.settingValue + ".",
        plan: [{ action: "update_settings", label: "Apply the exact workspace preference", scope }],
      } });
      approvalId = receipt.approval.id;
      const authorized = await consumeRexOperationApproval({ data: { approvalId } }) as any;
      if (authorized.plan.length !== 1 || authorized.plan[0]?.action !== "update_settings" ||
          authorized.plan[0]?.scope.target !== "app_setting" ||
          authorized.plan[0]?.scope.settingKey !== payload.settingKey ||
          authorized.plan[0]?.scope.settingValue !== payload.settingValue) throw new Error("The approved setting change did not match.");
      if (!onUpdateWorkspaceSetting(payload.settingKey, payload.settingValue)) throw new Error("That setting value is not valid for this workspace.");
      await finishRexOperationApproval({ data: { approvalId, ok: true, result: "Updated " + payload.settingKey + " to " + payload.settingValue + "." } });
      const tag = "[[REX_SETTING_UPDATE_APPROVAL:" + encodeURIComponent(JSON.stringify(payload)) + "]]";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_SETTING_UPDATE_DONE]]") }
        : message));
      const reply = "Updated " + payload.settingKey + " to " + payload.settingValue + ".";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Workspace setting updated.");
    } catch (error) {
      if (approvalId) { try { await finishRexOperationApproval({ data: { approvalId, ok: false, result: "Workspace setting update failed." } }); } catch {} }
      const reply = error instanceof Error ? error.message : "The workspace setting was not updated.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveTemplateWrite(payload: { slot: "A" | "B"; subject: string; body: string }) {
    if (busy) return;
    if (!onApplyCampaignTemplate) { toast.error("Campaign template editing is not connected."); return; }
    setBusy(true);
    let approvalId = "";
    try {
      const scope = { target: "campaign_template", slot: payload.slot, subject: payload.subject, body: payload["body"] };
      const receipt = await createRexOperationApproval({ data: {
        title: "Update Template " + payload.slot,
        summary: "Write the exact approved subject and email body into Template " + payload.slot + ". This does not send any email.",
        plan: [{ action: "update_settings", label: "Apply campaign email content to Template " + payload.slot, scope }],
      } });
      approvalId = receipt.approval.id;
      const authorized = await consumeRexOperationApproval({ data: { approvalId } }) as any;
      if (authorized.plan.length !== 1 || authorized.plan[0]?.action !== "update_settings" ||
          authorized.plan[0]?.scope.target !== "campaign_template" ||
          authorized.plan[0]?.scope.slot !== payload.slot ||
          authorized.plan[0]?.scope.subject !== payload.subject ||
          authorized.plan[0]?.scope.body !== payload["body"]) throw new Error("The approved template content did not match.");
      onApplyCampaignTemplate(payload.slot, payload.subject, payload["body"]);
      await finishRexOperationApproval({ data: { approvalId, ok: true, result: "Applied the approved subject and body to Template " + payload.slot + ". No email was sent." } });
      const tag = "[[REX_TEMPLATE_WRITE_APPROVAL:" + encodeURIComponent(JSON.stringify(payload)) + "]]";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_TEMPLATE_WRITE_DONE]]") }
        : message));
      const reply = "Applied the approved subject and body to Template " + payload.slot + " in the active campaign workspace. You can keep working with me here; no email was sent.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Campaign content updated in the active workspace.");
    } catch (error) {
      if (approvalId) { try { await finishRexOperationApproval({ data: { approvalId, ok: false, result: "Template update failed." } }); } catch {} }
      const reply = error instanceof Error ? error.message : "The campaign template was not updated.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveMemoryDelete(memoryId: string, automatic = false) {
    if (busy && !automatic) return;
    setBusy(true);
    try {
      await deleteLocalRexMemoryEntry(uid, memoryId);
      const tag = "[[REX_MEMORY_DELETE_APPROVAL:" + encodeURIComponent(JSON.stringify({ memoryId })) + "]]";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_MEMORY_DELETE_DONE]]") }
        : message));
      const reply = "Removed the approved memory from this device.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Local Rex memory updated.");
    } catch (error) {
      const reply = error instanceof Error ? error.message : "The local memory could not be updated.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  async function approveMemorySave(payload: { category: string; content: string }, automatic = false) {
    if (busy && !automatic) return;
    setBusy(true);
    try {
      await saveLocalRexMemoryEntry(uid, payload.category, payload.content);
      const tag = "[[REX_MEMORY_SAVE_APPROVAL:" + encodeURIComponent(JSON.stringify(payload)) + "]]";
      const reply = "Saved this memory on this device for future Rex conversations under " + payload.category + ".";
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes(tag)
        ? { ...message, content: message.content.replace(tag, "[[REX_MEMORY_SAVE_DONE]]") }
        : message));
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.success("Rex memory saved on this device.");
    } catch (error) {
      const reply = error instanceof Error ? error.message : "The memory was not saved on this device.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  async function stageCampaignDraftUpload(raw: string, fileName: string) {
    const draft = String(raw ?? "").replace(/\\u0000/g, "").trim();
    if (!draft) throw new Error("This campaign draft file is empty.");
    if (draft.length > 80_000) throw new Error("Campaign draft files must be 80 KB or smaller.");
    setText("Please review this uploaded campaign draft from " + fileName + " and help me prepare it. Nothing has been sent.\\n\\n" + draft);
    toast.success("Campaign draft loaded into Rex. Review it and press Send when ready.");
  }

  function cancelRecipientImport() {
    if (!pendingImport) return;
    setPendingImport(null);
    setMsgs(current => current.map(message => message.role === "assistant" && (message.content.includes("[[REX_IMPORT_APPROVAL]]") || message.content.includes("[[REX_IMPORT_STAGED]]"))
      ? { ...message, content: message.content.replace("[[REX_IMPORT_APPROVAL]]", "[[REX_IMPORT_CANCELLED]]").replace("[[REX_IMPORT_STAGED]]", "[[REX_IMPORT_CANCELLED]]") }
      : message));
    toast.info("Recipient import cancelled. No file was imported.");
  }

  async function approveRecipientImport(automatic = false) {
    if ((busy && !automatic) || !pendingImport) return;
    if (pendingImport.campaignWorkflow) {
      const reply = "The old combined import-and-send approval is no longer used. I will stage the list, prepare the agreed message, and show a separate final campaign approval. No email has been sent.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      return;
    }
    if (!onImportRecipients) { toast.error("File import is not connected to this workspace."); return; }
    setBusy(true);
    try {
      const imported = onImportRecipients(pendingImport.raw, pendingImport.fileName);
      if (!imported) throw new Error("The recipient file could not be imported. Nothing was changed.");
      const resultText = "Imported " + pendingImport.emailCount.toLocaleString() + " email-like entries into your active Recipients workspace. No campaign was prepared or sent.";
      setPendingImport(null);
      setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes("[[REX_IMPORT_APPROVAL]]")
        ? { ...message, content: message.content.replace("[[REX_IMPORT_APPROVAL]]", "[[REX_IMPORT_DONE]]") }
        : message));
      setMsgs(current => [...current, { role: "assistant", content: resultText }]);
      await persistMessage("assistant", resultText);
      toast.success("Recipient file imported.");
    } catch (error) {
      const reply = error instanceof Error ? error.message : "Recipient import failed.";
      setMsgs(current => [...current, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
      toast.error(reply);
    } finally { setBusy(false); }
  }

  


  function isClearSendCommand(text: string): boolean {
    const q = text.trim().toLowerCase();
    if (!q) return false;
    if (/\b(do not|don't|never|stop)\s+(send|execute|start|launch)\b/i.test(q)) return false;
    // bare send / execute / launch / go ahead
    if (/^(ok|okay|yes|yeah|yep|sure|fine|alright|please|now)?\s*(send|execute|start|launch)(\s+it)?\s*[.!]?$/i.test(q)) return true;
    if (/^(go ahead|do it|proceed|confirm)\s*[.!]?$/i.test(q)) return true;
    if (/\b(send|execute|start|launch)\s+(it|that|this|them|now|the\s+(campaign|email|message|list))\b/i.test(q)) return true;
    if (/\b(i want|i need|please|go ahead and)\s+(you to\s+)?(send|execute|start|launch)\b/i.test(q)) return true;
    if (/\b(send|execute)\s+(to\s+)?(everyone|all|the\s+list)\b/i.test(q)) return true;
    return false;
  }



  async function stageRecipientImport(raw: string, fileName: string, campaignWorkflow: boolean, deferApproval = false) {
    if (pendingImport) {
      toast.error("A recipient list is already staged in this conversation. Send it, import it explicitly, or discard it first.");
      return;
    }
    if (new Blob([raw]).size > 5 * 1024 * 1024) {
      toast.error("Recipient lists must be 5 MB or smaller.");
      return;
    }
    const emails = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    if (!emails.length) { toast.error("No email addresses were found in this recipient list."); return; }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    setPendingImport({ raw, fileName, sha256, byteLength: new Blob([raw]).size, emailCount: emails.length, campaignWorkflow });
    const staged = deferApproval
      ? `I've staged your recipient list here in Rex (${emails.length.toLocaleString()} email addresses). It has NOT been imported into your active Recipients workspace. Let's agree on the message first; I will only transfer the list and prepare the campaign after you explicitly tell me to send it. Nothing has been sent.`
      : `I've received **${fileName}** (${emails.length.toLocaleString()} email-like entries) and staged it in this conversation. Nothing has been imported. Tell me whether you want to import the list on its own or use it for a campaign.`;
    setMsgs(current => [...current, { role: "assistant", content: staged }]);
    await persistMessage("assistant", staged);
  }

  async function confirmLogoutFromCard() {
    setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes("[[REX_LOGOUT_APPROVAL]]")
      ? { ...message, content: message.content.replace("[[REX_LOGOUT_APPROVAL]]", "[[REX_LOGOUT_DONE]]") }
      : message));
    await onConfirmLogout?.();
  }

  async function send(q: string) {
    const content = q.trim();
    if (!content || busy || !historyReady) return;
    const pastedEmails = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    const explicitListImport = /\b(import|load|add|paste|use)\b.{0,45}\b(list|recipients|contacts|emails?|addresses?)\b/i.test(content);
    const recipientContext = /\b(recipient|leads?|contacts?|campaign|outreach|email list|address list|people|customers|subscribers)\b/i.test(content);
    const priorRecipientContext = msgs.some(message => message.role === "user" &&
      /\b(recipient|leads?|contacts?|campaign|outreach|email list|address list|people|customers|subscribers|validate|send|execute)\b/i.test(message.content));
    const plainEmailList = pastedEmails.length >= 1 && content.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "").replace(/[\s,;|<>()[\]]+/g, "").length <= 40;
    // Attach pasted addresses to the active conversation when it is already about recipients or sending.
    const isRecipientPaste = Boolean(onImportRecipients) && pastedEmails.length > 0 &&
      (explicitListImport || recipientContext || priorRecipientContext || plainEmailList);
    const attached = pendingAttachments;
    const safeInstruction = content.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[recipient email]").trim();
    const safeUserTurn = isRecipientPaste
      ? "[Recipient list pasted: " + pastedEmails.length + " email addresses. The list is staged privately and has not been imported.]\n" + safeInstruction
      : content;
    const next = [...msgs, { role: "user" as const, content: safeUserTurn, ...(attached.length ? { attachments: attached } : {}) }];
    setPendingAttachments([]);
    setMsgs(next);
    setText("");
    setBusy(true);
    setSuggests([]);
    try {
      // Save every user turn before command-specific early returns. Recipient
      // addresses remain redacted in local conversation history.
      await persistMessage("user", safeUserTurn);
      // A direct request to remove a previously drafted subject is a narrow
      // workspace edit. Handle it deterministically so a model reply cannot
      // incorrectly insist that a subject is mandatory. The message body is
      // copied from the immediately preceding Rex draft and left unchanged.
      const explicitSubjectRemoval = /\b(?:remove|delete|drop|omit|clear|take out)\s+(?:the\s+)?subject\b|\b(?:without (?:a |the )?subject|no subject|leave (?:the )?subject blank|don['’]t (?:add|include|write) (?:a )?subject|(?:i\s+)?(?:do not|don['’]?t|dont)\s+want\s+(?:any\s+)?(?:email\s+)?subject)\b|\bsubject\b.{0,40}\bcompletely blank\b|\bcompletely blank\b.{0,40}\bsubject\b/i;
      const explicitlyRemoveSubject = explicitSubjectRemoval.test(content);
      const affirmativeReply = /^(?:yes|yeah|yep|correct|exactly|please do|do that|sure)[.!\s]*$/i.test(content);
      const lastAssistantAskedSubjectChoice = [...msgs].reverse().find(message => message.role === "assistant")?.content
        .match(/(?:placeholder|short subject|clear out the subject line)/i);
      const priorUserExplicitlyRemovedSubject = [...msgs].reverse().some(message =>
        message.role === "user" && explicitSubjectRemoval.test(message.content)
      );
      // If Rex asks a follow-up choice after the user already requested removal,
      // a simple "yes" means leave the field genuinely blank—not "(No subject)".
      const confirmsBlankSubject = affirmativeReply && Boolean(lastAssistantAskedSubjectChoice) && priorUserExplicitlyRemovedSubject;
      if ((explicitlyRemoveSubject || confirmsBlankSubject) && onApplyCampaignTemplate) {
        const previousDraft = [...msgs].reverse().find(message =>
          message.role === "assistant" && /(?:\*\*Subject:\*\*|Subject:)\s*[^\n]*/i.test(message.content)
        );
        const subjectMatch = previousDraft?.content.match(/(?:\*\*Subject:\*\*|Subject:)\s*[^\n]*\n+/i);
        if (previousDraft && subjectMatch?.index !== undefined) {
          const slot = /Template\s+B/i.test(previousDraft.content) ? "B" : "A";
          let body = previousDraft.content.slice(subjectMatch.index + subjectMatch[0].length).trim();
          body = body.replace(/\n+Applied to Template [AB] in your workspace\. Nothing was sent\.?\s*$/i, "").trim();
          body = body.replace(/\n+Applied to Template [AB]\.?\s*$/i, "").trim();
          if (body) {
            onApplyCampaignTemplate(slot, "", body);
            const reply = "Removed the subject from Template " + slot + ". The existing email body was kept unchanged. Nothing was sent.";
            setLastSource("local");
            setSuggests([]);
            setMsgs([...next, { role: "assistant", content: reply }]);
            await persistMessage("assistant", reply);
            return;
          }
        }
      }

      // HARD RULE: delay — set send interval (3–8 seconds) without approval
      {
        const dm = content.trim().match(/\b(?:set\s+)?(?:delay|interval|gap)\s*(?:to\s*|[=:]\s*)?(\d)\s*(?:s|sec|secs|seconds)?\b/i)
          || content.trim().match(/\b(\d)\s*(?:s|sec|secs|seconds)\s+(?:delay|interval|gap)\b/i);
        if (dm && onUpdateWorkspaceSetting) {
          const sec = Number(dm[1]);
          if (sec >= 3 && sec <= 8) {
            const ok = onUpdateWorkspaceSetting("campaign.delay", String(sec));
            const note = ok
              ? ("Send delay set to " + sec + " seconds between emails.")
              : ("Could not set delay to " + sec + "s. Use 3–8 only.");
            setLastSource("local");
            setSuggests([]);
            setMsgs([...next, { role: "assistant", content: note }]);
            await persistMessage("assistant", note);
            return;
          }
        }
      }

      // HARD RULE: pause/stop/resume — immediate, no approval card
      {
        const cmd = content.trim().toLowerCase();
        const wantsStop = /^(please\s+)?(stop|halt|cancel)(\s+(it|the\s+campaign|sending|campaign))?\s*[.!]?$/.test(cmd)
          || /\b(stop|halt)\s+(the\s+)?(campaign|sending|execution)\b/.test(cmd);
        const wantsPause = /^(please\s+)?(pause|hold)(\s+(it|the\s+campaign|sending))?\s*[.!]?$/.test(cmd)
          || /\bpause\s+(the\s+)?(campaign|sending|execution)\b/.test(cmd);
        const wantsResume = /^(please\s+)?(resume|continue|unpause)(\s+(it|the\s+campaign|sending))?\s*[.!]?$/.test(cmd)
          || /\b(resume|continue)\s+(the\s+)?(campaign|sending)\b/.test(cmd);
        if (wantsStop || wantsPause || wantsResume) {
          let note = "";
          let ok = false;
          if (wantsStop) {
            ok = Boolean(onStopCurrentCampaign && onStopCurrentCampaign());
            note = ok ? "Campaign stopped." : "Nothing to stop right now (or stop is locked in Rex Studio Monitor).";
          } else if (wantsPause) {
            ok = Boolean(onPauseCurrentCampaign && onPauseCurrentCampaign());
            note = ok ? "Campaign paused." : "Nothing to pause right now (or pause is locked in Rex Studio Monitor).";
          } else {
            ok = onExecuteCurrentCampaign ? await onExecuteCurrentCampaign() : false;
            note = ok ? "Campaign resumed." : "Could not resume. Check Elite Engine.";
          }
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: note }]);
          await persistMessage("assistant", note);
          return;
        }
      }

      // SEND COMMAND: import staged list, prepare workspace campaign, show Approve. No Gemini rewrite. No validate gate.
      if (isClearSendCommand(content)) {
        const existingApproval = [...msgs].reverse().find(message =>
          message.role === "assistant" && message.content.includes("[[APPROVE_CAMPAIGN:")
        );
        if (existingApproval) {
          const match = existingApproval.content.match(/\[\[APPROVE_CAMPAIGN:([a-z0-9-]+):([^:\]]+):(send|schedule)\]\]/i);
          if (match) {
            setBusy(false);
            await approveCampaignFromCard(match[1]!, match[2]!, match[3] === "schedule" ? "schedule" : "send");
            return;
          }
        }
        if (!onPrepareCampaign || !onExecuteCurrentCampaign) {
          const fail = "Campaign send is not connected in this workspace session. Nothing was sent.";
          setMsgs([...next, { role: "assistant", content: fail }]);
          await persistMessage("assistant", fail);
          return;
        }
        try {
          let note = "";
          if (pendingImport && onImportRecipients) {
            const ok = onImportRecipients(pendingImport.raw, pendingImport.fileName);
            setPendingImport(null);
            if (!ok) {
              const why = (typeof window !== "undefined" && (window as any).__ecLastImportError)
                ? String((window as any).__ecLastImportError)
                : "Could not import the staged list into Recipients.";
              throw new Error(why);
            }
            note = " List imported.";
            await new Promise<void>(r => setTimeout(r, 120));
          }
          // prepareCurrentCampaignForRex validates internally when needed — do not gate on separate validate()
          const prepared = await onPrepareCampaign();
          let preview: { recipientCount?: number; subject?: string; body?: string } = {};
          try { preview = JSON.parse(prepared) as typeof preview; } catch {}
          const recipientCount = Number(preview.recipientCount ?? 0);
          const subject = String(preview.subject ?? "").trim();
          const body = String(preview.body ?? "").trim();
          if (!body) {
            throw new Error("There is no message body in the workspace yet. Add a message (or Template A/B), then say OK send again. A subject is optional.");
          }
          if (recipientCount < 1) {
            throw new Error("No eligible recipients in the workspace yet. Import a list first, then say OK send.");
          }
          const campaignId = "engine-approval-" + crypto.randomUUID();
          engineSessionApprovalIds.current.add(campaignId);
          const toolReply =
            "Ready to send." + note +
            "\n\nRecipients: " + recipientCount.toLocaleString() +
            "\n\nSubject: " + subject +
            "\n\nMessage:\n" + body +
            "\n\nNothing has been sent yet. Tap **Approve & Send Now** (or reply yes)." +
            "\n\n[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: toolReply }]);
          await persistMessage("assistant", toolReply);
          return;
        } catch (error) {
          const fail = error instanceof Error ? error.message : "Send preparation failed. Nothing was sent.";
          setMsgs([...next, { role: "assistant", content: fail }]);
          await persistMessage("assistant", fail);
          return;
        }
      }

      if (isRecipientPaste) {
        // User turn was saved above in redacted form.
        await stageRecipientImport(content, "Pasted into Rex chat", false, true);
        const stagedAssistantTurn = "Staged **" + pastedEmails.length.toLocaleString() + " recipients** privately (list hidden in chat — open Recipients to see them). Agree the message, then say **OK send** — I will import, validate, and show Approve. Nothing has been sent.";
        next.push({ role: "assistant", content: stagedAssistantTurn });
        const remainingInstruction = safeInstruction
          .replace(/\[recipient email\]/gi, "")
          .replace(/\b(?:here are|these are|the following are|my|the|a|an|list of|email|emails|addresses|address|contacts|recipients|recipient list|contact list|list|below|please|kindly)\b/gi, "")
          .replace(/[^a-z0-9]/gi, "");
        if (!remainingInstruction) return;
      }
      if (pendingImport && /\b(cancel|discard)\b/i.test(content)) {
        cancelRecipientImport();
        const reply = "The staged recipient file was discarded. Nothing was imported.";
        setMsgs(current => [...current, { role: "assistant", content: reply }]);
        await persistMessage("assistant", reply);
        return;
      }
      const previewRequest = /\b(show|see|read|preview|review|display|explain|what is|which is|what's)\b.{0,60}\b(message|email|draft|subject|body|content)\b|\b(message|email|draft|subject|body|content)\b.{0,40}\b(first|before|please show|let me see)\b/i.test(content);
      const finalSendConfirmation = /^(?:(?:ok|okay|yes|yeah|yep)[,!\s]*)?(?:send(?: it| that| this| them| now)?|let'?s (?:send|execute)|go ahead(?: and)? (?:send|execute|start|launch)|execute(?: it| now| the campaign)?|start (?:sending|the campaign)|launch (?:it|the campaign)|approve(?: and send)?)(?:[.!\s]*)$/i.test(content.trim());
      const explicitImportOnly = /^(?:(?:ok|okay|yes)[,!\s]*)?(?:import|load|add) (?:it|the list|the file)(?:[.!\s]*)$/i.test(content.trim());
      if (pendingImport && previewRequest) {
        // A request to inspect or revise the message is discussion, never approval.
        setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes("[[REX_IMPORT_APPROVAL]]")
          ? { ...message, content: message.content.replace("[[REX_IMPORT_APPROVAL]]", "[[REX_IMPORT_STAGED]]") }
          : message));
        // Continue to Rex so the user can review the actual message before authorizing anything.
      } else if (pendingImport && finalSendConfirmation) {
        const lastAssistantTurn = [...msgs].reverse().find(message => message.role === "assistant");
        const hasReviewedDraft = Boolean(lastAssistantTurn &&
          /(?:subject\s*:?|\*\*subject\*\*)/i.test(lastAssistantTurn.content) &&
          /(?:body|message)\s*:?/i.test(lastAssistantTurn.content) &&
          !lastAssistantTurn.content.includes("[[REX_IMPORT_APPROVAL]]"));
        if (!hasReviewedDraft) {
          const reply = "I have the recipient list staged, but we haven't agreed on the actual email yet. Let's write and review the subject and message first. Nothing has been imported or sent.";
          setMsgs([...next, { role: "assistant", content: reply }]);
          await persistMessage("assistant", reply);
          return;
        }
        // Keep the list staged. The assistant now hands the explicit send
        // instruction to the campaign workflow, which imports and validates
        // it before showing the separate final send approval.
        setPendingImport({ ...pendingImport, campaignWorkflow: true });
      } else if (pendingImport && explicitImportOnly) {
        if (!onImportRecipients || !onImportRecipients(pendingImport.raw, pendingImport.fileName)) {
          const failure = "I couldn't import the staged recipient list. Nothing was changed.";
          setMsgs([...next, { role: "assistant", content: failure }]);
          await persistMessage("assistant", failure);
          return;
        }
        setPendingImport(null);
        const imported = "Imported " + pendingImport.emailCount.toLocaleString() + " email-like entries into your active Recipients workspace. No campaign was prepared or sent.";
        setMsgs([...next, { role: "assistant", content: imported }]);
        await persistMessage("assistant", imported);
        return;
      } else if (pendingImport && /\b(cancel|discard)\b/i.test(content)) {
        cancelRecipientImport();
        const reply = "The staged recipient file was discarded. Nothing was imported.";
        setMsgs([...next, { role: "assistant", content: reply }]);
        await persistMessage("assistant", reply);
        return;
      }
      const explicitLogoutRequest = /\b(?:log\s+me\s+out|sign\s+me\s+out|log\s+you\s+out|sign\s+you\s+out|log\s+out\s+of\s+(?:my\s+)?account|sign\s+out\s+of\s+(?:my\s+)?account|please\s+log\s+out|please\s+sign\s+out|i\s+want\s+to\s+log\s+out|i\s+want\s+to\s+sign\s+out|create\s+(?:a\s+)?(?:logout|sign[- ]out)\s+approval)\b|\b(?:create|build|make|prepare)\b.{0,80}\b(?:personal\s+destination|logout|sign[- ]out)\b/i.test(content);
      if (explicitLogoutRequest) {
        let destinationLink = "";
        if (/\b(?:personal\s+destination|destination\s+page)\b/i.test(content) && /\b(?:create|build|make|prepare)\b/i.test(content)) {
          try {
            const created = await createRexPersonalDestination({ data: {
              name: "Sign-out approval",
              description: "A saved personal destination for the account sign-out workflow.",
              sections: [
                { title: "Purpose", content: "This destination records the sign-out workflow for your Elite Connectere account." },
                { title: "Approval and safety", content: "The actual sign-out approval is presented in Rex chat. Your session remains active unless you explicitly tap Confirm sign-out. Cancel leaves you signed in." },
                { title: "How to use", content: "Return to the Rex conversation and use the Sign-out approval card. Opening this destination does not sign you out." },
              ],
            } });
            destinationLink = "\n\nYour personal destination has been created: [[DESTINATION_LABEL:" + encodeURIComponent(created.destination.name) + "]] [[GO:rex-destination-" + created.destination.id + "]]";
          } catch (error) {
            destinationLink = "\n\nI couldn't create the personal destination: " + (error instanceof Error ? error.message : "the save failed.") + " The in-chat approval below is still available.";
          }
        }
        const reply = "I can sign you out, but I will not end your session without your explicit confirmation. Review this approval and choose Confirm sign-out or Cancel. [[REX_LOGOUT_APPROVAL]]" + destinationLink;
        setLastSource("local");
        setSuggests([]);
        setMsgs([...next, { role: "assistant", content: reply }]);
        await persistMessage("assistant", reply);
        return;
      }
      let campaignReply: string | null = null;
      let campaignCheckIssue: string | null = null;
      try {
        // While a recipient list is staged, only the dedicated final-confirmation
        // path may create a send approval. Discussion must never trigger it.
        if (!pendingImport) campaignReply = await runRexCampaignCommand(content);
      } catch (error) {
        campaignCheckIssue = error instanceof Error ? error.message : "The local campaign readiness check failed.";
      }
            if (campaignReply === "[[TYPED_APPROVE_CAMPAIGN]]") {
        const pending = [...msgs].reverse().find(message =>
          message.role === "assistant" && /\[\[APPROVE_CAMPAIGN:[^:]+:/.test(message.content)
        );
        const match = pending?.content.match(/\[\[APPROVE_CAMPAIGN:([a-z0-9-]+):([^:]+):(send|schedule)\]\]/i);
        if (match) {
          setBusy(false);
          await approveCampaignFromCard(match[1]!, match[2]!, match[3] === "schedule" ? "schedule" : "send");
          return;
        }
        const tip = "I could not find an active campaign approval card. Ask me to prepare the campaign again, then tap Approve or reply yes.";
        setMsgs([...next, { role: "assistant", content: tip }]);
        await persistMessage("assistant", tip);
        return;
      }

      if (campaignReply) {
        // This response came from a deterministic app workflow, not the AI model.
        setLastSource("local");
        setSuggests([]);
        setMsgs([...next, { role: "assistant", content: campaignReply }]);
        await persistMessage("assistant", campaignReply);
        return;
      }
      // Give Rex a fresh, owner-scoped snapshot of the enabled active workspace
      // areas on every turn. Reading this context is ordinary assistant work;
      // outbound campaign and Private Chat sends remain separately approval-gated.
      const requestAccount: AssistAccount = {};
      if (memorySettings.rememberContext) {
        try {
          requestAccount["localMemoryContext"] = await buildLocalRexMemoryContext(uid, conversationId.current, 8000);
        } catch (memoryError) {
          console.warn("[Rex] Device-local memory could not be read:", memoryError);
        }
      }
      try {
        if (onReadActiveWorkspace) {
          const preferences = await getLocalRexConfig(uid);
          const enabledAreas = [
            "campaign_summary", "recipients", "drafts", "sending_capacity",
            "campaign_runs", "activity", "planner", "smart_fill_history",
          ];
          if (enabledAreas.length) {
            const snapshot = await onReadActiveWorkspace(enabledAreas);
            requestAccount["approvedWorkspaceContext"] = JSON.stringify(snapshot ?? {}).slice(0, 22_000);
            requestAccount["approvedWorkspaceAreas"] = enabledAreas.join(",");
          }
        }
      } catch (workspaceContextError) {
        // A live snapshot failure must not prevent ordinary Gemini conversation.
        console.warn("[Rex] Active workspace context could not be refreshed:", workspaceContextError);
      }
      // Live session always keeps recent turns for the model so "More details" and follow-ups work
      // even when long-term memory / history is off. saveHistory only controls DB persistence.
      const contextMessages = next.slice(-12);
      // If a deterministic operation could not prepare the action, give the AI
      // the exact failure so it can explain the blocker without claiming success.
      const aiMessages = campaignCheckIssue
        ? [...contextMessages, { role: "assistant" as const, content: "[Internal operation result — explain this blocker to the user and do not claim execution succeeded. No approval or send occurred.] Campaign preparation failed: " + campaignCheckIssue }]
        : [...contextMessages];
      // Give Rex typo-tolerant discovery hints for this request without limiting
      // his reasoning to the examples or the top matches. The complete registered
      // destination catalog remains available in the server-side system context.
      const latestUserText = [...contextMessages].reverse().find(message => message.role === "user")?.content ?? content;
      const discoveryMatches = searchApplicationCatalog(latestUserText, 10, searchResources);
      if (discoveryMatches.length) {
        aiMessages.push({
          role: "assistant" as const,
          content: "[Application discovery hints — NOT a whitelist or capability limit. These are ranked possible destinations based on spelling, wording and meaning. Consider the user's full intent, inspect the complete registered destination catalog already provided to you, and choose any correct destination even if it is not listed here. If uncertain, ask a concise clarification. Never claim an unregistered operation is available.]\n" +
            discoveryMatches.map(item => "- " + item.place + " (" + item.kind + "): " + item.purpose + " [match " + Math.round(item.score * 100) + "%]").join("\n"),
        });
      }
      const result = await askEliteAssist({ data: { messages: aiMessages, account: requestAccount, conversationId: conversationId.current } });
      const rawReply =
        typeof result?.reply === "string" && result.reply.trim()
          ? result.reply
          : "Tell me what you're trying to do in the app — I'll answer that directly.";
      const isExplicitSendRequest = (text: string) =>
        /\b(?:send|execute|start|launch)\b/i.test(text) &&
        !/\b(?:do not|don't|never)\s+(?:send|execute|start|launch)\b/i.test(text) &&
        (
          /\b(?:send|execute|start|launch)\s+(?:it|that|this|them|these|those|the|my|our)\b/i.test(text) ||
          /^\s*(?:(?:okay|ok|yes|please|now|go ahead)\s+)*(?:send|execute|start|launch)\b/i.test(text) ||
          /\b(?:i want|i need|please|go ahead and)\s+(?:you to\s+)?(?:send|execute|start|launch)\b/i.test(text)
        );

      const recipientDraftMatch = rawReply.match(/\[\[REX_RECIPIENT_DRAFT:([^\]]+)\]\]/);
      if (recipientDraftMatch?.[1]) {
        try {
          const draft = JSON.parse(decodeURIComponent(recipientDraftMatch[1])) as { subject?: unknown; body?: unknown };
          const subject = /\b(without (?:a |the )?subject|no subject|leave (?:the )?subject blank|don['’]t (?:add|include|write) (?:a )?subject)\b/i.test(content) ? "" : (typeof draft.subject === "string" ? draft.subject.trim().slice(0, 200) : "");
          const body = typeof draft.body === "string" ? draft.body.trim().slice(0, 2000) : "";
          if (body) {
            const readableDraft = rawReply.replace(recipientDraftMatch[0], "").trim();
            if (!isExplicitSendRequest(content)) {
              const discussion = readableDraft + "\n\nApplied to Template A in your workspace. Nothing was sent.";
              setLastSource("ai");
              setSuggests([]);
              setMsgs([...next, { role: "assistant", content: discussion }]);
              await persistMessage("assistant", discussion);
              return;
            }

            if (!onApplyCampaignTemplate || !onPrepareCampaign || !onExecuteCurrentCampaign) {
              throw new Error("I have the message, but the campaign workflow is not fully connected. Nothing was added to a template or sent.");
            }
            onApplyCampaignTemplate("A", subject, body);
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            let importValidationSummary = "";
            if (pendingImport) {
              if (!onImportRecipients || !onImportRecipients(pendingImport.raw, pendingImport.fileName)) {
                const why = (typeof window !== "undefined" && (window as any).__ecLastImportError) ? String((window as any).__ecLastImportError) : "";
                throw new Error((why || "I could not import the staged list into the Recipients workspace.") + " Nothing was sent.");
              }
              setPendingImport(null);
              await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
              if (onValidateRecipients) {
                const validation = await onValidateRecipients();
                if (!validation.ok) { importValidationSummary = (importValidationSummary || "") + " Validation will finish on prepare."; }
                importValidationSummary = " Recipient checks: " + validation.valid + " valid, " + validation.risky + " risky, " + validation.duplicate + " duplicate.";
              }
            }
            const prepared = await onPrepareCampaign();
            const preview = JSON.parse(prepared) as { recipientCount?: number; subject?: string; body?: string };
            const recipientCount = Number(preview.recipientCount ?? 0);
            const previewSubject = String(preview.subject ?? subject).trim();
            const previewBody = String(preview.body ?? body).trim();
            if (!recipientCount || !previewBody) {
              throw new Error("The message was placed in Template A, but I could not prepare a complete recipient and message preview. Nothing was sent.");
            }
            const campaignId = "engine-approval-" + crypto.randomUUID();
            engineSessionApprovalIds.current.add(campaignId);
            const finalPreview = "I added the approved draft to Template A and prepared the campaign for " + recipientCount.toLocaleString() + " eligible recipients." + importValidationSummary + (previewSubject ? "\n\nSubject: " + previewSubject : "\n\nNo subject") + "\n\nMessage:\n" + previewBody + "\n\nPlease review this exact campaign. Nothing has been sent.\n\n[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]";
            setLastSource("ai");
            setSuggests([]);
            setMsgs([...next, { role: "assistant", content: finalPreview }]);
            await persistMessage("assistant", finalPreview);
            return;
          }
        } catch (error) {
          const failed = error instanceof Error ? error.message : "The draft could not be prepared.";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: failed }]);
          await persistMessage("assistant", failed);
          return;
        }
      }

      // Execute every explicit NOW action emitted by the server. Keep each
      // action routed through its existing, scope-checked handler so commands
      // never leak into the visible conversation as internal marker text.
      const automaticAction = rawReply.match(/\[\[(REX_CHAT_READ_NOW|REX_WORKSPACE_READ_NOW|REX_ACTIVE_WORKSPACE_READ_NOW|REX_WORKSPACE_EXPORT_NOW|REX_ACTIVE_WORKSPACE_EXPORT_NOW|REX_MEMORY_SAVE_NOW|REX_MEMORY_DELETE_NOW|REX_PLANNER_CREATE_NOW|REX_SMART_FILL_NOW):([^\]]+)\]\]/i);
      if (automaticAction?.[1] && automaticAction[2]) {
        try {
          const payload = JSON.parse(decodeURIComponent(automaticAction[2])) as Record<string, unknown>;
          const action = automaticAction[1].toUpperCase();
          setLastSource("local");
          setSuggests([]);
          switch (action) {
            case "REX_CHAT_READ_NOW": {
              const contactName = typeof payload["contactName"] === "string" ? payload["contactName"] : "";
              const limit = Number.isFinite(Number(payload["limit"])) ? Math.max(1, Math.min(30, Math.floor(Number(payload["limit"])))) : 15;
              await approveChatRead({ contactName, limit }, true);
              return;
            }
            case "REX_WORKSPACE_READ_NOW": {
              const domain = typeof payload["domain"] === "string" ? payload["domain"] : "";
              if (!domain) throw new Error("The requested workspace data category is missing.");
              await approveWorkspaceRead({ domain, ...(typeof payload["recordId"] === "string" ? { recordId: payload["recordId"] } : {}), ...(payload["limit"] !== undefined ? { limit: Number(payload["limit"]) } : {}) }, true);
              return;
            }
            case "REX_ACTIVE_WORKSPACE_READ_NOW": {
              const areas = Array.isArray(payload["areas"]) ? payload["areas"].filter((item): item is string => typeof item === "string") : [];
              if (!areas.length) throw new Error("The requested live workspace areas are missing.");
              await approveActiveWorkspaceRead(areas, true);
              return;
            }
            case "REX_WORKSPACE_EXPORT_NOW": {
              const domain = typeof payload["domain"] === "string" ? payload["domain"] : "";
              const format = payload["format"] === "json" ? "json" : payload["format"] === "csv" ? "csv" : null;
              if (!domain || !format) throw new Error("The workspace export request is incomplete.");
              await approveWorkspaceExport({ domain, ...(typeof payload["recordId"] === "string" ? { recordId: payload["recordId"] } : {}), ...(payload["limit"] !== undefined ? { limit: Number(payload["limit"]) } : {}), format }, true);
              return;
            }
            case "REX_ACTIVE_WORKSPACE_EXPORT_NOW": {
              const areas = Array.isArray(payload["areas"]) ? payload["areas"].filter((item): item is string => typeof item === "string") : [];
              const format = payload["format"] === "json" ? "json" : payload["format"] === "csv" ? "csv" : null;
              if (!areas.length || !format) throw new Error("The live workspace export request is incomplete.");
              await approveActiveWorkspaceExport({ areas, format }, true);
              return;
            }
            case "REX_MEMORY_SAVE_NOW": {
              const category = typeof payload["category"] === "string" ? payload["category"] : "";
              const memoryContent = typeof payload["content"] === "string" ? payload["content"] : "";
              if (!category || !memoryContent) throw new Error("The memory save request is incomplete.");
              await approveMemorySave({ category, content: memoryContent }, true);
              return;
            }
            case "REX_MEMORY_DELETE_NOW": {
              const memoryId = typeof payload["memoryId"] === "string" ? payload["memoryId"] : "";
              if (!memoryId) throw new Error("The exact saved memory ID is missing.");
              await approveMemoryDelete(memoryId, true);
              return;
            }
            case "REX_PLANNER_CREATE_NOW": {
              const kind = payload["kind"] === "Plan" || payload["kind"] === "Template" ? payload["kind"] : "Note";
              const title = typeof payload["title"] === "string" ? payload["title"] : "";
              const body = typeof payload["body"] === "string" ? payload["body"] : "";
              if (!title.trim() || !body.trim()) throw new Error("The Planner item needs a title and content.");
              await approvePlannerItemCreate({ kind, title, body }, true);
              return;
            }
            case "REX_SMART_FILL_NOW": {
              const allowed = ["save_current_recipients", "load_saved_list", "export_saved_list", "delete_saved_list"] as const;
              const operation = typeof payload["action"] === "string" && allowed.includes(payload["action"] as typeof allowed[number]) ? payload["action"] as typeof allowed[number] : null;
              const name = typeof payload["name"] === "string" ? payload["name"] : "";
              if (!operation || !name.trim()) throw new Error("The Smart Fill request needs a valid operation and list name.");
              await approveSmartFillAction({ action: operation, name }, true);
              return;
            }
          }
        } catch (error) {
          const failed = error instanceof Error ? error.message : "Rex could not complete that automatic action.";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: failed }]);
          await persistMessage("assistant", failed);
          return;
        }
      }

      const snippetCreateNow = rawReply.match(/\[\[REX_SNIPPET_CREATE_NOW:([^\]]+)\]\]/i);
      if (snippetCreateNow?.[1]) {
        try {
          const payload = JSON.parse(decodeURIComponent(snippetCreateNow[1])) as { title?: unknown; subject?: unknown; body?: unknown; category?: unknown };
          const title = typeof payload["title"] === "string" ? payload["title"].trim().slice(0, 120) : "";
          const subject = /\b(without (?:a |the )?subject|no subject|leave (?:the )?subject blank|don['’]t (?:add|include|write) (?:a )?subject|(?:i\s+)?(?:do not|don['’]?t|dont)\s+want\s+(?:any\s+)?(?:email\s+)?subject)\b|\bsubject\b.{0,40}\bcompletely blank\b|\bcompletely blank\b.{0,40}\bsubject\b/i.test(content) ? "" : (typeof payload.subject === "string" ? payload.subject.slice(0, 200) : "");
          const body = typeof payload["body"] === "string" ? payload["body"].trim().slice(0, 4000) : "";
          const categories = ["direct","friendly","partnership","followup","value"] as const;
          const category = typeof payload["category"] === "string" && categories.includes(payload["category"] as typeof categories[number]) ? payload["category"] : "friendly";
          if (!title || !body) throw new Error("A Snippet needs a title and complete message body. A subject is optional.");
          const key = "ec.radar-snippets";
          const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]");
          if (!Array.isArray(existing)) throw new Error("Your Snippets library could not be read safely. Nothing was saved.");
          const item = { id: "rex-" + crypto.randomUUID(), title, subject, body, category, tag: ({direct:"Direct",friendly:"Friendly",partnership:"Partnership",followup:"Follow-up",value:"Value / Resource"} as Record<string,string>)[category] };
          window.localStorage.setItem(key, JSON.stringify([item, ...existing].slice(0, 500)));
          window.dispatchEvent(new CustomEvent("ec-snippets-updated"));
          const saved = "Saved **" + title + "** to Elite Radar Hub → Snippets. " + (subject ? "The subject and message were saved exactly as shown." : "The message was saved without a subject.") + " Nothing was added to Planner or Campaign Templates, and nothing was sent.";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: saved }]);
          await persistMessage("assistant", saved);
          return;
        } catch (error) {
          const failed = error instanceof Error ? error.message : "Rex could not save that Snippet.";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: failed }]);
          await persistMessage("assistant", failed);
          return;
        }
      }

      const templateWriteNow = rawReply.match(/\[\[REX_TEMPLATE_WRITE_NOW:([^\]]+)\]\]/i);
      if (templateWriteNow?.[1]) {
        try {
          const payload = JSON.parse(decodeURIComponent(templateWriteNow[1])) as { slot?: unknown; subject?: unknown; body?: unknown };
          const slot = payload.slot === "B" ? "B" : "A";
          const subject = /\b(without (?:a |the )?subject|no subject|leave (?:the )?subject blank|don['’]t (?:add|include|write) (?:a )?subject)\b/i.test(content) ? "" : (typeof payload.subject === "string" ? payload.subject.slice(0, 200) : "");
          const body = typeof payload["body"] === "string" ? payload["body"].slice(0, 2000) : "";
          if (!body.trim()) throw new Error("I need a message body before I can continue. A subject is optional.");

          // REX_TEMPLATE_WRITE_NOW means apply the template now.
          // Implement/apply does NOT require a send command. Only the prepare+approval path does.
          if (!onApplyCampaignTemplate) {
            throw new Error("Campaign template editing is not connected.");
          }
          onApplyCampaignTemplate(slot, subject, body);

          const wantsSend = typeof isClearSendCommand === 'function' ? isClearSendCommand(content) : isClearSendCommand(content);
          if (!wantsSend) {
            const applied = rawReply.replace(templateWriteNow[0], "").replace("[[REX_PREPARE_CAMPAIGN]]", "").trim();
            const visible = (applied || ("Applied the message to Template " + slot + ".")) +
              "\n\nApplied to Template " + slot + " in your workspace. Nothing was sent.";
            setLastSource("ai");
            setSuggests([]);
            setMsgs([...next, { role: "assistant", content: visible }]);
            await persistMessage("assistant", visible);
            return;
          }

          if (!onPrepareCampaign || !onExecuteCurrentCampaign) {
            throw new Error("The campaign workflow is not fully connected. The template was updated, but send preparation is unavailable.");
          }

          // Explicit send intent: template already applied above; run preflight then request final send approval.
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          let importValidationSummary = "";
          if (pendingImport) {
            if (!onImportRecipients || !onImportRecipients(pendingImport.raw, pendingImport.fileName)) {
              throw new Error("I couldn't transfer the staged recipient list into Elite Engine. Nothing was sent.");
            }
            setPendingImport(null);
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            if (onValidateRecipients) {
            const validation = await onValidateRecipients();
            if (!validation.ok) { importValidationSummary = (importValidationSummary || "") + " Validation will finish on prepare."; }
            importValidationSummary = " Recipient checks: " + validation.valid + " valid, " + validation.risky + " risky, " + validation.duplicate + " duplicate.";
            }
          }
          const prepared = await onPrepareCampaign();
          const preview = JSON.parse(prepared) as { recipientCount?: number; subject?: string; body?: string };
          const recipientCount = Number(preview.recipientCount ?? 0);
          const previewSubject = String(preview.subject ?? subject).trim();
          const previewBody = String(preview.body ?? body).trim();
          if (!recipientCount || !previewBody) {
            throw new Error("The draft was saved to Template " + slot + ", but a complete recipient and message preview could not be prepared. Nothing was sent.");
          }
          const campaignId = "engine-approval-" + crypto.randomUUID();
          engineSessionApprovalIds.current.add(campaignId);
          const finalPreview = "I saved the agreed message in Template " + slot + " and prepared the campaign for " + recipientCount.toLocaleString() + " eligible recipients.\n\nSubject: " + previewSubject + "\n\nMessage:\n" + previewBody + "\n\nReview this exact campaign. Nothing has been sent. Approve only if you want this message sent to these recipients.\n\n[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]";
          setLastSource("ai");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: finalPreview }]);
          await persistMessage("assistant", finalPreview);
          return;
        } catch (error) {
          const failed = error instanceof Error ? error.message : "The email draft could not be prepared.";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: failed }]);
          await persistMessage("assistant", failed);
          return;
        }
      }

      // Reversible settings are applied immediately. The server emits this
      // action marker, so consume it here instead of displaying the marker as chat text.
      const settingUpdateNow = rawReply.match(/\[\[REX_SETTING_UPDATE_NOW:([^\]]+)\]\]/i);
      if (settingUpdateNow?.[1]) {
        try {
          const payload = JSON.parse(decodeURIComponent(settingUpdateNow[1])) as { settingKey?: unknown; settingValue?: unknown };
          const settingKey = typeof payload.settingKey === "string" ? payload.settingKey : "";
          const settingValue = typeof payload.settingValue === "string" ? payload.settingValue : "";
          if (!settingKey || !settingValue || !onUpdateWorkspaceSetting) {
            throw new Error("The requested workspace setting is not connected.");
          }
          setLastSource("local");
          setSuggests([]);
          await approveWorkspaceSetting({ settingKey, settingValue }, true);
          return;
        } catch (error) {
          const failed = error instanceof Error ? error.message : "The workspace setting could not be updated.";
          setLastSource("local");
          setSuggests([]);
          setMsgs([...next, { role: "assistant", content: failed }]);
          await persistMessage("assistant", failed);
          return;
        }
      }

      let validationNote = "";
      if (rawReply.includes("[[REX_VALIDATE_RECIPIENTS]]")) {
        if (!onValidateRecipients) throw new Error("Recipient validation is not connected to this workspace.");
        const validation = await onValidateRecipients();
        const validationReply = validation.ok
          ? "Recipient validation is complete: " + validation.valid + " valid, " + validation.risky + " risky, and " + validation.duplicate + " duplicate addresses. Nothing has been sent."
          : "I couldn't complete recipient validation. No messages were sent.";
        setLastSource("ai");
        setSuggests([]);
        setMsgs([...next, { role: "assistant", content: validationReply }]);
        await persistMessage("assistant", validationReply);
        return;
      }

            const controlMatch = rawReply.match(/\[\[REX_CONTROL_CAMPAIGN:(pause|resume|stop)\]\]/i);
      if (controlMatch) {
        const action = controlMatch[1]!.toLowerCase() as "pause" | "resume" | "stop";
        let ok = false;
        let note = "";
        if (action === "pause") {
          ok = Boolean(onPauseCurrentCampaign && onPauseCurrentCampaign());
          note = ok ? "Campaign paused." : "Could not pause (no active send, or pause is locked by Rex Monitor in Studio).";
        } else if (action === "stop") {
          ok = Boolean(onStopCurrentCampaign && onStopCurrentCampaign());
          note = ok ? "Campaign stopped." : "Could not stop (no active campaign, or stop is locked by Rex Monitor in Studio).";
        } else {
          // resume = start again
          if (onExecuteCurrentCampaign) {
            ok = await onExecuteCurrentCampaign();
          }
          note = ok ? "Campaign resumed." : "Could not resume. Check Elite Engine readiness.";
        }
        const reply = note;
        setLastSource("local");
        setSuggests([]);
        setMsgs([...next, { role: "assistant", content: reply }]);
        await persistMessage("assistant", reply);
        return;
      }



      if (rawReply.includes("[[REX_PREPARE_CAMPAIGN]]")) {
        const discussion = rawReply.replace("[[REX_PREPARE_CAMPAIGN]]", "").trim();
        if (false /* apply template even without send */ && !(typeof isClearSendCommand === 'function' ? isClearSendCommand(content) : isClearSendCommand(content))) {
          const assistantReply = (discussion || "Let's finish discussing the message first.") +
            "\n\nI have not inspected campaign readiness, changed a template, imported recipients, or started the execution agent. We can finish the draft together first.";
          setLastSource("ai");
          setSuggests(extractSuggests(assistantReply));
          setMsgs([...next, { role: "assistant", content: assistantReply }]);
          await persistMessage("assistant", assistantReply);
          return;
        }
        let importValidationSummary = "";
        const previousReviewedDraft = [...next].reverse().find(message =>
          message.role === "assistant" &&
          /This is (?:still )?only a chat draft/i.test(message.content) &&
          /(?:\*\*Subject:\*\*|Subject:)\s*[^\n]+/i.test(message.content)
        );
        if (previousReviewedDraft && onApplyCampaignTemplate) {
          const subjectMatch = previousReviewedDraft.content.match(/(?:\*\*Subject:\*\*|Subject:)\s*([^\n]+)/i);
          if (subjectMatch?.[1]) {
            const subject = subjectMatch[1].trim().slice(0, 200);
            let body = previousReviewedDraft.content.slice((subjectMatch.index ?? 0) + (subjectMatch[0]?.length ?? 0)).trim();
            body = body.replace(/^(?:\*\*Body:\*\*|Body:|Message:)\s*/i, "");
            body = (body.split(/\n\n(?:This is (?:still )?only a chat draft|Nothing has been sent|Tell me what you'd like adjusted)/i)[0] ?? "").trim().slice(0, 2000);
            if (body) {
              onApplyCampaignTemplate("A", subject, body);
              await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            }
          }
        }
        if (pendingImport) {
          if (!onImportRecipients || !onImportRecipients(pendingImport.raw, pendingImport.fileName)) {
            const failure = "I couldn't transfer the staged recipient list into Elite Engine. Nothing was sent.";
            setLastSource("local");
            setSuggests([]);
            setMsgs([...next, { role: "assistant", content: failure }]);
            await persistMessage("assistant", failure);
            return;
          }
          setPendingImport(null);
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          if (onValidateRecipients) {
          const validation = await onValidateRecipients();
          if (!validation.ok) { importValidationSummary = (importValidationSummary || "") + " Validation will finish on prepare."; }
          importValidationSummary = " Recipient checks: " + validation.valid + " valid, " + validation.risky + " risky, " + validation.duplicate + " duplicate.";
          }
        }
        let toolReply = "";
        if (/\b(schedule|later|at a later time)\b/i.test(content)) {
          toolReply = "I can prepare the campaign content and recipient preview now. Scheduling is a separate workflow; nothing has been scheduled or sent.";
        } else if (!onPrepareCampaign || !onExecuteCurrentCampaign) {
          toolReply = "The campaign preparation workflow is not connected to this workspace session. Nothing was sent.";
        } else {
          try {
            // Inspect and validate the live campaign before showing any send control.
            // The preparation handler returns the exact message and eligible recipient count.
            const prepared = await onPrepareCampaign();
            let preview: { recipientCount?: number; subject?: string; body?: string } = {};
            try { preview = JSON.parse(prepared) as typeof preview; } catch {}
            const recipientCount = Number(preview.recipientCount ?? 0);
            const subject = String(preview.subject ?? "").trim();
            const body = String(preview.body ?? "").trim();
            if (!body || recipientCount < 1) {
              throw new Error("I couldn't produce a complete campaign preview with a subject, message body and eligible recipient count. Nothing was sent.");
            }
            const previewText = "Campaign prepared for your review.\n\nRecipients: " + recipientCount.toLocaleString() +
              importValidationSummary + "\n\nSubject: " + subject + "\n\nMessage:\n" + body +
              "\n\nNothing has been sent. Review this exact message and tell me what you want changed.";
            // A future/conditional statement about approval is not a send command.
            // Only an explicit send/execution instruction may produce the final control.
            const explicitlyRequestsSend = isClearSendCommand(content);
            if (explicitlyRequestsSend) {
              const campaignId = "engine-approval-" + crypto.randomUUID();
              engineSessionApprovalIds.current.add(campaignId);
              toolReply = previewText + "\n\nReview the details above. Approve only if this is exactly what you want sent.\n\n[[APPROVE_CAMPAIGN:" + campaignId + ":" + new Date().toISOString() + ":send]]";
            } else {
              toolReply = previewText;
            }
          } catch (error) {
            toolReply = error instanceof Error ? error.message : "Campaign preparation failed. Nothing was sent.";
          }
        }
        if (validationNote) toolReply = validationNote + "\n\n" + toolReply;
        setLastSource("ai");
        setSuggests(extractSuggests(toolReply));
        setMsgs([...next, { role: "assistant", content: toolReply }]);
        await persistMessage("assistant", toolReply);
        return;
      }

      // During the experiment, Gemini chooses navigation through its registered tool.
      // The deterministic phrase resolver remains in the repository for rollback.
      const reply = rawReply;
      const decodePayload = <T,>(marker: string) => {
        const prefix = "[[" + marker + ":";
        const start = reply.indexOf(prefix);
        if (start < 0) return null;
        const end = reply.indexOf("]]", start + prefix.length);
        if (end < 0) return null;
        return JSON.parse(decodeURIComponent(reply.slice(start + prefix.length, end))) as T;
      };
      const activeRead = decodePayload<{ areas: string[] }>("REX_ACTIVE_WORKSPACE_READ_APPROVAL");
      const workspaceRead = decodePayload<{ domain: string; recordId: string; limit: number }>("REX_WORKSPACE_READ_APPROVAL");
      const chatRead = decodePayload<{ contactName: string; limit: number }>("REX_CHAT_READ_APPROVAL");
      const activeExport = decodePayload<{ areas: string[]; format: "csv" | "json" }>("REX_ACTIVE_WORKSPACE_EXPORT_APPROVAL");
      const workspaceExport = decodePayload<{ domain: string; recordId: string; limit: number; format: "csv" | "json" }>("REX_WORKSPACE_EXPORT_APPROVAL");
      const settingUpdate = decodePayload<{ settingKey: string; settingValue: string }>("REX_SETTING_UPDATE_APPROVAL");
      const plannerCreate = decodePayload<{ kind: "Note" | "Plan" | "Template"; title: string; body: string }>("REX_PLANNER_CREATE_APPROVAL");
      const smartFill = decodePayload<{ action: "save_current_recipients" | "load_saved_list" | "export_saved_list" | "delete_saved_list"; name: string }>("REX_SMART_FILL_APPROVAL");
      const memoryDelete = decodePayload<{ memoryId: string }>("REX_MEMORY_DELETE_APPROVAL");
      const memorySave = decodePayload<{ category: string; content: string }>("REX_MEMORY_SAVE_APPROVAL");
      const hotspotInvite = decodePayload<{ email: string; maxGmailProfiles: number }>("REX_HOTSPOT_INVITE_APPROVAL");
      if (activeRead) { await approveActiveWorkspaceRead(activeRead.areas, true); return; }
      if (workspaceRead) { await approveWorkspaceRead(workspaceRead, true); return; }
      if (chatRead) { await approveChatRead(chatRead, true); return; }
      if (activeExport) { await approveActiveWorkspaceExport(activeExport, true); return; }
      if (workspaceExport) { await approveWorkspaceExport(workspaceExport, true); return; }
      if (settingUpdate) { await approveWorkspaceSetting(settingUpdate, true); return; }
      if (plannerCreate) { await approvePlannerItemCreate(plannerCreate, true); return; }
      if (smartFill) { await approveSmartFillAction(smartFill, true); return; }
      if (memoryDelete) { await approveMemoryDelete(memoryDelete.memoryId, true); return; }
      if (memorySave) { await approveMemorySave(memorySave, true); return; }
      if (hotspotInvite) { await approveHotspotInvite(hotspotInvite, true); return; }
      if (reply.includes("[[REX_VALIDATE_APPROVAL]]")) { await approveRecipientValidation(true); return; }
      if (reply.includes("[[REX_IMPORT_APPROVAL]]")) { await approveRecipientImport(true); return; }
      if (reply.includes("[[REX_LOGOUT_APPROVAL]]")) { await confirmLogoutFromCard(); return; }
      setLastSource(result?.source === "ai" ? "ai" : "local");
      const tagged = extractSuggests(reply);
      setSuggests(tagged);
      setMsgs([...next, { role: "assistant", content: reply }]);
      await persistMessage("assistant", reply);
    } catch (e) {
      setLastSource("local");
      const errorReply = e instanceof Error
        ? `${e.message}\n\nTry again, or email eliteconnectere@gmail.com.`
        : "Something went wrong. Try again, or email eliteconnectere@gmail.com.";
      setMsgs([...next, { role: "assistant", content: errorReply }]);
      await persistMessage("assistant", errorReply);
    } finally {
      setBusy(false);
    }
  }

  
  // Free agent: open real destinations from a NEW [[GO:place]] message.
  // Seed the last marker when chat history is restored so old navigation
  // instructions are never replayed when Rex is reopened.
  const lastNavKey = useRef<string>("");
  const navigationHistoryInitialized = useRef(false);
  useEffect(() => {
    if (busy || !historyReady) return;
    const last = [...msgs].reverse().find((m) => m.role === "assistant");
    if (!navigationHistoryInitialized.current) {
      navigationHistoryInitialized.current = true;
      if (last?.content) {
        const start = last.content.indexOf("[[GO:");
        const end = start >= 0 ? last.content.indexOf("]]", start) : -1;
        if (start >= 0 && end > start) {
          const place = last.content.slice(start + 5, end).trim().toLowerCase();
          lastNavKey.current = place + ":" + String(last.content.length);
        }
      }
      return;
    }
    if (!last?.content) return;
    // A model-generated navigation marker is never sufficient by itself.
    // Require the user's latest message to contain an explicit navigation request,
    // so capability explanations, suggestions, and accidental markers cannot move
    // the user to another screen.
    const latestUserMessage = [...msgs].reverse().find((message) => message.role === "user");
    const explicitNavigationRequest = Boolean(latestUserMessage && /\b(?:open|go to|take me to|bring me to|navigate to|land on|switch to|show me)\\b/i.test(latestUserMessage.content) && !/\bshow me how\\b/i.test(latestUserMessage.content));
    if (!explicitNavigationRequest) return;
    const start = last.content.indexOf("[[GO:");
    if (start < 0) return;
    const end = last.content.indexOf("]]", start);
    if (end < 0) return;
    const place = last.content.slice(start + 5, end).trim().toLowerCase();
    if (!place) return;
    const key = place + ":" + String(last.content.length);
    if (lastNavKey.current === key) return;
    lastNavKey.current = key;
    // Generated personal destinations must be opened by their visible pill,
    // not auto-opened as a side effect of the AI response.
    if (place.startsWith("rex-destination-") || place.startsWith("rex-feature-")) return;
    const known =
      NAVIGATION_DESTINATIONS.some((d) => d.place === place) ||
      place.startsWith("tracker-run-") ||
      place.startsWith("rex-destination-") ||
      place.startsWith("rex-feature-");
    if (!known) return;
    window.setTimeout(() => {
      onClose();
      window.setTimeout(() => onGo?.(place as AssistPlace), 120);
    }, 400);
  }, [msgs, busy, historyReady, onClose, onGo]);

  const openChips = suggests;

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-background" role="dialog" aria-label="Rex Elite Assist">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-brand text-primary-foreground">
          <RexAvatar size="tiny" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-extrabold tracking-tight text-ink">{rexName} AI Agent</p>
          <p className="text-[11px] text-ink-soft truncate">
            {busy
              ? "typing…"
              : lastSource === "ai"
                ? "Your AI Workspace Agent · live help"
                : lastSource === "local"
                  ? "Your AI Workspace Agent · guide mode"
                  : "Your AI Workspace Agent"}
          </p>
        </div>
        <button type="button" onClick={() => { conversationId.current = null; try { window.localStorage.setItem(newChatStorageKey, "1"); try { window.sessionStorage.removeItem(`rex-live-session:${uid}`); } catch {}; } catch {} setMsgs([]); setSuggests([]); setLastSource(null); setPendingImport(null); }} disabled={busy} className="rounded-full border border-line px-3 py-2 text-[11px] font-semibold text-ink-soft disabled:opacity-40">New chat</button>
        <button onClick={onClose} aria-label="Close Rex" className="rounded-full p-2 text-ink">
          <X className="size-5" />
        </button>
      </header>

      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-[13.5px] leading-snug text-ink">
              <span className="font-semibold text-brand">{rexName}</span>
              {" — your AI Workspace Agent for Elite Connectere. I can reason through tasks, use the workspace information and tools made available to me, prepare content, and help you complete supported operations. I will show you the exact details and wait for approval before consequential actions."}
            </p>
            {!busy && (
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Rex conversation starters">
                {REX_WELCOME_STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void send(starter)}
                    className="rounded-full border border-line px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:border-brand hover:text-ink"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-2xl bg-brand px-3 py-2 text-[13px] text-primary-foreground"
            >
              {m.content}
              {m.attachments?.map((file, index) => <div key={index} className="mt-2 rounded-lg border border-white/30 px-2 py-1.5 text-xs">{file.mimeType.startsWith("image/") ? "📷 Photo" : "📄 Document"}: {file.name}</div>)}
            </div>
          ) : (
            <AssistantReply
              key={i}
              content={m.content}
              onShow={(id) => {
                onClose();
                window.setTimeout(() => showTip(id), 250);
              }}
              onMore={() => {
                // Bind expansion to the exact assistant card whose button was tapped.
                // Do not accidentally expand a later assistant message elsewhere in the thread.
                const prior = m.content
                  .replace(/\[\[[^\]]+\]\]/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 4000);
                void send(
                  prior
                    ? "Please expand this specific answer with useful detail, reasoning, and practical steps. Keep the full conversation context and retrieve the underlying saved item or workspace record when this answer refers to one. Do not repeat the same confirmation. The exact answer I am asking you to expand is: " + prior
                    : "Please expand the specific answer on this card with useful detail and practical steps, keeping our full conversation context."
                );
              }}
              onApproveCampaign={(id, scheduledAt, mode) => void approveCampaignFromCard(id, scheduledAt, mode)}
              onApproveAction={(id) => void approveActionFromCard(id)}
              onApproveChat={(payload) => void approveChatMessage(payload)}
              onApproveChatRead={(payload) => void approveChatRead(payload)}
              onApproveWorkspaceRead={(payload) => void approveWorkspaceRead(payload)}
              onApproveActiveWorkspaceRead={(areas) => void approveActiveWorkspaceRead(areas)}
              onApproveActiveWorkspaceExport={(payload) => void approveActiveWorkspaceExport(payload)}
              onApproveWorkspaceExport={(payload) => void approveWorkspaceExport(payload)}
              onApproveTemplateWrite={(payload) => void approveTemplateWrite(payload)}
              onApproveWorkspaceSetting={(payload) => void approveWorkspaceSetting(payload)}
              onApprovePlannerItemCreate={(payload) => void approvePlannerItemCreate(payload)}
              onApproveSmartFillAction={(payload) => void approveSmartFillAction(payload)}
              onApproveMemoryDelete={(memoryId) => void approveMemoryDelete(memoryId)}
              onApproveMemorySave={(payload) => void approveMemorySave(payload)}
              onApproveHotspotInvite={(payload) => void approveHotspotInvite(payload)}
              onApproveRecipientValidation={() => void approveRecipientValidation()}
              onApproveRecipientImport={() => void approveRecipientImport()}
              onCancelRecipientImport={cancelRecipientImport}
              onConfirmLogout={() => { void confirmLogoutFromCard(); }}
              onCancelLogout={() => { setMsgs(current => current.map(message => message.role === "assistant" && message.content.includes("[[REX_LOGOUT_APPROVAL]]") ? { ...message, content: message.content.replace("[[REX_LOGOUT_APPROVAL]]", "[[REX_LOGOUT_CANCELLED]]") } : message)); }}
              onGo={(p) => { onClose(); window.setTimeout(() => onGo?.(p as AssistPlace), 120); }}
            />
          ),
        )}

        {msgs.length > 0 && !busy && openChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {openChips.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-soft"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {busy && <TypingDots />}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="mx-auto flex w-full max-w-xl items-end gap-2 border-t border-line px-4 py-3"
      >
        <input
          ref={uploadInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.png,.jpg,.jpeg,.webp,.gif,.pdf,.csv,.txt,.tsv,.md,.eml,text/csv,text/plain,text/markdown,message/rfc822,text/tab-separated-values"
          multiple
          className="hidden"
          onChange={async (event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (!files.length) return;
            for (const file of files) {
              if (file.size > 2.5 * 1024 * 1024 && (file.type.startsWith("image/") || file.type === "application/pdf")) { toast.error(file.name + " is too large. Photos and PDFs must be 2.5 MB or smaller."); continue; }
              if (file.size > 5 * 1024 * 1024) { toast.error(file.name + " is too large. Uploads must be 5 MB or smaller."); continue; }
              if (file.type.startsWith("image/") || file.type === "application/pdf") {
                try {
                  const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
                    reader.onerror = () => reject(new Error("Could not read " + file.name));
                    reader.readAsDataURL(file);
                  });
                  setPendingAttachments(current => {
                    if (current.length >= 3) { toast.error("Rex can receive up to 3 photos or PDFs per message."); return current; }
                    return [...current, { name: file.name, mimeType: file.type, data }];
                  });
                } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read attachment."); }
                continue;
              }
              try {
              const raw = await file.text();
              const emailCount = (raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).length;
              const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
              const hasCampaignLabels = /^\s*subject\s*:/im.test(raw) && /^\s*body\s*:/im.test(raw);
              const isDraftDocument = ["md", "eml"].includes(extension) || hasCampaignLabels;
              const nonEmptyLines = raw.split(/\r?\n/).filter(line => line.trim());
              const addressLineCount = nonEmptyLines.filter(line => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line)).length;
              const addressLineRatio = addressLineCount / Math.max(1, nonEmptyLines.length);
              const isAddressList = emailCount > 0 && addressLineRatio >= 0.5;
              const isRecipientFile = ["csv", "tsv"].includes(extension) || (!isDraftDocument && isAddressList);
              if (isRecipientFile) {
                if (!onImportRecipients) { toast.error("Recipient import is not connected to this workspace."); return; }
                await stageRecipientImport(raw, file.name, false, true);
              } else {
                await stageCampaignDraftUpload(raw, file.name);
              }
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not stage this file.");
              }
            }
          }}
        />
        <button type="button" onClick={() => uploadInput.current?.click()} disabled={busy || !historyReady || Boolean(pendingImport)} aria-label="Attach photo, PDF or upload recipient file" title="Attach a photo/PDF or upload a recipient file" className="grid size-[42px] shrink-0 place-items-center rounded-xl border border-line bg-card text-ink-soft disabled:opacity-40"><Upload className="size-4" /></button>
        {pendingAttachments.length > 0 && <div className="absolute bottom-[76px] left-4 right-4 z-10 flex flex-wrap gap-2 rounded-xl border border-line bg-card p-2 shadow-lg">{pendingAttachments.map((file,index)=><span key={index} className="flex items-center gap-1 rounded-lg bg-soft px-2 py-1 text-xs text-ink">{file.mimeType.startsWith("image/") ? "📷" : "📄"} {file.name}<button type="button" aria-label={"Remove "+file.name} onClick={()=>setPendingAttachments(current=>current.filter((_,i)=>i!==index))}><X className="size-3"/></button></span>)}</div>}
        <textarea
          ref={inputGrowRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Ask Rex"
          className="max-h-[130px] min-h-[42px] flex-1 resize-none overflow-y-auto rounded-xl border border-line bg-card px-3 py-2.5 text-[13.5px] leading-snug text-ink outline-none"
        />
        <button
          type="submit"
          disabled={busy || !historyReady || (!text.trim() && pendingAttachments.length === 0)}
          aria-label="Send"
          className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-brand text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

function AssistantReply({
  content,
  onShow,
  onGo,
  onMore,
  onApproveCampaign,
  onApproveAction,
  onApproveChat,
  onApproveChatRead,
  onApproveWorkspaceRead,
  onApproveActiveWorkspaceRead,
  onApproveActiveWorkspaceExport,
  onApproveWorkspaceExport,
  onApproveTemplateWrite,
  onApproveWorkspaceSetting,
  onApprovePlannerItemCreate,
  onApproveSmartFillAction,
  onApproveMemoryDelete,
  onApproveMemorySave,
  onApproveHotspotInvite,
  onApproveRecipientValidation,
  onApproveRecipientImport,
  onCancelRecipientImport,
  onConfirmLogout,
  onCancelLogout,
}: {
  content: string;
  onShow: (id: string) => void;
  onGo: (place: string) => void;
  onMore: () => void;
  onApproveCampaign: (id: string, scheduledAt: string, mode?: "send" | "schedule") => void;
  onApproveAction: (id: string) => void;
  onApproveChat: (payload: { recipient: string; body: string }) => void;
  onApproveChatRead: (payload: { contactName: string; limit: number }) => void;
  onApproveWorkspaceRead: (payload: { domain: string; recordId: string; limit: number }) => void;
  onApproveActiveWorkspaceRead: (areas: string[]) => void;
  onApproveActiveWorkspaceExport: (payload: { areas: string[]; format: "csv" | "json" }) => void;
  onApproveWorkspaceExport: (payload: { domain: string; recordId: string; limit: number; format: "csv" | "json" }) => void;
  onApproveTemplateWrite: (payload: { slot: "A" | "B"; subject: string; body: string }) => void;
  onApproveWorkspaceSetting: (payload: { settingKey: string; settingValue: string }) => void;
  onApprovePlannerItemCreate: (payload: { kind: "Note" | "Plan" | "Template"; title: string; body: string }) => void;
  onApproveSmartFillAction: (payload: { action: "save_current_recipients" | "export_saved_list" | "delete_saved_list"; name: string }) => void;
  onApproveMemoryDelete: (memoryId: string) => void;
  onApproveMemorySave: (payload: { category: string; content: string }) => void;
  onApproveHotspotInvite: (payload: { email: string; maxGmailProfiles: number }) => void;
  onApproveRecipientValidation: () => void;
  onApproveRecipientImport: () => void;
  onCancelRecipientImport: () => void;
  onConfirmLogout: () => void;
  onCancelLogout: () => void;
}) {
  const m = content.match(/\[\[SHOW:([a-z0-9-]+)\]\]/i);
  const g = content.match(/\[\[GO:([a-z0-9-]+)\]\]/i);
  const destinationLabelMarker = content.match(/\[\[DESTINATION_LABEL:([^\]]+)\]\]/i);
  let destinationLabel = "";
  try { if (destinationLabelMarker?.[1]) destinationLabel = decodeURIComponent(destinationLabelMarker[1]); } catch {}
  const actionApproval = content.match(/\[\[REX_APPROVAL:([a-z0-9-]+):(pause|resume|stop)\]\]/i);
  const actionApproved = content.match(/\[\[REX_APPROVED:([a-z0-9-]+):(pause|resume|stop)\]\]/i);
  const actionExpired = content.match(/\[\[REX_EXPIRED:([a-z0-9-]+):(pause|resume|stop)\]\]/i);
  const logoutApproval = content.includes("[[REX_LOGOUT_APPROVAL]]");
  const logoutCancelled = content.includes("[[REX_LOGOUT_CANCELLED]]");
  const logoutCompleted = content.includes("[[REX_LOGOUT_DONE]]");
  const campaignApproval = content.match(/\[\[APPROVE_CAMPAIGN:([a-z0-9-]+):(.+):(send|schedule)\]\]/i);
  const campaignApproved = content.match(/\[\[CAMPAIGN_APPROVED:([a-z0-9-]+)(?::(send|schedule))?\]\]/i);
  const chatApproval = content.match(/\[\[REX_CHAT_APPROVAL:([^\]]+)\]\]/i);
  const chatSent = content.includes("[[REX_CHAT_SENT]]");
  const chatReadApproval = content.match(/\[\[REX_CHAT_READ_APPROVAL:([^\]]+)\]\]/i);
  const chatReadDone = content.includes("[[REX_CHAT_READ_DONE]]");
  const workspaceReadApproval = content.match(/\[\[REX_WORKSPACE_READ_APPROVAL:([^\]]+)\]\]/i);
  const workspaceReadDone = content.includes("[[REX_WORKSPACE_READ_DONE]]");
  const activeWorkspaceExportApproval = content.match(/\[\[REX_ACTIVE_WORKSPACE_EXPORT_APPROVAL:([^\]]+)\]\]/i);
  const activeWorkspaceExportDone = content.includes("[[REX_ACTIVE_WORKSPACE_EXPORT_DONE]]");
  let activeWorkspaceExportPayload: { areas: string[]; format: "csv" | "json" } | null = null;
  try {
    if (activeWorkspaceExportApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(activeWorkspaceExportApproval[1])) as { areas?: unknown; format?: unknown };
      if (Array.isArray(value.areas)) activeWorkspaceExportPayload = {
        areas: value.areas.filter((area): area is string => typeof area === "string").slice(0, 8),
        format: value.format === "json" ? "json" : "csv",
      };
    }
  } catch {}
  const activeWorkspaceReadApproval = content.match(/\[\[REX_ACTIVE_WORKSPACE_READ_APPROVAL:([^\]]+)\]\]/i);
  const activeWorkspaceReadDone = content.includes("[[REX_ACTIVE_WORKSPACE_READ_DONE]]");
  let activeWorkspaceReadAreas: string[] = [];
  try {
    if (activeWorkspaceReadApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(activeWorkspaceReadApproval[1])) as { areas?: unknown };
      if (Array.isArray(value.areas)) activeWorkspaceReadAreas = value.areas.filter((area): area is string => typeof area === "string").slice(0, 6);
    }
  } catch {}
  const workspaceExportApproval = content.match(/\[\[REX_WORKSPACE_EXPORT_APPROVAL:([^\]]+)\]\]/i);
  const workspaceExportDone = content.includes("[[REX_WORKSPACE_EXPORT_DONE]]");
  let workspaceExportPayload: { domain: string; recordId: string; limit: number; format: "csv" | "json" } | null = null;
  try {
    if (workspaceExportApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(workspaceExportApproval[1])) as { domain?: unknown; recordId?: unknown; limit?: unknown; format?: unknown };
      workspaceExportPayload = {
        domain: typeof value.domain === "string" ? value.domain : "",
        recordId: typeof value.recordId === "string" ? value.recordId : "",
        limit: Math.max(1, Math.min(100, Number(value.limit) || 100)),
        format: value.format === "json" ? "json" : "csv",
      };
    }
  } catch {}
  const smartFillApproval = content.match(/\[\[REX_SMART_FILL_APPROVAL:([^\]]+)\]\]/i);
  const smartFillDone = content.includes("[[REX_SMART_FILL_DONE]]");
  let smartFillPayload: { action: "save_current_recipients" | "export_saved_list" | "delete_saved_list"; name: string } | null = null;
  try {
    if (smartFillApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(smartFillApproval[1])) as { action?: unknown; name?: unknown };
      if (typeof value.name === "string" && ["save_current_recipients","export_saved_list","delete_saved_list"].includes(String(value.action))) {
        smartFillPayload = { action: value.action as "save_current_recipients" | "export_saved_list" | "delete_saved_list", name: value.name };
      }
    }
  } catch {}
  const plannerCreateApproval = content.match(/\[\[REX_PLANNER_CREATE_APPROVAL:([^\]]+)\]\]/i);
  const plannerCreateDone = content.includes("[[REX_PLANNER_CREATE_DONE]]");
  let plannerCreatePayload: { kind: "Note" | "Plan" | "Template"; title: string; body: string } | null = null;
  try {
    if (plannerCreateApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(plannerCreateApproval[1])) as { kind?: unknown; title?: unknown; body?: unknown };
      if (typeof value.title === "string" && typeof value.body === "string") plannerCreatePayload = {
        kind: value.kind === "Plan" || value.kind === "Template" ? value.kind : "Note",
        title: value.title,
        body: value.body,
      };
    }
  } catch {}
  const settingUpdateApproval = content.match(/\[\[REX_SETTING_UPDATE_APPROVAL:([^\]]+)\]\]/i);
  const settingUpdateDone = content.includes("[[REX_SETTING_UPDATE_DONE]]");
  let settingUpdatePayload: { settingKey: string; settingValue: string } | null = null;
  try {
    if (settingUpdateApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(settingUpdateApproval[1])) as { settingKey?: unknown; settingValue?: unknown };
      if (typeof value.settingKey === "string" && typeof value.settingValue === "string") settingUpdatePayload = { settingKey: value.settingKey, settingValue: value.settingValue };
    }
  } catch {}
  const templateWriteApproval = content.match(/\[\[REX_TEMPLATE_WRITE_APPROVAL:([^\]]+)\]\]/i);
  const templateWriteDone = content.includes("[[REX_TEMPLATE_WRITE_DONE]]");
  let templateWritePayload: { slot: "A" | "B"; subject: string; body: string } | null = null;
  try {
    if (templateWriteApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(templateWriteApproval[1])) as { slot?: unknown; subject?: unknown; body?: unknown };
      if ((typeof value.subject === "string" || value.subject == null) && typeof value.body === "string") templateWritePayload = {
        slot: value.slot === "B" ? "B" : "A",
        subject: typeof value.subject === "string" ? value.subject : "",
        body: value.body,
      };
    }
  } catch {}
  const memoryDeleteApproval = content.match(/\[\[REX_MEMORY_DELETE_APPROVAL:([^\]]+)\]\]/i);
  const memoryDeleteDone = content.includes("[[REX_MEMORY_DELETE_DONE]]");
  let memoryDeleteId = "";
  try {
    if (memoryDeleteApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(memoryDeleteApproval[1])) as { memoryId?: unknown };
      if (typeof value.memoryId === "string") memoryDeleteId = value.memoryId;
    }
  } catch {}
  const memorySaveApproval = content.match(/\[\[REX_MEMORY_SAVE_APPROVAL:([^\]]+)\]\]/i);
  const memorySaveDone = content.includes("[[REX_MEMORY_SAVE_DONE]]");
  let memorySavePayload: { category: string; content: string } | null = null;
  try {
    if (memorySaveApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(memorySaveApproval[1])) as { category?: unknown; content?: unknown };
      if (typeof value.content === "string" && value.content.trim()) memorySavePayload = {
        category: typeof value.category === "string" ? value.category : "context",
        content: value.content,
      };
    }
  } catch {}
  let workspaceReadPayload: { domain: string; recordId: string; limit: number } | null = null;
  try {
    if (workspaceReadApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(workspaceReadApproval[1])) as { domain?: unknown; recordId?: unknown; limit?: unknown };
      workspaceReadPayload = {
        domain: typeof value.domain === "string" ? value.domain : "",
        recordId: typeof value.recordId === "string" ? value.recordId : "",
        limit: Math.max(1, Math.min(100, Number(value.limit) || 30)),
      };
    }
  } catch {}
  let chatReadPayload: { contactName: string; limit: number } | null = null;
  try {
    if (chatReadApproval?.[1]) {
      const value = JSON.parse(decodeURIComponent(chatReadApproval[1])) as { contactName?: unknown; limit?: unknown };
      chatReadPayload = {
        contactName: typeof value.contactName === "string" ? value.contactName : "",
        limit: Math.max(1, Math.min(30, Number(value.limit) || 15)),
      };
    }
  } catch {}
  let chatPayload: { recipient: string; body: string } | null = null;
  try { if (chatApproval?.[1]) { const value = JSON.parse(decodeURIComponent(chatApproval[1])) as { recipient?: unknown; body?: unknown }; if (typeof value.recipient === "string" && typeof value.body === "string") chatPayload = { recipient: value.recipient, body: value.body }; } } catch {}
  const [alreadyApproved] = useState(() => { const id = campaignApproval?.[1]; if (!id || typeof window === "undefined") return false; try { return Boolean(window.localStorage.getItem("rex-approved-campaign:" + id)); } catch { return false; } });
  const text = content
    .replace(/\[\[(SHOW|GO|SUGGEST|APPROVE_CAMPAIGN|CAMPAIGN_APPROVED|REX_APPROVAL|REX_APPROVED|REX_EXPIRED|REX_ACTION_DONE|REX_CHAT_APPROVAL|REX_CHAT_READ_APPROVAL|REX_WORKSPACE_READ_APPROVAL|REX_WORKSPACE_EXPORT_APPROVAL|REX_ACTIVE_WORKSPACE_READ_APPROVAL|REX_ACTIVE_WORKSPACE_EXPORT_APPROVAL|REX_IMPORT_APPROVAL|REX_TEMPLATE_WRITE_APPROVAL|REX_SETTING_UPDATE_APPROVAL|REX_PLANNER_CREATE_APPROVAL|REX_SMART_FILL_APPROVAL|REX_MEMORY_DELETE_APPROVAL|REX_MEMORY_SAVE_APPROVAL|REX_LOGOUT_APPROVAL|REX_LOGOUT_CANCELLED|REX_LOGOUT_DONE|REX_LOGOUT_EXPIRED):[^\]]*\]\]/gi, "")
    .replace(/\[\[(?:REX_LOGOUT_APPROVAL|REX_LOGOUT_CANCELLED|REX_LOGOUT_DONE|REX_LOGOUT_EXPIRED)\]\]/gi, "")
    .replace(/\[\[DESTINATION_LABEL:[^\]]*\]\]/gi, "")
    .replace(/\[\[REX_CHAT_SENT\]\]/gi, "")
    .replace(/\[\[REX_CHAT_READ_DONE\]\]/gi, "")
    .replace(/\[\[REX_WORKSPACE_READ_DONE\]\]/gi, "")
    .replace(/\[\[REX_WORKSPACE_EXPORT_DONE\]\]/gi, "")
    .replace(/\[\[REX_ACTIVE_WORKSPACE_READ_DONE\]\]/gi, "")
    .replace(/\[\[REX_ACTIVE_WORKSPACE_EXPORT_DONE\]\]/gi, "")
    .replace(/\[\[REX_ACTIVE_WORKSPACE_EXPORT_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_ACTIVE_WORKSPACE_READ_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_MEMORY_SAVE_DONE\]\]/gi, "")
    .replace(/\[\[REX_VALIDATE_APPROVAL\]\]/gi, "")
    .replace(/\[\[REX_IMPORT_APPROVAL\]\]/gi, "")
    .replace(/\[\[REX_VALIDATE_DONE\]\]/gi, "")
    .replace(/\[\[REX_IMPORT_DONE\]\]/gi, "")
    .replace(/\[\[REX_TEMPLATE_WRITE_DONE\]\]/gi, "")
    .replace(/\[\[REX_SETTING_UPDATE_DONE\]\]/gi, "")
    .replace(/\[\[REX_PLANNER_CREATE_DONE\]\]/gi, "")
    .replace(/\[\[REX_SMART_FILL_DONE\]\]/gi, "")
    .replace(/\[\[REX_SMART_FILL_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_PLANNER_CREATE_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_SETTING_UPDATE_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_MEMORY_DELETE_DONE\]\]/gi, "")
    .replace(/\[\[REX_MEMORY_DELETE_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_TEMPLATE_WRITE_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_IMPORT_CANCELLED\]\]/gi, "")
    .replace(/\[\[REX_IMPORT_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_CHAT_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_CHAT_READ_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_WORKSPACE_READ_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_WORKSPACE_EXPORT_EXPIRED\]\]/gi, "")
    .replace(/\[\[REX_MEMORY_SAVE_EXPIRED\]\]/gi, "")
    .trim();
  const showId = m?.[1]?.toLowerCase() ?? "";
  const goId = g?.[1]?.toLowerCase() ?? "";
  return (
    <div className="max-w-[95%] text-[13px] text-ink">
      <div className="rounded-2xl border border-line bg-card px-3 py-2.5 shadow-sm">
        <div className="mb-1 flex justify-end">
          <button type="button" aria-label="Copy response text" title="Copy response text" onClick={() => { void navigator.clipboard.writeText(text).then(() => toast.success("Response copied")).catch(() => toast.error("Could not copy this response.")); }} className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium text-ink-soft hover:bg-muted">
            <Copy className="size-3.5" /> Copy response
          </button>
        </div>
        <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-ink [&_a]:text-brand [&_li]:my-0.5 [&_ol]:my-1 [&_p]:my-1.5 [&_strong]:text-ink">
          <ReactMarkdown components={{
            pre: ({ children }) => (
              <div data-rex-code className="not-prose my-3 overflow-hidden rounded-xl border border-line bg-soft">
                <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Message / code</span>
                  <button type="button" aria-label="Copy this block only" title="Copy this block only" onClick={(event) => {
                    const block = event.currentTarget.closest("[data-rex-code]");
                    const value = block?.querySelector("code")?.textContent ?? "";
                    void navigator.clipboard.writeText(value).then(() => toast.success("Block copied")).catch(() => toast.error("Could not copy this block."));
                  }} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-ink-soft hover:bg-muted"><Copy className="size-3.5" />Copy block</button>
                </div>
                <pre className="m-0 overflow-x-auto p-3 text-[12px] leading-relaxed"><code>{children}</code></pre>
              </div>
            ),
          }}>{text}</ReactMarkdown>
        </div>
      </div>
      {m && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onShow(showId)}
            className="rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
          >
            {"Yes — show me"}
          </button>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onMore}
          className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-ink-soft"
        >
          More details
        </button>
      </div>
      {chatPayload && chatPayload.body.trim() && !chatSent && (

        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Private Chat message — approval required</p>
          <p className="mt-1 text-[12px] text-ink-soft">To: {chatPayload.recipient}</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-card p-2 text-[13px] text-ink">{chatPayload.body}</p>
          <button type="button" onClick={() => onApproveChat(chatPayload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Send Private Message</button>
        </div>
      )}
      {chatSent && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Private Chat message sent</span>}
      {content.includes("[[REX_ACTIVE_WORKSPACE_EXPORT_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This live workspace export approval expired when Rex was reopened. Ask Rex to prepare the export again.</span>}
      {content.includes("[[REX_ACTIVE_WORKSPACE_READ_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This live workspace inspection approval expired when Rex was reopened. Ask Rex to prepare the read again.</span>}
      {activeWorkspaceReadDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Live workspace inspection approved</span>}
      {activeWorkspaceExportPayload && !activeWorkspaceExportDone && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Live workspace export — approval required</p>
          <p className="mt-1 text-[12px] text-ink-soft">Export only: {activeWorkspaceExportPayload.areas.map(area => area.replaceAll("_", " ")).join(", ")} as {activeWorkspaceExportPayload.format.toUpperCase()}. Data will be inspected only after approval.</p>
          <button type="button" onClick={() => onApproveActiveWorkspaceExport(activeWorkspaceExportPayload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Export</button>
        </div>
      )}
      {activeWorkspaceExportDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Live workspace export completed</span>}
      {workspaceExportPayload && !workspaceExportDone && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Workspace export — approval required</p>
          <p className="mt-1 text-[12px] text-ink-soft">Export up to {workspaceExportPayload.limit} records from {workspaceExportPayload.domain.replaceAll("_", " ")} as {workspaceExportPayload.format.toUpperCase()}. Records will be read only after approval.</p>
          <button type="button" onClick={() => onApproveWorkspaceExport(workspaceExportPayload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Export</button>
        </div>
      )}
      {workspaceExportDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Workspace export completed</span>}
      {templateWritePayload && !templateWriteDone && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Update Template {templateWritePayload.slot} — approval required</p>
          <p className="mt-2 text-[11px] font-semibold text-ink-soft">SUBJECT</p>
          <p className="whitespace-pre-wrap rounded-lg bg-card p-2 text-[13px] text-ink">{templateWritePayload.subject}</p>
          <p className="mt-2 text-[11px] font-semibold text-ink-soft">EMAIL BODY</p>
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-card p-2 text-[13px] text-ink">{templateWritePayload.body}</p>
          <p className="mt-2 text-[11px] text-ink-soft">This changes the selected template only. No email will be sent.</p>
          <button type="button" onClick={() => onApproveTemplateWrite(templateWritePayload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Apply</button>
        </div>
      )}
      {templateWriteDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Campaign template updated</span>}
      {settingUpdatePayload && !settingUpdateDone && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Workspace setting change — approval required</p>
          <p className="mt-2 text-[12px] text-ink-soft">{settingUpdatePayload.settingKey.replaceAll(".", " · ")} → <span className="font-semibold text-ink">{settingUpdatePayload.settingValue}</span></p>
          <p className="mt-2 text-[11px] text-ink-soft">Only this one preference will change.</p>
          <button type="button" onClick={() => onApproveWorkspaceSetting(settingUpdatePayload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Update</button>
        </div>
      )}
      {settingUpdateDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Workspace setting updated</span>}
      {plannerCreatePayload && !plannerCreateDone && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Add {plannerCreatePayload.kind} to Planner — approval required</p>
          <p className="mt-2 text-[12px] font-semibold text-ink">{plannerCreatePayload.title}</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-card p-2 text-[12px] text-ink-soft">{plannerCreatePayload.body}</p>
          <button type="button" onClick={() => onApprovePlannerItemCreate(plannerCreatePayload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Add</button>
        </div>
      )}
      {plannerCreateDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Planner item added</span>}
      {smartFillPayload && !smartFillDone && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Smart Fill list operation — approval required</p>
          <p className="mt-2 text-[12px] text-ink-soft">{smartFillPayload.action.replaceAll("_", " ")} · <span className="font-semibold text-ink">{smartFillPayload.name}</span></p>
          <p className="mt-2 text-[11px] text-ink-soft">{smartFillPayload.action === "delete_saved_list" ? "This permanently deletes only the named saved list." : smartFillPayload.action === "export_saved_list" ? "This downloads the named saved list as a CSV file." : "This saves the currently loaded recipient list as a new Smart Fill list."}</p>
          <button type="button" onClick={() => onApproveSmartFillAction(smartFillPayload!)} className={smartFillPayload.action === "delete_saved_list" ? "mt-3 rounded-full bg-destructive px-4 py-2 text-[12px] font-semibold text-white" : "mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground"}>Approve &amp; {smartFillPayload.action === "save_current_recipients" ? "Save" : smartFillPayload.action === "export_saved_list" ? "Export" : "Delete"}</button>
        </div>
      )}
      {smartFillDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Smart Fill list operation completed</span>}
      
      {(() => {
        const hm = content.match(/\[\[REX_HOTSPOT_INVITE_APPROVAL:([^\]]+)\]\]/i);
        if (!hm) return null;
        let payload: { email: string; maxGmailProfiles: number } | null = null;
        try { payload = JSON.parse(decodeURIComponent(hm[1]!)); } catch { try { payload = JSON.parse(hm[1]!); } catch {} }
        if (!payload?.email) return null;
        return (
          <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
            <p className="text-[12px] font-bold text-ink">Share hotspot access — approval required</p>
            <p className="mt-1 text-[12px] text-ink-soft">Invite <span className="font-semibold text-ink">{payload.email}</span> with max {payload.maxGmailProfiles} Gmail profile(s).</p>
            <button type="button" onClick={() => onApproveHotspotInvite(payload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve & Share Hotspot</button>
          </div>
        );
      })()}
      {content.includes("[[REX_HOTSPOT_INVITE_DONE]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">Hotspot share completed</span>}

      {content.includes("[[REX_VALIDATE_APPROVAL]]") && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Recipient validation — approval required</p>
          <p className="mt-1 text-[12px] text-ink-soft">Inspect the active Elite Engine recipient list and classify valid, risky and duplicate entries. Read-only; no messages will be sent.</p>
          <button type="button" onClick={onApproveRecipientValidation} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Validate Recipients</button>
        </div>
      )}
      {content.includes("[[REX_VALIDATE_DONE]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Recipient validation completed</span>}
      {content.includes("[[REX_IMPORT_STAGED]]") && (
        <div className="mt-2 rounded-xl border border-line bg-soft p-3">
          <p className="text-[12px] font-bold text-ink">Recipient file staged — no changes made</p>
          <p className="mt-1 text-[12px] text-ink-soft">Tell Rex to import this file into Recipients, or ask for a campaign workflow. You will see the approval before anything is changed.</p>
          <button type="button" onClick={onCancelRecipientImport} className="mt-3 rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-ink-soft">Discard staged file</button>
        </div>
      )}
      {content.includes("[[REX_IMPORT_APPROVAL]]") && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Recipient file import — approval required</p>
          <p className="mt-1 text-[12px] text-ink-soft">{content.includes("One approval covers that complete workflow") ? "This approval imports the file, validates recipients, checks campaign readiness and starts sending only if all checks pass." : "This approval imports the selected file only. It will not start a campaign."}</p>
          <button type="button" onClick={onApproveRecipientImport} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; {content.includes("One approval covers that complete workflow") ? "Import & Execute" : "Import File"}</button>
          <button type="button" onClick={onCancelRecipientImport} className="ml-2 mt-3 rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-ink-soft">Cancel</button>
        </div>
      )}
      {content.includes("[[REX_IMPORT_DONE]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Recipient file imported</span>}
      {content.includes("[[REX_IMPORT_CANCELLED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">Recipient import cancelled. No file was imported.</span>}
      {content.includes("[[REX_IMPORT_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This staged file is no longer available. Upload it again to prepare a new approval.</span>}
      {content.includes("[[REX_TEMPLATE_WRITE_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This template approval expired when Rex was reopened. Ask Rex to prepare the template update again.</span>}
      {content.includes("[[REX_SETTING_UPDATE_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This setting approval expired when Rex was reopened. Ask Rex to prepare the setting update again.</span>}
      {content.includes("[[REX_PLANNER_CREATE_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This Planner approval expired when Rex was reopened. Ask Rex to prepare the item again.</span>}
      {content.includes("[[REX_SMART_FILL_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This Smart Fill approval expired when Rex was reopened. Ask Rex to prepare the operation again.</span>}
      {content.includes("[[REX_MEMORY_DELETE_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This memory deletion approval expired when Rex was reopened. Ask Rex to prepare the deletion again.</span>}
      {memorySavePayload && !memorySaveDone && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Save memory — approval required</p>
          <p className="mt-1 text-[12px] text-ink-soft">Category: {memorySavePayload.category}</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-card p-2 text-[13px] text-ink">{memorySavePayload.content}</p>
          <button type="button" onClick={() => onApproveMemorySave(memorySavePayload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve &amp; Save Memory</button>
        </div>
      )}
      {memorySaveDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Memory saved</span>}
      {memoryDeleteId && !memoryDeleteDone && (
        <div className="mt-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-[12px] font-bold text-ink">Delete saved Rex memory — approval required</p>
          <p className="mt-1 break-all text-[12px] text-ink-soft">Memory ID: {memoryDeleteId}</p>
          <p className="mt-2 text-[12px] text-ink-soft">This permanently deletes this one saved memory entry. Other memories are unchanged.</p>
          <button type="button" onClick={() => onApproveMemoryDelete(memoryDeleteId)} className="mt-3 rounded-full bg-destructive px-4 py-2 text-[12px] font-semibold text-white">Approve &amp; Delete</button>
        </div>
      )}
      {memoryDeleteDone && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Saved Rex memory deleted</span>}
      {content.includes("[[REX_MEMORY_SAVE_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This memory approval expired when Rex was reopened. Ask Rex to prepare it again.</span>}


{content.includes("[[REX_CHAT_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This message approval expired when Rex was reopened. Ask Rex to prepare it again.</span>}
      {logoutApproval && !logoutCancelled && !logoutCompleted && (
        <div className="mt-3 rounded-xl border border-line bg-card p-3">
          <p className="text-[13px] font-semibold text-ink">Sign out of Elite Connectere?</p>
          <p className="mt-1 text-[12px] text-ink-soft">You will be signed out of this account. Nothing happens until you confirm.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onConfirmLogout} className="rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Confirm sign-out</button>
            <button type="button" onClick={onCancelLogout} className="rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-ink">Cancel</button>
          </div>
        </div>
      )}
      {logoutCancelled && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">Sign-out cancelled. You are still signed in.</span>}
      {content.includes("[[REX_LOGOUT_EXPIRED]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">This sign-out approval expired when Rex was reopened. Ask Rex to prepare a new one.</span>}
      {logoutCompleted && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">Sign-out confirmed.</span>}
      {actionApproval && !actionApproved && (
        <button type="button" onClick={() => onApproveAction(actionApproval[1]!)} className="mt-2 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">
          {actionApproval[2] === "pause" ? "Approve Pause" : actionApproval[2] === "resume" ? "Approve Resume" : "Approve Stop"}
        </button>
      )}
      {actionApproved && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ Approved — {actionApproved[2]}</span>}
      {actionExpired && <span role="status" className="mt-2 inline-flex rounded-full bg-soft px-3 py-1.5 text-[12px] font-semibold text-ink-soft">Expired — continued without approving. Ask again anytime — ask Rex to prepare it again.</span>}
      {campaignApproval && !alreadyApproved && (
        <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-[12px] font-bold text-ink">Ready to send</p>
          <p className="mt-1 text-[12px] text-ink-soft">Starts the <span className="font-semibold text-ink">current Elite Engine</span> draft (subject, body, recipient list). Tap Approve & Send Now, or reply yes. If the message is wrong, tell Rex what to change first.</p>
          <button
            type="button"
            onClick={() => onApproveCampaign(campaignApproval[1]!, campaignApproval[2]!, campaignApproval[3] === "schedule" ? "schedule" : "send")}
            className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            {campaignApproval[3] === "schedule" ? "Approve & Schedule" : "Approve & Send Now"}
          </button>
        </div>
      )}
      {(campaignApproved || alreadyApproved) && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">✓ {(campaignApproved?.[2] ?? (campaignApproval?.[1] && alreadyApproved ? window.localStorage.getItem("rex-approved-campaign:" + campaignApproval[1]) : null)) === "schedule" ? "Approved — scheduled" : "Approved — sending"}</span>}
      {g && (PLACE_LABEL[goId] || NAVIGATION_DESTINATIONS.some(destination => destination.place === goId) || goId.startsWith("tracker-run-") || goId.startsWith("rex-destination-") || goId.startsWith("rex-feature-")) && (
        <button
          type="button"
          onClick={() => onGo(goId)}
          className="mt-2 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
        >
          {PLACE_LABEL[goId] || (goId.startsWith("rex-destination-") || goId.startsWith("rex-feature-")
            ? "Open " + (destinationLabel || "generated destination")
            : NAVIGATION_DESTINATIONS.find(destination => destination.place === goId)?.purpose
              ? "Open " + NAVIGATION_DESTINATIONS.find(destination => destination.place === goId)!.purpose
              : "Open campaign execution details")} →
        </button>
      )}
    </div>
  );
}
