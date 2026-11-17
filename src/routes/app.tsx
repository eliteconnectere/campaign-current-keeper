import { toast } from "sonner";
import { Studio, TargetValue } from "@/features/settings/Studio";
import { FeatureStudios } from "@/features/settings/FeatureStudios";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceDisplaySession } from "@/features/workspace/offline-session";
import { connectGmailAccount } from "@/lib/gmailConnect";
import { controlRexManagedCampaign, enqueueCampaign, getCampaignExecutionProgress, getRexCampaignWorkspaceData, listRexCampaigns } from "@/lib/campaign.functions";
import { getWorkspaceSnapshot, saveWorkspaceSnapshot } from "@/lib/workspace-sync.functions";
import {
  disconnectGmailProfile,
  listGmailProfiles,
  setGmailTarget,
  testGmailProfile,
  type GmailProfile,
} from "@/lib/gmail.functions";
import {
  Bell,
  Menu,
  Mail,
  Send,
  Zap,
  Lock,
  ShieldCheck,
  ShieldAlert,
  MailCheck,
  Sparkles,
  Pencil,
  ListChecks,
  Eraser,
  Shuffle,
  FileText,
  Info,
  XCircle,
  AlertTriangle,
  Rocket,
  ExternalLink,
  Timer,
  ChevronDown,
  ChevronUp,
  Plus,
  Server,
  CheckCircle2,
  Pause,
  X,
  Settings,
  MessageCircle,
  RotateCcw,
  Gauge,
  ScrollText,
  NotebookPen,
  Trash2,
  ChevronLeft,
  Download,
  Database,
  LogOut,
  Target,
  History,
  Copy,
  Globe,
  Youtube,
  Instagram,
  Facebook,
  Volume2,
  Search,
  Users,
  Compass,
} from "lucide-react";
import {
  buildSmartFill,
  fill,
  parseList,
  parseRecipientFileText,
  type Generated,
  type Recipient,
  type Status,
} from "@/features/data";
import {
  clearWorkspaceStorage,
  loadWorkspace,
  readOnboarding,
  saveWorkspace,
  writeOnboarding,
  TERMS_VERSION,
  type CampaignDay,
  type CampaignExecution,
  type CampaignRecipientResult,
  type PlannerItem,
  type SmartFillSet,
  type WorkspaceSnapshot,
} from "@/features/workspace/persist";
import { Onboarding } from "@/features/workspace/Onboarding";
import { useLongPress } from "@/features/workspace/useLongPress";
import { AppealsPanel } from "@/features/admin/AppealsPanel";
import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed, showPanelTip } from "@/features/workspace/HandTour";
import { DidYouKnowHost } from "@/features/workspace/DidYouKnow";
import { EliteRadarHub } from "@/features/radar/EliteRadarHub";
import { TeamPanel } from "@/features/team/TeamPanel";
import { AdminPanel } from "@/features/admin/AdminPanel";
import { Activity, Bot } from "lucide-react";
import { RexAvatar } from "@/features/assist/RexAvatar";
import { InstallPrompt } from "@/features/workspace/InstallPrompt";
import {
  applyAppearance,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  NOTIFICATION_KINDS,
  type AppSettings,
  type NotificationKind,
} from "@/features/settings/settings";
import { MagicCircle } from "@/features/chat/MagicCircle";
import { EliteAssist, type AssistPlace } from "@/features/assist/EliteAssist";
import { searchApplicationCatalog } from "@/features/assist/application-search";
import { listRexSearchDestinations } from "@/lib/rex-dynamic-features.functions";
import { RexStudio } from "@/features/assist/RexStudio";
import { RexPersonalDestinationPage } from "@/features/assist/RexPersonalDestinationPage";
import { PrivateChat, useChatHub } from "@/features/chat/PrivateChat";
import { ChatSettings } from "@/features/chat/ChatSettings";
import {
  notificationPermission,
  playSound,
  playSendSound,
  unlockAudioFromGesture,
  playAlarmRingtone,
  requestNotificationPermission,
  showSystemNotification,
  vibrate,
} from "@/lib/sounds";
import { Countdown, PremiumUnlock, EliteUnlocked, type PlanId } from "@/features/premium/Premium";
import { startCheckout } from "@/lib/paystack.functions";
import { GOOGLE_REVIEW_MODE } from "@/lib/reviewMode";
import { scanCampaignContent, safetyBlockMessage } from "@/lib/contentSafety";
import { ReviewCRM } from "@/features/workspace/ReviewCRM";
import { getEntitlements, type Entitlements } from "@/lib/billing.functions";
import { scanDomains } from "@/lib/domainScan.functions";
import { ExpiryReminder } from "@/features/billing/ExpiryReminder";
import { PromoChip } from "@/features/billing/PromoChip";
import { CampaignTimerChip } from "@/features/campaign/CampaignTimerChip";
import { ErrorGuideHost, showErrorGuide } from "@/features/workspace/ErrorGuide";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: GOOGLE_REVIEW_MODE ? "Elite Connectere — Customer CRM" : "Elite Connectere — AI-Powered Campaign Workspace with Rex" },
            {
        name: "description",
        content:
          GOOGLE_REVIEW_MODE ? "Internal CRM for opted-in active clients and existing customers." : "Elite Connectere is an AI-powered outreach workspace with Rex, its AI Workspace Agent designed to reason across supported workspace features, prepare tasks, and operate connected tools with approval for consequential actions.",
      },
      { property: "og:title", content: GOOGLE_REVIEW_MODE ? "Elite Connectere — Customer CRM" : "Elite Connectere — AI-Powered Campaign Workspace with Rex" },
      {
        property: "og:description",
        content:
          GOOGLE_REVIEW_MODE ? "Internal CRM for opted-in active clients and existing customers." : "Elite Connectere is an AI-powered outreach workspace with Rex, its AI Workspace Agent designed to reason across supported workspace features, prepare tasks, and operate connected tools with approval for consequential actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => GOOGLE_REVIEW_MODE ? <ReviewCRM /> : <Workspace />,
});

const TEMPLATE_A = { subject: "", body: "" };
const TEMPLATE_B = { subject: "", body: "" };
const campaignResumeKey = (accountId: string) => `ec-engine-resume:${accountId}`;

/* ---------- small shared pieces ---------- */

function Card({
  children,
  className = "",
  innerRef,
  highlight,
  tourId,
}: {
  children: React.ReactNode;
  className?: string;
  innerRef?: React.Ref<HTMLElement>;
  highlight?: boolean;
  tourId?: string;
}) {
  return (
    <section
      data-tour={tourId}
      ref={innerRef}
      className={`card-shell p-3.5 ${highlight ? "attention-ring" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

function Stat({
  value,
  label,
  red,
  badge,
}: {
  value: string;
  label: string;
  red?: boolean;
  badge?: string | undefined;
}) {
  return (
    <div className="relative rounded-lg border border-line bg-soft px-2.5 py-1.5">
      {badge && (
        <div className="absolute right-2 top-1.5 text-right leading-none">
          <div className="text-[8px] font-bold tracking-wider text-ink-soft">24HR</div>
          <div className="text-[11px] font-bold text-brand">{badge}</div>
        </div>
      )}
      <div className={`text-[16px] font-bold leading-tight ${red ? "text-brand" : "text-ink"}`}>
        {value}
      </div>
      <div className="label-caps">{label}</div>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  sub,
  danger,
  onClick,
  dataAttr,
}: {
  icon: typeof Settings;
  label: string;
  sub?: string;
  danger?: boolean;
  onClick?: () => void;
  dataAttr?: string;
}) {
  return (
    <button
      onClick={onClick}
      {...(dataAttr ? { [dataAttr]: "" } : {})}
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors active:bg-soft"
    >
      <Icon className="size-4 shrink-0 text-brand" />
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold ${danger ? "text-brand" : "text-ink"}`}>
          {label}
        </span>
        {sub && <span className="block text-[11px] leading-snug text-ink-soft">{sub}</span>}
      </span>
    </button>
  );
}

function MenuToggle({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: typeof Settings;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors active:bg-soft"
    >
      <Icon className="size-4 shrink-0 text-brand" />
      <span className="flex-1 text-[13px] font-semibold text-ink">{label}</span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide transition-colors ${
          on ? "bg-brand text-white" : "bg-soft text-ink-soft"
        }`}
      >
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-brand" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Chip({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-line bg-soft text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Confirm({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 px-6">
      <div className="w-full max-w-[320px] animate-scale-in rounded-2xl border border-line bg-white p-4 shadow-[0_18px_44px_-26px_oklch(0.31_0.128_268/40%)]">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        {body && <p className="mt-1 text-[12px] leading-snug text-ink-soft">{body}</p>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-line py-2 text-[12.5px] font-semibold text-ink"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-brand py-2 text-[12.5px] font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({
  title,
  value,
  onChange,
  rotating,
}: {
  title: string;
  value: { subject: string; body: string };
  onChange: (v: { subject: string; body: string }) => void;
  rotating: boolean;
}) {
  const subjectChips = ["Quick question", "Partnership", "Exclusive offer"];
  const toneChips: [string, string][] = [
    ["Professional", "Hi {name}, I came across {company} and was impressed. Worth a quick chat?"],
    ["Casual", "Hey {name} — saw {company} and had one quick idea for you. Open to it?"],
    ["Invitation", "Hi {name}, I'd love to invite {company} to something we're putting together."],
  ];
  return (
    <div className="rounded-[14px] border border-line p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {rotating && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] text-brand">
            ROTATING
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Pencil className="size-3 text-brand" />
        <span className="label-caps !text-ink">SUBJECT LINE</span>
        <span className="text-[10px] text-ink-soft">(Max 200)</span>
      </div>
      <input
        value={value.subject}
        maxLength={200}
        onChange={(e) => onChange({ ...value, subject: e.target.value })}
        className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-[12.5px] text-ink outline-none focus:border-ink/30"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {subjectChips.map((c) => (
          <Chip key={c} onClick={() => onChange({ ...value, subject: `${c} for {name}` })}>
            {c}
          </Chip>
        ))}
        <span className="ml-auto text-[11px] text-ink-soft">{value.subject.length}/200</span>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <FileText className="size-3 text-brand" />
        <span className="label-caps !text-ink">MESSAGE BODY</span>
        <span className="text-[10px] text-ink-soft">(Max 2000)</span>
      </div>
      <textarea
        value={value.body}
        maxLength={2000}
        rows={4}
        onChange={(e) => onChange({ ...value, body: e.target.value })}
        className="mt-1.5 w-full resize-none rounded-xl border border-line px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-ink/30"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {toneChips.map(([label, body]) => (
          <Chip key={label} onClick={() => onChange({ ...value, body })}>
            {label}
          </Chip>
        ))}
        <span className="ml-auto text-[11px] text-ink-soft">{value.body.length}/2000</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-brand">
        <Info className="size-3" /> Smart personalization enabled
      </p>
    </div>
  );
}

/* ---------- profile row (long press �� disconnect) ---------- */

function ProfileRow({
  profile,
  status,
  onSelect,
  onLongPress,
}: {
  profile: GmailProfile;
  status: "ACTIVE" | "STANDBY" | "EXHAUSTED";
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const press = useLongPress(onLongPress, 2000);
  return (
    <button
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerLeave={press.onPointerLeave}
      onPointerCancel={press.onPointerCancel}
      onContextMenu={press.onContextMenu}
      data-tour="profile-row"
      onClick={() => {
        if (press.consumed()) return;
        onSelect();
      }}
      className={`flex w-full select-none items-center gap-2 px-3 py-2 text-left ${
        status === "ACTIVE" ? "bg-soft" : "bg-white"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">
          {profile.email.split("@")[0]}
        </span>
        <span className="block truncate font-mono text-[11px] text-ink-soft">{profile.email}</span>
      </span>
      <span
        className={`shrink-0 text-[10px] font-bold tracking-wide ${
          status === "ACTIVE" ? "text-brand" : "text-ink-soft"
        }`}
      >
        {status}
      </span>
    </button>
  );
}

/* ---------- page ---------- */


/** Real domain scan: MX/DNS check for unique domains after parseList. */
async function enrichWithDomainScan(list: Recipient[]): Promise<Recipient[]> {
  const domains = [...new Set(list.map((r) => (r.email.split("@")[1] ?? "").toLowerCase()).filter(Boolean))];
  if (domains.length === 0) return list;
  try {
    const { results } = await scanDomains({ data: { domains } });
    const map = new Map(results.map((r) => [r.domain, r]));
    return list.map((r) => {
      if (r.status !== "valid") return r;
      const domain = (r.email.split("@")[1] ?? "").toLowerCase();
      const hit = map.get(domain);
      if (!hit) return r;
      if (!hit.deliverable) {
        return { ...r, status: "risky" as const, reason: hit.reason };
      }
      return { ...r, reason: hit.reason };
    });
  } catch (e) {
    console.error("Domain scan failed", e);
    return list;
  }
}

function Workspace() {
  const [ready, setReady] = useState(false);
  const cloudWorkspaceRevisionRef = useRef(0);
  const cloudWorkspaceConflictRef = useRef(false);
  const cloudWorkspaceLastPayloadRef = useRef<string | null>(null);
  const [accepted, setAccepted] = useState(true);

  const [mode, setMode] = useState<"standard" | "elite" | "both">("elite");
  // One-time local workspace cleanup. Preserve the Supabase Master Login:
  // newly verified users must remain signed in and continue into the workspace.
  useEffect(() => {
    const FRESH = "ec.fresh-start.2026-10";
    if (localStorage.getItem(FRESH)) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("ec."))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(FRESH, "1");
  }, []);
  // Elite Assist "show me" → switch to the right mode before the guide points at it.
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const tip = ELITE_TIPS.find((t) => t.id === id);
      if (tip) setMode("elite");
    };
    window.addEventListener("ec:show-tip", on);
    return () => window.removeEventListener("ec:show-tip", on);
  }, []);
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [raw, setRaw] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [validated, setValidated] = useState(false);
  const [editing, setEditing] = useState(true);
  const [tab, setTab] = useState<Status>("valid");

  const [twoWay, setTwoWay] = useState(true);
  const [tplA, setTplA] = useState(TEMPLATE_A);
  const [tplB, setTplB] = useState(TEMPLATE_B);

  const [generated, setGenerated] = useState<Generated[]>([]);
  const [sentRecipientEmails, setSentRecipientEmails] = useState<string[]>([]);
  const [campaignHistory, setCampaignHistory] = useState<CampaignDay[]>([]);
  const [campaignRuns, setCampaignRuns] = useState<CampaignExecution[]>([]);
  const [persistedCampaignWorkspace, setPersistedCampaignWorkspace] = useState<{ campaigns: any[]; recipients: any[]; sentLast24Hours: number; source: string; truncated: boolean }>({ campaigns: [], recipients: [], sentLast24Hours: 0, source: 'server_campaigns', truncated: false });
  const activeCampaignIdRef = useRef<string | null>(null);
  const [activeServerCampaignId, setActiveServerCampaignId] = useState<string | null>(null);
  const [serverCampaignStatus, setServerCampaignStatus] = useState<string>("idle");
  const [serverCampaignCounts, setServerCampaignCounts] = useState({ sent: 0, total: 0, failed: 0 });
  const sentRecipientEmailsRef = useRef<Set<string>>(new Set());
  const [genTab, setGenTab] = useState<"all" | "sent" | "pending">("all");

  const [scout, setScout] = useState(false);
  const [delay, setDelay] = useState(5);
  const [nextInSec, setNextInSec] = useState<number | null>(null);
  const permanentSendProtection = true; // always on — no toggle
  const [showProtectionDetails, setShowProtectionDetails] = useState(false);
  const delayRef = useRef(3);
  delayRef.current = delay;
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(50);
  const [defaultScope, setDefaultScope] = useState(50);
  const [scope, setScope] = useState(50);

  const [profiles, setProfiles] = useState<GmailProfile[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [connectNote, setConnectNote] = useState("");
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [engine, setEngine] = useState<"idle" | "sending" | "paused">("idle");
  const [autoResumePending, setAutoResumePending] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    if (!signedIn) {
      setRexSearchResources({ features: [], destinations: [] });
      return () => { active = false; };
    }
    void listRexSearchDestinations()
      .then(resources => { if (active) setRexSearchResources(resources); })
      .catch(error => {
        console.warn("[Rex search] Could not load personal destinations; registered app destinations remain searchable.", error);
        if (active) setRexSearchResources({ features: [], destinations: [] });
      });
    return () => { active = false; };
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn) {
      setTeamCanManage(false);
      return;
    }
    import("@/lib/team.functions")
      .then(({ listMyTeamSeats }) => listMyTeamSeats())
      .then((res) => setTeamCanManage(Boolean(res?.canManage)))
      .catch(() => setTeamCanManage(false));
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    try {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("team_invite");
      if (token) {
        url.searchParams.delete("team_invite");
        window.history.replaceState({}, "", url.toString());
      }
      // A sign-in alone must never accept an invitation. Only a valid
      // invitation link auto-accepts; otherwise the invited person must tap
      // the visible Accept button in Hotspot settings.
      if (!token) return;
      import("@/lib/team.functions").then(({ acceptTeamInvite }) =>
        acceptTeamInvite({ data: { token } }).then((res) => {
          if (!live || !res.ok) {
            if (live && !res.ok) toast.error(res.error || "This hotspot invitation could not be accepted.");
            return;
          }
          setAssistantCelebrate({
            ownerEmail: (res as any).ownerEmail || "Workspace Owner",
            maxGmails: (res as any).seat?.max_gmail_profiles ?? 1,
          });
          toast.success("Hotspot subscription access is now active");
          setTeamOpen(true);
        }).catch((error) => {
          if (live) toast.error(error instanceof Error ? error.message : "This hotspot invitation could not be accepted.");
        }),
      );
    } catch {}
    return () => { live = false; };
  }, [signedIn]);
  /** The signed-in Master Login account; every saved preference is scoped to it. */
  const [uid, setUid] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [appealsOpen, setAppealsOpen] = useState(false);
  const [appealsReturnToSettings, setAppealsReturnToSettings] = useState(false);
  const [tipsOff, setTipsOff] = useState(false);
  useEffect(() => { setTipsOff(tourDismissed()); }, []);
  const uidRef = useRef<string | null>(null);
  uidRef.current = uid;
  useEffect(() => {
    if (!uid) { setPersistedCampaignWorkspace({ campaigns: [], recipients: [], sentLast24Hours: 0, source: 'server_campaigns', truncated: false }); return; }
    let active = true;
    const refresh = () => {
      void getRexCampaignWorkspaceData().then((result) => { if (active) setPersistedCampaignWorkspace(result); })
        .catch((error) => console.warn('Rex could not refresh server campaign records.', error));
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [uid]);
  useEffect(() => {
    if (!uid || activeServerCampaignId) return;
    let live = true;
    void listRexCampaigns().then(({ campaigns }) => {
      if (!live) return;
      const active = campaigns.find((campaign: any) => ["queued", "running", "paused"].includes(campaign.status));
      if (!active) return;
      setActiveServerCampaignId(active.id);
      setServerCampaignStatus(active.status);
      setServerCampaignCounts({
        sent: Number(active.sent_count ?? 0),
        total: Number(active.total_recipients ?? 0),
        failed: Number(active.failed_count ?? 0),
      });
      setEngine(active.status === "paused" ? "paused" : "sending");
      setScout(active.status !== "paused");
    }).catch((error) => console.warn("Could not restore the active server campaign.", error));
    return () => { live = false; };
  }, [uid, activeServerCampaignId]);

  useEffect(() => {
    if (!uid || !activeServerCampaignId) return;
    let live = true;
    const refreshServerCampaign = async () => {
      try {
        const result = await getCampaignExecutionProgress({ data: { campaignId: activeServerCampaignId } });
        if (!live) return;
        const campaign = result.campaign;
        const sent = Number(campaign.sent_count ?? 0);
        const total = Number(campaign.total_recipients ?? 0);
        const failed = Number(campaign.failed_count ?? 0);
        setServerCampaignStatus(campaign.status);
        setServerCampaignCounts({ sent, total, failed });
        const sentEmails = new Set(result.sentEmails);
        setGenerated((previous) => previous.map((row) => ({
          ...row,
          sent: sentEmails.has(row.email.trim().toLowerCase()),
        })));
        if (campaign.status === "paused") { setEngine("paused"); setScout(false); }
        else if (["queued", "running"].includes(campaign.status)) { setEngine("sending"); setScout(true); }
        else { setEngine("idle"); setScout(false); setNextInSec(null); }
      } catch (error) {
        console.warn("Campaign progress refresh failed; the server queue continues independently.", error);
      }
    };
    void refreshServerCampaign();
    const timer = window.setInterval(() => void refreshServerCampaign(), 3000);
    return () => { live = false; window.clearInterval(timer); };
  }, [uid, activeServerCampaignId]);
  const [authChecked, setAuthChecked] = useState(false);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [connectMethodOpen, setConnectMethodOpen] = useState(false);
  const [gmailLearnMoreOpen, setGmailLearnMoreOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [alertPermission, setAlertPermission] = useState<NotificationPermission | "unsupported">(
    notificationPermission(),
  );
  useEffect(() => {
    const refreshPermission = () => setAlertPermission(notificationPermission());
    window.addEventListener("focus", refreshPermission);
    window.addEventListener("pageshow", refreshPermission);
    document.addEventListener("visibilitychange", refreshPermission);
    return () => {
      window.removeEventListener("focus", refreshPermission);
      window.removeEventListener("pageshow", refreshPermission);
      document.removeEventListener("visibilitychange", refreshPermission);
    };
  }, []);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [premiumReason, setPremiumReason] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [assistantCelebrate, setAssistantCelebrate] = useState<{
    ownerEmail: string;
    maxGmails: number;
  } | null>(null);
  const [premiumOnly, setPremiumOnly] = useState<PlanId[] | undefined>(undefined);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamReturnToSettings, setTeamReturnToSettings] = useState(false);
  const [teamCanManage, setTeamCanManage] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const [radarTab, setRadarTab] = useState<"radar" | "snippets" | "monitor">("radar");
  const [assistOpen, setAssistOpen] = useState(false);
  const [rexInitialPrompt, setRexInitialPrompt] = useState("");
  const [rexStudioOpen, setRexStudioOpen] = useState(false);
  const [rexStudioReturnToSettings, setRexStudioReturnToSettings] = useState(false);
  const [rexPersonalDestinationId, setRexPersonalDestinationId] = useState<string | null>(null);
  const [rexSearchResources, setRexSearchResources] = useState<{ features: Array<{ id: string; name: string; slug: string; description: string }>; destinations: Array<{ id: string; name: string; description: string }> }>({ features: [], destinations: [] });
  const [rexResumeConversationId, setRexResumeConversationId] = useState<string | null>(null);
  const [rexReturnAvailable, setRexReturnAvailable] = useState(false);
  /** Every limit or locked feature opens an upgrade path — never a dead button. */
  const askUpgrade = useCallback((reason: string, plan3Only = false) => {
    setPremiumOnly(plan3Only ? ["premium", "promaxx"] : undefined);
    setPremiumReason(reason);
  }, []);
  useEffect(() => {
    if (sessionStorage.getItem("ec_celebrate") === "1") {
      sessionStorage.removeItem("ec_celebrate");
      setCelebrate(true);
    }
    const upgraded = sessionStorage.getItem("ec_upgraded");
    if (upgraded) {
      sessionStorage.removeItem("ec_upgraded");
      toast.success(`${upgraded === "plan2" ? "Plan 2" : "Plan 1"} is now active for 30 days.`);
      setCelebrate(true);
    }
  }, []);
  async function subscribe(plan: PlanId) {
    setCheckoutBusy(plan);
    setCheckoutError(null);
    try {
      const { authorizationUrl } = await startCheckout({ data: { plan } });
      if (window.self !== window.top) window.open(authorizationUrl, "_blank");
      else window.location.href = authorizationUrl;
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Checkout could not start.");
    } finally {
      setCheckoutBusy(null);
    }
  }
  const isCompany = userEmail?.trim().toLowerCase() === "eliteconnectere@gmail.com";
  const companyAdminAccess = Boolean(entitlements?.company || entitlements?.companyAdmin);
  useEffect(() => {
    if (signedIn && !companyAdminAccess) setAdminOpen(false);
  }, [signedIn, companyAdminAccess]);
  const premium = isCompany || (entitlements?.premium ?? false);
  const canCustomize = isCompany || Boolean(entitlements?.customization) || Boolean(entitlements?.companyAdmin);
  const canEditTarget = canCustomize;
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioReturnToSettings, setStudioReturnToSettings] = useState(false);
  const [featureStudioReturnToSettings, setFeatureStudioReturnToSettings] = useState(false);

  const [featureStudio, setFeatureStudio] = useState<"smartFill" | "tracker" | "planner" | "activity" | "sending" | "nightMode" | null>(null);
  const [featureStudioFilter, setFeatureStudioFilter] = useState<{ campaign?: string; activity?: string; runId?: string }>({});
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsReturnToSettings, setChatSettingsReturnToSettings] = useState(false);
  const chatEligible = entitlements ? entitlements.plan === "premium" || entitlements.plan === "promaxx" || entitlements.company || entitlements.companyAdmin === true : false;
  const duplicateProtectionEligible = true;
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const planAlert = (() => {
    const e = entitlements;
    if (!e) return null;
    if (e.allowance != null) {
      if (e.used >= e.allowance) return `Sending allowance used up (${e.used.toLocaleString()} of ${e.allowance.toLocaleString()}). Upgrade to keep sending.`;
      if (e.used >= e.allowance * 0.7) return `70% of your sending allowance used — ${e.used.toLocaleString()} of ${e.allowance.toLocaleString()}.`;
    }
    if (e.planEndsAt) {
      const left = new Date(e.planEndsAt).getTime() - Date.now();
      if (left <= 5 * 86_400_000) {
        const days = Math.max(Math.ceil(left / 86_400_000), 0);
        return days > 0 ? `Your subscription ends in ${days} day${days === 1 ? "" : "s"}.` : "Your subscription has expired.";
      }
    }
    return null;
  })();
  const refreshEntitlements = useCallback(async (): Promise<boolean> => {
    try {
      setEntitlements(await getEntitlements());
      return true;
    } catch (error) {
      console.error("[Workspace] Could not refresh entitlements.", error);
      return false;
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next, uidRef.current);
      return next;
    });
  }, []);

  const [notes, setNotes] = useState<string[]>(["Workspace ready — no campaign running"]);
  const [panel, setPanel] = useState<"none" | "bell" | "menu">("none");
  const [menuView, setMenuView] = useState<
    | "root"
    | "log"
    | "planner"
    | "settings"
    | "scope"
    | "history"
  | "notifications"
  | "campaignProtection"
  | "tools"
    | "appearance"
    | "subscription"
  >("root");
  const [settingsSearch, setSettingsSearch] = useState("");
  const settingsSearchItems: Array<[string, string, typeof menuView, string]> = [
    ["Campaign protection", "Permanent duplicate protection and Gmail rotation", "campaignProtection", "duplicate duplicate protection permanent protection gmail rotation plan 3"],
    ["Sending sounds", "Tools & Visibility / Notification and Sound Management", "notifications", "sound sounds sending send air swish notification audio ringtone"],
    ["Smart Fill history", "Saved email sets", "history", "history smart fill saved sets email"],
    ["Tools & Visibility", "Smart Fill, tracker, planner and sending modes", "tools", "tools visibility tracker planner sending modes"],
    ["Interface customization", "Colours, type, shape and density", "appearance", "interface customization colour colors typography font shape density"],
    ["Subscription", "Plan and billing", "subscription", "subscription plan billing upgrade payment"],
  ];
  const applicationSearchExtras = [
    ...rexSearchResources.features.map(item => ({
      place: "rex-feature-" + item.id,
      label: item.name,
      purpose: item.description || "User-created Rex dynamic feature " + item.slug,
      kind: "page" as const,
      aliases: [item.slug, "custom feature", "dynamic feature"],
    })),
    ...rexSearchResources.destinations.map(item => ({
      place: "rex-destination-" + item.id,
      label: item.name,
      purpose: item.description || "User-created personal workspace destination",
      kind: "page" as const,
      aliases: ["personal destination", "saved destination"],
    })),
  ];
  const applicationSearchResults = searchApplicationCatalog(settingsSearch, 24, [
    ...settingsSearchItems.map(([label, description, , keywords]) => ({
      place: "settings-search-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      purpose: description,
      parent: "settings",
      kind: "settings" as const,
      aliases: keywords.split(/\s+/),
    })),
    ...applicationSearchExtras,
  ]);
  const [plannerKind, setPlannerKind] = useState<"Note" | "Plan" | "Template">("Note");
  const [plannerTitle, setPlannerTitle] = useState("");
  const [plannerBody, setPlannerBody] = useState("");
  const [planner, setPlanner] = useState<PlannerItem[]>([]);
  const [plannerEditing, setPlannerEditing] = useState<number | null>(null);
  const [smartFillHistory, setSmartFillHistory] = useState<SmartFillSet[]>([]);

  const [confirming, setConfirming] = useState<
    | { kind: "profile"; id: string; email: string }
    | { kind: "erase" }
    | {
        kind: "setting";
        setting: "sounds" | "sendingSound" | "vibration" | "activityRecording";
        title: string;
        body: string;
      }
    | null
  >(null);
  const [eraseRequest, setEraseRequest] = useState<{ status: "countdown"; requested_at: string; expires_at: string } | null>(null);
  const [eraseStatusChecked, setEraseStatusChecked] = useState(false);
  const [eraseNow, setEraseNow] = useState(Date.now());
  const [eraseBusy, setEraseBusy] = useState(false);
  const [eraseWarningOpen, setEraseWarningOpen] = useState(false);
  const [eraseImpactExpanded, setEraseImpactExpanded] = useState(false);
  const [guide, setGuide] = useState<{ msg: string; target: "recipients" | "profiles" } | null>(
    null,
  );

  const recipientsRef = useRef<HTMLElement | null>(null);
  const profilesRef = useRef<HTMLElement | null>(null);

  /**
   * Only genuinely important system events reach the notification centre, and
   * each kind can be switched off in Notification and Sound Management.
   */
  const log = useCallback(
    (msg: string, kind?: NotificationKind) => {
      // Activity history and alerts are independent controls: disabling history
      // must not silently disable campaign sounds or phone notifications.
      if (settings.activityRecording) setNotes((n) => [msg, ...n].slice(0, 40));

      // Persist a privacy-minimised event signal for Rex's live operations feed.
      // Do not store message bodies, recipient addresses, tokens, or raw provider errors.
      const actorId = uidRef.current;
      if (actorId && kind) {
        void (supabase as any).from("rex_events").insert({
          user_id: actorId,
          kind,
          severity: kind === "campaignCompleted" ? "info" : "notice",
          title: kind,
          detail: "Application event recorded.",
          event_key: "notification." + kind,
          source: "app",
          metadata: { messageLength: msg.length },
          occurred_at: new Date().toISOString(),
        }).then(({ error }: { error: unknown }) => {
          if (error) console.warn("[Rex] Event telemetry could not be persisted.");
        });
      }

      if (!kind || !settings.notifications[kind]) return;
      void showSystemNotification("Elite Connectere", msg, true);
      if (kind === "campaignCompleted") {
        playAlarmRingtone(settings.alarmRingtone || settings.notificationSound, settings.sounds !== false);
        vibrate([80, 40, 80, 40, 80], settings.vibration !== false);
      } else {
        playSound(settings.notificationSound, settings.sounds !== false);
        vibrate([55, 45, 55], settings.vibration !== false);
      }
    },
    [settings],
  );

  useEffect(() => {
    if (planAlert) setNotes((n) => (n[0] === planAlert ? n : [planAlert, ...n].slice(0, 40)));
    if (planAlert) {
      playSound("warning", settings.sounds !== false);
      vibrate([55, 45, 55], settings.vibration !== false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planAlert]);
  useEffect(() => {
    if (celebrate) {
      playSound("unlock", settings.sounds !== false);
      vibrate([45, 35, 45], settings.vibration !== false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);
  function requestSettingOff(setting: "sounds" | "sendingSound" | "vibration" | "activityRecording") {
    const copy = {
      sounds: ["Turn off all sounds?", "You will no longer hear notification, chat, alarm, or email-sent sounds."],
      sendingSound: ["Turn off sending sound?", "You will no longer hear the confirmation swoosh after an email is sent."],
      vibration: ["Turn off vibration?", "You will no longer receive haptic feedback for alerts and confirmations."],
      activityRecording: ["Stop activity recording?", "New workspace events will no longer appear in Activity Log."],
    } as const;
    const [title, body] = copy[setting];
    setConfirming({ kind: "setting", setting, title, body });
  }

  // Keep the inbox listener active for every signed-in participant. Existing
  // conversations must still notify a Hotspot member even if entitlement UI
  // is refreshing; Supabase RLS limits realtime rows to their own connections.
  const chatHub = useChatHub({
    enabled: signedIn,
    activeConnectionId: chatOpen ? activeChat : null,
    sounds: settings.sounds !== false && settings.chatSounds !== false,
    notify: (kind, text) => {
      log(text, kind);
      if (settings.notifications[kind] !== false) toast(text);
    },
  });

  /* ---- customer-facing guidance: scroll + highlight the exact control ---- */
  function guideTo(target: "recipients" | "profiles", msg: string) {
    setGuide({ target, msg });
    toast.error(msg);
    const el = target === "recipients" ? recipientsRef.current : profilesRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setGuide(null), 3000);
  }

  // While the workspace menu is open, any interaction outside its panel closes it.
  // Keep menu controls usable and preserve the hamburger's second-tap toggle.
  useEffect(() => {
    if (panel !== "menu") return;
    const isInsideMenuOrTrigger = (event: Event) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const target = event.target instanceof Element ? event.target : null;
      return path.some((node) => node instanceof Element && (
        node.matches('[data-ec-menu-scroll="true"]') ||
        node.matches('[data-tour="menu"]') ||
        !!node.closest('[data-ec-menu-scroll="true"]') ||
        !!node.closest('[data-tour="menu"]')
      )) || !!target?.closest('[data-ec-menu-scroll="true"], [data-tour="menu"]');
    };
    const closeFromOutside = (event: Event) => {
      if (isInsideMenuOrTrigger(event)) return;
      setPanel("none");
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || !isInsideMenuOrTrigger(event)) setPanel("none");
    };
    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [panel]);

  function openMenu() {
    setMenuView("root");
    setPanel((p) => (p === "menu" ? "none" : "menu"));
  }

  function switchMode(next: "standard" | "elite") {
    if (next === mode || phase !== "idle") return;
    if (next === "elite" && entitlements && !entitlements.premium && !entitlements.trialActive && !entitlements.communityPromo) {
      askUpgrade("Your 10-day Elite Engine free trial has ended. Subscribe to keep using Elite Engine.");
      return;
    }
    setPhase("out");
    window.setTimeout(() => {
      setMode(next);
      setPhase("in");
      window.setTimeout(() => setPhase("idle"), 520);
    }, 460);
  }

  function statusOf(p: GmailProfile): "ACTIVE" | "STANDBY" | "EXHAUSTED" {
    if (p.exhausted) return "EXHAUSTED";
    return p.id === activeProfileId ? "ACTIVE" : "STANDBY";
  }

  useEffect(() => {
    setAccepted(readOnboarding() === TERMS_VERSION);
  }, []);

  useEffect(() => {
    if (!uid) {
      setEraseRequest(null);
      setEraseStatusChecked(true);
      return;
    }
    let active = true;
    setEraseStatusChecked(false);
    void (supabase as any).from("user_data_erasure_requests")
      .select("status, requested_at, expires_at")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data, error }: { data: { status: string; requested_at: string; expires_at: string } | null; error: unknown }) => {
        if (!active) return;
        if (error) {
          console.warn("Could not restore the erasure countdown.", error);
          return;
        }
        setEraseRequest(data?.status === "countdown" ? data as { status: "countdown"; requested_at: string; expires_at: string } : null);
        setEraseNow(Date.now());
        setEraseStatusChecked(true);
      });
    return () => { active = false; };
  }, [uid]);

  useEffect(() => {
    if (!eraseRequest || !uid) return;
    setEraseNow(Date.now());
    let lastStatusCheck = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      setEraseNow(now);
      // Keep other open tabs in sync if the owner cancels or confirms elsewhere.
      if (now - lastStatusCheck >= 10000) {
        lastStatusCheck = now;
        void (supabase as any).from("user_data_erasure_requests")
          .select("status, requested_at, expires_at")
          .eq("user_id", uid)
          .maybeSingle()
          .then(({ data, error }: { data: { status: string; requested_at: string; expires_at: string } | null; error: unknown }) => {
            if (!error) {
              setEraseRequest(data?.status === "countdown" ? data as { status: "countdown"; requested_at: string; expires_at: string } : null);
            }
          });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [eraseRequest?.expires_at, uid]);

  /* ---- restore this account's own workspace + preferences ---- */
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setSettings(loadSettings(uid));
    cloudWorkspaceRevisionRef.current = 0;
    cloudWorkspaceConflictRef.current = false;
    cloudWorkspaceLastPayloadRef.current = null;
    if (!uid) return () => { cancelled = true; };

    const restore = async () => {
      const localSnapshot = loadWorkspace(uid);
      let snapshot: Partial<WorkspaceSnapshot> | null = localSnapshot;
      try {
        const cloud = await getWorkspaceSnapshot();
        if (cancelled) return;
        cloudWorkspaceRevisionRef.current = cloud.revision;
        if (cloud.snapshot) {
          snapshot = { ...cloud.snapshot, campaignRuns: localSnapshot?.campaignRuns, sentRecipientEmails: localSnapshot?.sentRecipientEmails } as Partial<WorkspaceSnapshot>;
          const cloudPayload = { ...cloud.snapshot } as Record<string, unknown>;
          delete cloudPayload["campaignRuns"];
          delete cloudPayload["sentRecipientEmails"];
          cloudWorkspaceLastPayloadRef.current = JSON.stringify(cloudPayload);
          saveWorkspace(snapshot as WorkspaceSnapshot, uid);
        } else if (localSnapshot) {
          const migrated = await saveWorkspaceSnapshot({ data: { snapshot: localSnapshot as WorkspaceSnapshot, expectedRevision: 0 } });
          if (cancelled) return;
          if (migrated.ok) {
            cloudWorkspaceRevisionRef.current = migrated.revision;
            const cloudPayload = { ...localSnapshot } as Record<string, unknown>;
            delete cloudPayload["campaignRuns"];
            delete cloudPayload["sentRecipientEmails"];
            cloudWorkspaceLastPayloadRef.current = JSON.stringify(cloudPayload);
          } else cloudWorkspaceConflictRef.current = true;
        }
      } catch (error) {
        console.warn('Cloud workspace sync unavailable; using this device saved workspace.', error);
      }
      if (cancelled) return;
      if (snapshot) {
        if (snapshot.mode) setMode("elite");
        if (typeof snapshot.raw === 'string') setRaw(snapshot.raw);
        if (snapshot.recipients) setRecipients(snapshot.recipients.map((r) => ((r.status as string) === 'invalid' ? { ...r, status: 'risky' as const } : r)));
        if (typeof snapshot.validated === 'boolean') setValidated(snapshot.validated);
        if (typeof snapshot.editing === 'boolean') setEditing(snapshot.editing);
        if (snapshot.tab) setTab((snapshot.tab === 'invalid' ? 'risky' : snapshot.tab) as Status);
        if (typeof snapshot.twoWay === 'boolean') setTwoWay(snapshot.twoWay);
        if (snapshot.tplA) setTplA(snapshot.tplA);
        if (snapshot.tplB) setTplB(snapshot.tplB);
        if (snapshot.generated) setGenerated(snapshot.generated);
        if (snapshot.campaignHistory) setCampaignHistory(snapshot.campaignHistory.slice(0, 5));
        if (Array.isArray(snapshot.campaignRuns)) {
          const restoredRuns = snapshot.campaignRuns.slice(0, 5);
          setCampaignRuns(restoredRuns);
          const resumeRequested = localStorage.getItem(campaignResumeKey(uid)) === '1' || localStorage.getItem('ec-engine-resume') === '1';
          const resumable = restoredRuns.find((run) => run.status === 'running' || run.status === 'paused');
          if (resumeRequested && resumable) {
            activeCampaignIdRef.current = resumable.id;
            setCampaignRuns((previous) => previous.map((run) => run.id === resumable.id ? (({ finishedAt: _f, ...rest }) => ({ ...rest, status: 'paused' as const }))(run) : run));
            setEngine('paused');
            setAutoResumePending(true);
            try { localStorage.setItem(campaignResumeKey(uid), '1'); localStorage.removeItem('ec-engine-resume'); } catch {}
          } else if (resumeRequested) {
            try { localStorage.removeItem(campaignResumeKey(uid)); localStorage.removeItem('ec-engine-resume'); } catch {}
          }
        }
        if (snapshot.sentRecipientEmails) { const history = snapshot.sentRecipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean); sentRecipientEmailsRef.current = new Set(history); setSentRecipientEmails(history); }
        if (snapshot.genTab) setGenTab(snapshot.genTab as 'all' | 'sent' | 'pending');
        if (snapshot.delay) setDelay(snapshot.delay >= 3 && snapshot.delay <= 8 ? snapshot.delay : 5);
        if (snapshot.from) setFrom(snapshot.from);
        if (snapshot.to) setTo(snapshot.to);
        if (snapshot.scope) setScope(snapshot.scope);
        if (snapshot.defaultScope) setDefaultScope(snapshot.defaultScope);
        if (snapshot.planner) setPlanner(snapshot.planner);
        if (snapshot.notes?.length) setNotes(snapshot.notes);
        if (snapshot.smartFillHistory) setSmartFillHistory(snapshot.smartFillHistory);
        if (snapshot.activeProfileId) setActiveProfileId(snapshot.activeProfileId);
      }
      setReady(true);
    };
    void restore();
    return () => { cancelled = true; };
  }, [uid]);

  /* ---- subscription / trial state (server is authoritative) ---- */
  useEffect(() => {
    let cancelled = false;
    const refreshCompanyAccessAndNotices = async () => {
      try {
        const ent = await getEntitlements();
        if (cancelled) return;
        setEntitlements(ent);
        const { getMyCompanyNotifications, markMyCompanyNotificationsRead } = await import("@/lib/company-team.functions");
        const notices = await getMyCompanyNotifications();
        if (cancelled) return;
        const unread = notices.filter((notice: { read_at?: string | null }) => !notice.read_at);
        for (const notice of unread) toast.info(notice.title, { description: notice.body, duration: 8000 });
        if (unread.length) await markMyCompanyNotificationsRead();
      } catch (error) {
        console.warn("[Company] Could not refresh Company access or notifications.", error);
      }
    };
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && !cancelled) await refreshCompanyAccessAndNotices();
    })();
    const onFocus = () => { if (signedIn) void refreshCompanyAccessAndNotices(); };
    const onVisibility = () => { if (document.visibilityState === "visible") onFocus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [signedIn]);

  useEffect(() => {
  try {
    window.localStorage.setItem("ec.permanent-send-protection", JSON.stringify(permanentSendProtection));
    if (uid) window.localStorage.setItem(`ec.permanent-send-protection:${uid}`, String(permanentSendProtection));
  } catch { /* storage unavailable */ }
  }, [permanentSendProtection]);

  useEffect(() => {
  applyAppearance(settings, canCustomize);
    const root = document.documentElement;
  root.classList.toggle("night-mode-light", Boolean(settings.nightModeLight && canCustomize));
  root.dataset["nightAnimation"] = settings.nightModeAnimation;
  root.classList.toggle("ec-glass", settings.shapeMode === "glass-pill");
  root.dataset["shapeMode"] = settings["shapeMode"];
  root.dataset["nightColor"] = settings["nightModeColor"];
  root.dataset["nightSpeed"] = settings["nightModeSpeed"];
  root.style.setProperty("--night-custom", settings.nightModeCustomColor);
  root.style.setProperty("--night-intensity", String(Math.max(1, settings.nightModeIntensity)));
  }, [settings, canCustomize]);

  /* ---- persist it again on every meaningful change ---- */
  useEffect(() => {
    if (!ready || !uid) return;
    const snapshot: WorkspaceSnapshot = {
      v: 1,
      mode: mode === "elite" ? "elite" : "standard",
      raw,
      recipients,
      validated,
      editing,
      tab,
      twoWay,
      tplA,
      tplB,
      generated,
      genTab,
  delay,
  permanentSendProtection,
  from,
      to,
      scope,
      defaultScope,
      planner,
      notes,
      smartFillHistory,
      activeProfileId,
    sentRecipientEmails,
    campaignHistory,
    campaignRuns,
  };
    const id = window.setTimeout(() => {
      saveWorkspace(snapshot, uid);
      if (cloudWorkspaceConflictRef.current) return;
      const cloudSnapshot = { ...snapshot };
      delete cloudSnapshot.campaignRuns;
      delete cloudSnapshot.sentRecipientEmails;
      const cloudPayload = JSON.stringify(cloudSnapshot);
      if (cloudWorkspaceLastPayloadRef.current === cloudPayload) return;
      cloudWorkspaceLastPayloadRef.current = cloudPayload;
      void saveWorkspaceSnapshot({ data: { snapshot: cloudSnapshot, expectedRevision: cloudWorkspaceRevisionRef.current } })
        .then((result) => {
          if (result.ok) cloudWorkspaceRevisionRef.current = result.revision;
          else {
            cloudWorkspaceConflictRef.current = true;
            toast.warning("A newer workspace version exists on another device. Refresh this app to load it before continuing edits.");
          }
        })
        .catch((error) => {
          if (cloudWorkspaceLastPayloadRef.current === cloudPayload) cloudWorkspaceLastPayloadRef.current = null;
          console.warn("Cloud workspace save failed; local copy preserved.", error);
        });
    }, 900);
    return () => window.clearTimeout(id);
  }, [
    ready,
    uid,
    mode,
    raw,
    recipients,
    validated,
    editing,
    tab,
    twoWay,
    tplA,
    tplB,
    generated,
    genTab,
    delay,
    from,
    to,
    scope,
    defaultScope,
    planner,
    notes,
    smartFillHistory,
    activeProfileId,
    sentRecipientEmails,
  campaignHistory,
    campaignRuns,
  ]);

  /* ---- connected Gmail profiles (server is authoritative) ---- */

  const applyProfiles = useCallback(
    (next: GmailProfile[]) => {
      setProfiles(next);
      setOffline(false);
      setActiveProfileId((current) => {
        const stillThere = next.some((p) => p.id === current && !p.exhausted);
        if (stillThere) return current;
        return next.find((p) => !p.exhausted)?.id ?? next[0]?.id ?? null;
      });
    },
    [],
  );

  const refreshProfiles = useCallback(async (): Promise<boolean> => {
    let session = null;
    try {
      session = await getWorkspaceDisplaySession();
    } catch (error) {
      console.warn("Could not resolve the locally saved workspace session.", error);
      setOffline(true);
      return false;
    }
    setSignedIn(Boolean(session));
    setUid(session?.user.id ?? null);
    setUserEmail(session?.user.email ?? null);
    setAuthChecked(true);
    if (!session) {
      setProfiles([]);
      setOffline(false);
      return true;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // Keep the account's locally saved workspace snapshot visible.
      // Gmail profiles and all server-backed actions remain unavailable offline.
      setOffline(true);
      return false;
    }
    try {
      const res = await listGmailProfiles();
      applyProfiles(res.profiles);
      return true;
    } catch (error) {
      console.error("[Workspace] Could not refresh Gmail profiles.", error);
      // Keep the workspace and the connected profiles exactly as they are.
      setOffline(true);
      return false;
    }
  }, [applyProfiles]);

  useEffect(() => {
    void refreshProfiles();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        setAutoResumePending(false);
        setEngine("idle");
        setScout(false);
        if (uidRef.current) {
          try { localStorage.removeItem(campaignResumeKey(uidRef.current)); } catch {}
        }
        finishCampaignRun("stopped");
        activeCampaignIdRef.current = null;
      }
      void refreshProfiles();
    });
    return () => data.subscription.unsubscribe();
  }, [refreshProfiles]);

  /* reconnect reconciliation when the network comes back */
  useEffect(() => {
    const onOnline = () => void refreshProfiles();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshProfiles]);

  const [needsReconnect, setNeedsReconnect] = useState<Record<string, boolean>>({});

  async function connectGmail() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setConnectNote("Sign in first ��� your Gmail connections are stored against your account.");
      void navigate({ to: "/auth" });
      return;
    }
    const limit = entitlements?.profileLimit ?? 10;
    if (profiles.length >= limit) {
      askUpgrade(`You've connected ${limit} of ${limit} Gmail profiles on your plan. Upgrade to add more.`);
      return;
    }
    setGmailBusy(true);
    setConnectNote("");
    try {
      const result = await connectGmailAccount();
      if (result.locked) {
        askUpgrade(
          result.reason === "trial_expired"
            ? "Your 10-day Elite Engine free trial has ended. Subscribe to keep using Elite Engine."
            : result.reason === "profile_limit"
              ? `You've connected ${result.limit} of ${result.limit} Gmail profiles on your plan. Upgrade to add more.`
              : "The free trial allows 3 Gmail profiles per day, and today's are used. Disconnecting doesn't free one up. Subscribe to connect more.",
        );
        return;
      }
      applyProfiles(result.profiles);
      if (result.reason === "limit_reached") {
        askUpgrade("Your plan's Gmail profile limit is reached. Upgrade to add more.");
      } else if (result.reason === "no_send_scope") {
        setConnectNote("Google didn't allow sending. Connect again and tick the “Send email” permission.");
      } else if (result.reason === "no_identity") {
        setConnectNote("Google did not confirm that address. Try connecting it again.");
      } else {
        setConnectNote("");
        toast.success("Gmail profile connected successfully", { description: result.email ?? undefined });
        const match = result.profiles.find((p) => p.email === result.email);
        if (match) setNeedsReconnect((m) => ({ ...m, [match.id]: false }));
        log(`Gmail profile connected — ${result.email}`, "gmailAuth");
      }
      setSelectorOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Google connection failed.";
      setConnectNote(msg);
      toast.error(msg);
      log(`Gmail connection failed — ${msg}`, "gmailAuth");
    } finally {
      setGmailBusy(false);
    }
  }

  async function testProfile(id: string, email: string) {
    setGmailBusy(true);
    try {
      const r = await testGmailProfile({ data: { profileId: id } });
      if (r.ok) {
        setNeedsReconnect((m) => ({ ...m, [id]: false }));
        toast.success(`Test email sent from ${email}`, { description: "Check that inbox." });
      } else if (r.reason === "reconnect") {
        setNeedsReconnect((m) => ({ ...m, [id]: true }));
        toast.error("This Gmail's access has expired. Tap Reconnect.");
      } else {
        toast.error("The test email could not be sent. Try again shortly.");
      }
    } catch {
      toast.error("The test email could not be sent. Try again shortly.");
    } finally {
      setGmailBusy(false);
    }
  }

  async function disconnectProfile(id: string, email: string) {
    setConfirming(null);
    setGmailBusy(true);
    try {
      const res = await disconnectGmailProfile({ data: { profileId: id } });
      applyProfiles(res.profiles);
      log(`Gmail profile disconnected — ${email}`, "gmailDisconnected");
    } catch (error) {
      console.error(error);
      setConnectNote("That profile could not be disconnected right now. Try again in a moment.");
    } finally {
      setGmailBusy(false);
    }
  }

  const valid = useMemo(() => recipients.filter((r) => r.status === "valid"), [recipients]);
  const counts = {
    valid: valid.length,
    duplicate: recipients.filter((r) => r.status === "duplicate").length,
    risky: recipients.filter((r) => r.status === "risky").length,
  };
  const sentCount = activeServerCampaignId ? serverCampaignCounts.sent : generated.filter((g) => g.sent).length;
  // Pending/Queued cover the whole current dataset — nothing is dropped unless the user removes it.
  const pending = activeServerCampaignId ? Math.max(serverCampaignCounts.total - serverCampaignCounts.sent - serverCampaignCounts.failed, 0) : validated ? Math.max(generated.length - sentCount, 0) : 0;

  function buildGenerated(list: Recipient[]) {
    const hasA = Boolean(tplA.subject.trim() && tplA.body.trim());
    const hasB = Boolean(tplB.subject.trim() && tplB.body.trim());
    const useRotation = twoWay && hasA && hasB;
    return list.map((r, i) => {
      const slot: "A" | "B" = useRotation ? (i % 2 === 1 ? "B" : "A") : (twoWay && !hasA && hasB ? "B" : "A");
      const tpl = slot === "B" ? tplB : tplA;
      const complete = Boolean(tpl.subject.trim() && tpl.body.trim());
      return {
        id: i + 1,
        email: r.email,
        name: r.name,
        company: r.company,
        template: slot,
        subject: complete ? fill(tpl.subject, r) : "",
        body: complete ? fill(tpl.body, r) : "",
        sent: false,
      };
    });
  }

  /** Re-validating never touches the 24-hour Gmail trackers — only the list. */
  async function validate(): Promise<{ ok: boolean; valid: number; risky: number; duplicate: number }> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You're offline — reconnect to validate recipients.");
      return { ok: false, valid: 0, risky: 0, duplicate: 0 };
    }
    if (!raw.trim() && recipients.length === 0) {
      guideTo("recipients", "Add some email addresses first — paste a list or use Smart Fill.");
      return { ok: false, valid: 0, risky: 0, duplicate: 0 };
    }
    const sourceText = raw.trim() || rexImportRawRef.current.trim();
    const parsed = sourceText ? parseRecipientFileText(sourceText) : recipients;
    const scanned = await enrichWithDomainScan(parsed);
    const list = scanned;
    if (list.length === 0) {
      toast.error("No valid email addresses were found. Check the list and try again.");
      return { ok: false, valid: 0, risky: 0, duplicate: 0 };
    }
  const alreadySent = new Set([
    ...generated.filter((g) => g.sent).map((g) => g.email.trim().toLowerCase()),
    ...sentRecipientEmailsRef.current,
  ]);
  setRecipients(list);
    setValidated(list.length > 0);
    setEditing(false);
    setTab("valid");
    // The parser already returns only syntactically valid, unique email addresses.
    const nextGenerated = buildGenerated(list).map((g) => ({ ...g, sent: alreadySent.has(g.email) }));
    setGenerated(nextGenerated);
    setGenTab("all");
  // Protection explicitly controls resume behavior: protected campaigns continue
  // from the first pending recipient; unprotected validation starts at the beginning.
  // Always continue from the first unsent recipient so a run picks up where it stopped.
  const firstPending = nextGenerated.find((g) => !g.sent)?.id ?? 1;
  const resumeFromPending = alreadySent.size > 0 && nextGenerated.some((g) => g.sent);
  setFrom(resumeFromPending ? firstPending : 1);
  setTo(Math.max(resumeFromPending ? firstPending : 1, Math.min(list.length, (resumeFromPending ? firstPending - 1 : 0) + scope)));
  if (resumeFromPending) {
    const done = nextGenerated.filter((g) => g.sent).length;
    toast.info(`${done} already got this exact message — skipping them. Continuing from #${firstPending}. Change subject/body to message them again.`);
  }
    rememberSmartFillSet(list);
    toast.success(`Validation completed: ${list.length} unique addresses ready for the server queue.`);
    return { ok: true, valid: list.length, risky: list.filter(r => r.status === "risky").length, duplicate: 0 };
  }

  /** Smart Fill History keeps only the latest 3 genuine sets the user supplied. */
  function rememberSmartFillSet(list: Recipient[]) {
    if (list.length < 2) return;
    const emails = list.map((r) => r.email).join("\n");
    setSmartFillHistory((prev) => {
      if (prev[0]?.emails === emails) return prev;
      const name = `${list[0]?.company ?? "Leads"} set`;
      return [{ name, count: list.length, emails, savedAt: Date.now() }, ...prev].slice(0, 3);
    });
  }

  function smartFill() {
    const saved = smartFillHistory[0];
    const list = saved
      ? saved.emails.split("\n")
      : buildSmartFill(Math.max(scope, 50)).map((r) => r.email);
    // Scan what this account already sent so the run continues where it stopped.
    const alreadySent = new Set([
      ...generatedRef.current.filter((g) => g.sent).map((g) => g.email.trim().toLowerCase()),
      ...sentRecipientEmailsRef.current,
    ]);
    const sentCount = list.filter((e) => alreadySent.has(e.trim().toLowerCase())).length;
    setRaw(list.join("\n"));
    setRecipients([]);
    setValidated(false);
    setEditing(true);
    setGenerated([]);
    if (sentCount > 0) {
      const left = list.length - sentCount;
      toast.info(
        left > 0
          ? `${sentCount} already got this exact message (skipped on purpose). Validate / Execute continues with the next ${left} unsent. Change subject or body to message the others again.`
          : `All ${sentCount} already received this exact message. It will not send again. Change the subject or body for a new message, or use a different list. Reset only clears the workspace screen.`,
      );
    }
  }

  function exportCsv() {
    const rows = [
      ["id", "email", "subject", "template", "sent"],
      ...generated.map((g) => [
        String(g.id),
        g.email,
        `"${g.subject.replace(/"/g, '""')}"`,
        g.template,
        g.sent ? "sent" : "pending",
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elite-connectere-campaign.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Reset Workspace — clears the working campaign, keeps saved app data. */
  function resetWorkspace() {
    finishCampaignRun("stopped");
    setRecipients([]);
    setRaw("");
    setValidated(false);
    setEditing(true);
    setGenerated([]);
    setScout(false);
    setEngine("idle");
    setAutoResumePending(false);
    try {
      if (uid) localStorage.removeItem(campaignResumeKey(uid));
      localStorage.removeItem("ec-engine-resume");
    } catch {}
    setNextInSec(null);
    // Clear client-side send locks so a new campaign (new body/subject) can run.
    // Server Permanent Send Protection still blocks the EXACT same message only.
    sentRecipientEmailsRef.current = new Set();
    setSentRecipientEmails([]);
  }

  async function startEraseCountdown() {
    if (!uid) {
      toast.error("Sign in to request account workspace erasure.");
      return;
    }
    setEraseBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("start_user_data_erasure");
      if (error) throw error;
      setEraseRequest(data as { status: "countdown"; requested_at: string; expires_at: string });
      setEraseWarningOpen(false);
      setEraseNow(Date.now());
      setPanel("none");
      setConfirming(null);
      toast.success("30-minute erasure countdown started", {
        description: "You can continue using the workspace and cancel at any time before the final decision.",
      });
    } catch (error) {
      console.error(error);
      toast.error("The erasure countdown could not be started. Your data has not been changed.");
    } finally {
      setEraseBusy(false);
    }
  }

  async function cancelEraseCountdown() {
    setEraseBusy(true);
    try {
      const { error } = await (supabase as any).rpc("cancel_user_data_erasure");
      if (error) throw error;
      setEraseRequest(null);
      toast.success("Erasure cancelled — your data is being kept.");
    } catch (error) {
      console.error(error);
      toast.error("The erasure request could not be cancelled. Please retry.");
    } finally {
      setEraseBusy(false);
    }
  }

  async function confirmEraseData() {
    if (!uid) {
      toast.error("Your session is unavailable. Sign in again before confirming.");
      return;
    }
    setEraseBusy(true);
    try {
      // Revoke connected Google grants through the existing server-side disconnect handler
      // before the encrypted connection records are removed by the database erasure transaction.
      const { profiles: currentProfiles } = await listGmailProfiles();
      for (const profile of currentProfiles) {
        await disconnectGmailProfile({ data: { profileId: profile.id } });
      }

      // Remove image objects while their message ownership rows still exist for Storage RLS.
      const { data: imageRows, error: imageQueryError } = await (supabase as any)
        .from("chat_messages")
        .select("image_path")
        .eq("sender_id", uid)
        .not("image_path", "is", null);
      if (imageQueryError) throw imageQueryError;
      const imagePaths: string[] = [...new Set<string>((imageRows ?? []).map((row: { image_path: string | null }) => row.image_path).filter((path: string | null): path is string => Boolean(path)))];
      if (imagePaths.length) {
        const { error: storageError } = await supabase.storage.from("chat-images").remove(imagePaths);
        if (storageError) throw storageError;
      }

      const { error } = await (supabase as any).rpc("confirm_user_data_erasure");
      if (error) throw error;

      // The server transaction preserves Master Login, billing, subscription entitlements,
      // send statistics and protected identity limits. Only personal workspace data is removed.
      setEngine("idle");
      setScout(false);
      setAutoResumePending(false);
      activeCampaignIdRef.current = null;
      try {
        localStorage.removeItem(campaignResumeKey(uid));
        localStorage.removeItem("ec-engine-resume");
      } catch {}
      setActiveProfileId(null);
      applyProfiles([]);
      setSettings(DEFAULT_SETTINGS);
      saveSettings(DEFAULT_SETTINGS, uid);
      resetTour();
      resetWorkspace();
      setPlanner([]);
      setSmartFillHistory([]);
      setNotes([]);
      setScope(50);
      setDefaultScope(50);
      setCampaignHistory([]);
      setCampaignRuns([]);
      setSentRecipientEmails([]);
      sentRecipientEmailsRef.current = new Set();
      clearWorkspaceStorage(uid);
      try {
        localStorage.removeItem("ec.workspace.v2");
        localStorage.removeItem("ec.settings.v1");
        localStorage.removeItem("ec.magic.pos.v2");
        localStorage.removeItem("ec.dyk.dismissed.v1");
        localStorage.removeItem("ec.dyk.lastShown.v1");
        localStorage.removeItem(`rex-last-conversation:${uid}`);
        localStorage.removeItem(`rex-new-chat:${uid}`);
        localStorage.removeItem(`ec.magic.manual-wheel-hint.v1:${uid}`);
        Object.keys(localStorage).filter((key) => key.startsWith("rex-approved-campaign:")).forEach((key) => localStorage.removeItem(key));
        sessionStorage.removeItem(`rex-live-session:${uid}`);
      } catch {}
      setPanel("none");
      setConfirming(null);
      setEraseRequest(null);
      toast.success("Personal workspace data erased", {
        description: "Your Master Login, payments, subscription, sending limits and protected usage statistics were preserved.",
      });
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error(error);
      toast.error("Erasure could not be completed. No final confirmation was recorded; please retry or choose to keep your data.");
    } finally {
      setEraseBusy(false);
    }
  }

  /* live mirror of the queue so the scheduler never mutates state inside an updater */
  const generatedRef = useRef<Generated[]>([]);
  const rexImportRawRef = useRef<string>("");
  useEffect(() => {
    generatedRef.current = generated;
  }, [generated]);
  const activeRef = useRef<string | null>(null);
  useEffect(() => {
    activeRef.current = activeProfileId;
  }, [activeProfileId]);

  const usableProfiles = profiles.filter((p) => !p.exhausted);
  const canSendElite = usableProfiles.length > 0;

  function importRecipientsIntoWorkspace(rawFile: string, sourceName = "Imported list"): boolean {
    if (engine === "sending" || engine === "paused") {
      try { (window as any).__ecLastImportError = "A campaign is still sending or paused. Pause/stop it before replacing the recipient list."; } catch {}
      toast.error("Pause or stop the active campaign before replacing its recipient list.");
      return false;
    }
    const imported = parseRecipientFileText(rawFile);
    if (!imported.length) {
      try { (window as any).__ecLastImportError = "No usable email addresses were parsed from the staged text (need valid emails or an Email column)."; } catch {}
      toast.error("No usable email addresses were found. Check that the file has an Email column or valid email addresses.");
      return false;
    }
    try { (window as any).__ecLastImportError = ""; } catch {}
    rexImportRawRef.current = rawFile;
    setRecipients(imported);
    setRaw(rawFile);
    setValidated(false);
    setEditing(true);
    setGenerated([]);
    setTab("valid");
    setFrom(1);
    setTo(imported.length);
    log(`${imported.length.toLocaleString()} recipients imported into the active workspace from ${sourceName}. Validate the list before executing a campaign.`);
    toast.success(`${imported.length.toLocaleString()} recipients loaded into the workspace. Validate the list before sending.`);
    return true;
  }

  async function prepareCurrentCampaignForRex(): Promise<string> {
    if (mode !== "elite") throw new Error("Switch to Elite Engine before asking Rex to prepare a campaign.");
    let sourceRows = generatedRef.current;
    let sourceRecipients = recipients;
    if (!validated) {
      const sourceText = raw.trim() || rexImportRawRef.current.trim();
      const inputRows = sourceText ? parseRecipientFileText(sourceText) : recipients;
      if (inputRows.length === 0) throw new Error("I couldn't find a recipient list. Add or import the list you want me to use, then ask me to prepare the campaign.");
      sourceRecipients = await enrichWithDomainScan(inputRows);
      sourceRows = buildGenerated(sourceRecipients);
      const previouslySent = new Set([
        ...generatedRef.current.filter((g) => g.sent).map((g) => g.email.trim().toLowerCase()),
        ...sentRecipientEmailsRef.current,
      ]);
      sourceRows = sourceRows.map(row => ({ ...row, sent: previouslySent.has(row.email.trim().toLowerCase()) }));
      setRecipients(sourceRecipients);
      setGenerated(sourceRows);
      setValidated(true);
      setEditing(false);
      setTab("valid");
      setGenTab("all");
      rememberSmartFillSet(sourceRecipients);
    }
    // Rebuild from the live template editor state every time. Never reuse stale
    // generated subject/body values after Rex or the owner changes a template.
    const previouslySentEmails = new Set([
      ...sourceRows.filter((row) => row.sent).map((row) => row.email.trim().toLowerCase()),
      ...sentRecipientEmailsRef.current,
    ]);
    sourceRows = buildGenerated(sourceRecipients).map((row) => ({
      ...row,
      sent: previouslySentEmails.has(row.email.trim().toLowerCase()),
    }));
    setGenerated(sourceRows);
    generatedRef.current = sourceRows;
    const blocked = new Set(sourceRecipients.filter((r) => r.status === "risky" || r.status === "duplicate").map((r) => r.email.trim().toLowerCase()));
    const sent = new Set([
      ...sourceRows.filter((g) => g.sent).map((g) => g.email.trim().toLowerCase()),
      ...sentRecipientEmailsRef.current,
    ]);
    const seen = new Set<string>();
    const pending = sourceRows.filter((g) => {
      const email = g.email.trim().toLowerCase();
      const completeMessage = Boolean(g.subject.trim() && g.body.trim());
      if (!email || !completeMessage || g.id < from || g.id > to || sent.has(email) || blocked.has(email) || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
    if (pending.length === 0) {
      const hasA = Boolean(tplA.subject.trim() && tplA.body.trim());
      const hasB = Boolean(tplB.subject.trim() && tplB.body.trim());
      if (!hasA && !hasB) throw new Error("No campaign message is ready. Add both a subject and message body to Template A or Template B before preparing a campaign.");
      throw new Error("There are no unsent, safe recipients with a complete message in the selected range.");
    }
    const firstPending = pending[0];
    if (!firstPending) throw new Error("No eligible recipient remains in the selected range.");
    const subject = firstPending.subject;
    const body = firstPending.body;
    const safety = scanCampaignContent(subject, body);
    if (safety.blocked) throw new Error(safetyBlockMessage(safety));
    if (!canSendElite) throw new Error("No connected Gmail profile has available sending capacity. Connect or free up a Gmail profile in Elite Engine before approval.");
    toast.success(`Rex checked ${pending.length.toLocaleString()} safe unsent recipients in Elite Engine.`);
    log(`Rex prepared a campaign preview for ${pending.length} safe unsent recipients. No messages have been sent.`, "campaignPaused");
    return JSON.stringify({ recipientCount: pending.length, subject, body });
  }
  function recordCampaignRecipient(email: string, status: CampaignRecipientResult["status"], reason?: string, name?: string) {
    const id = activeCampaignIdRef.current;
    if (!id) return;
    const entry: CampaignRecipientResult = { email, ...(name ? { name } : {}), status, ...(reason ? { reason } : {}), at: new Date().toISOString() };
    setCampaignRuns(previous => previous.map(run => {
      if (run.id !== id) return run;
      const recipients = [...run.recipients, entry].slice(-5000);
      return { ...run, recipients,
        sentCount: run.sentCount + (status === "sent" ? 1 : 0),
        skippedCount: run.skippedCount + (status === "skipped" ? 1 : 0),
        failedCount: run.failedCount + (status === "failed" ? 1 : 0),
        handedOffCount: run.handedOffCount + (status === "handed_off" ? 1 : 0) };
    }));
  }

  function finishCampaignRun(status: CampaignExecution["status"], keepActive = false) {
    const id = activeCampaignIdRef.current;
    if (id) {
      setCampaignRuns(previous => previous.map(run => run.id === id && (run.status === "running" || run.status === "paused")
        ? { ...run, status, finishedAt: new Date().toISOString() } : run));
    }
    if (status !== "paused" && uid) {
      try { localStorage.removeItem(campaignResumeKey(uid)); } catch {}
    }
    if (!keepActive) activeCampaignIdRef.current = null;
  }

  async function startCampaign(): Promise<boolean> {
    unlockAudioFromGesture();
    if (!uid) { toast.error("Sign in before starting a campaign."); return false; }
    if (engine === "sending") { toast.info("This campaign is already running on the server."); return false; }
    if (!navigator.onLine) { toast.error("Reconnect to create or control the server campaign."); return false; }
    try {
      if (activeServerCampaignId && engine === "paused") {
        await controlRexManagedCampaign({ data: { campaignId: activeServerCampaignId, action: "resume" } });
        setEngine("sending"); setScout(true); setServerCampaignStatus("queued");
        toast.success("Campaign resumed on the server.");
        return true;
      }
      if (!validated || generated.length === 0) { guideTo("recipients", "Validate your list first — this builds the server campaign."); return false; }
      if (!canSendElite) { guideTo("profiles", "Connect a Google account with Gmail send permission before executing."); return false; }
      const inRange = generated.filter((row) => row.id >= from && row.id <= to);
      const seen = new Set<string>();
      const recipientsForQueue = inRange.flatMap((row) => {
        const email = row.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email) || seen.has(email)) return [];
        if (!row.subject.trim() || !row.body.trim()) return [];
        seen.add(email);
        return [{ email, name: row.name, subject: row.subject, body: row.body }];
      });
      if (recipientsForQueue.length === 0) { toast.error("No unique, valid recipients with a complete subject and message remain in the selected range."); return false; }
      const baseSubject = tplA.subject.trim() || tplB.subject.trim() || recipientsForQueue[0]!.subject;
      const baseBody = tplA.body.trim() || tplB.body.trim() || recipientsForQueue[0]!.body;
      const queued = await enqueueCampaign({ data: {
        name: baseSubject.slice(0, 120) || "Campaign", subject: baseSubject, body: baseBody,
        delaySeconds: Math.min(8, Math.max(3, delay)), recipients: recipientsForQueue,
      } });
      setActiveServerCampaignId(queued.campaignId);
      setServerCampaignStatus(queued.status);
      setEngine(queued.status === "paused" ? "paused" : "sending");
      setScout(queued.status !== "paused");
      setNextInSec(delay);
      log("Campaign saved to Supabase: " + recipientsForQueue.length + " unique recipients. The server worker now owns delivery.", "campaignStarted");
      toast.success("Campaign queued — server delivery continues independently of this tab.", {
        description: queued.dispatch?.dispatched ? "The worker was kicked immediately." : "The persistent worker will pick it up on its next poll.",
      });
      return true;
    } catch (error) {
      console.error("Could not queue campaign", error);
      toast.error(error instanceof Error ? error.message : "Campaign could not be added to the server queue.");
      return false;
    }
  }

  async function pauseCampaign(): Promise<boolean> {
    if (!activeServerCampaignId || engine !== "sending") return false;
    try {
      await controlRexManagedCampaign({ data: { campaignId: activeServerCampaignId, action: "pause" } });
      setEngine("paused"); setScout(false); setServerCampaignStatus("paused");
      log("Campaign paused in Supabase. Already-sent recipients remain recorded.", "campaignPaused");
      toast.success("Campaign paused.");
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Campaign could not be paused."); return false; }
  }

  async function stopCampaign(): Promise<boolean> {
    if (!activeServerCampaignId || (engine !== "sending" && engine !== "paused")) return false;
    try {
      await controlRexManagedCampaign({ data: { campaignId: activeServerCampaignId, action: "stop" } });
      setEngine("idle"); setScout(false); setServerCampaignStatus("cancelled");
      toast.success("Campaign stopped. Sent recipients remain recorded; unsent recipients were not sent.");
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Campaign could not be stopped."); return false; }
  }
  const shownGenerated = generated.filter((g) =>
    genTab === "sent" ? g.sent : genTab === "pending" ? !g.sent : !g.sent,
  );
  const tabList = recipients.filter((r) => r.status === tab);
  const current = profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;
  // Rex uses the selected, currently active Gmail identity for email sign-offs.
  const currentGmailSenderFirstName = (current?.email.split("@")[0] ?? "")
    .split(/[._+-]/)[0] ?? ""
    .replace(/[^a-zA-ZÀ-ÿ'-]/g, "")
    .replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase());

  const plannerPress = useLongPress(() => setPlannerEditing(null));


  useEffect(() => {
    if (accepted && authChecked && !signedIn) void navigate({ to: "/auth" });
  }, [accepted, authChecked, signedIn, navigate]);

  if (!accepted) {
    return (
      <Onboarding
        onAccept={() => {
          writeOnboarding(TERMS_VERSION);
          setAccepted(true);
        }}
      />
    );
  }

  // Master Login gate: the workspace never opens without a signed-in master account.
  if (!authChecked || !signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[13px] text-ink-soft">
        Checking your account…
      </div>
    );
  }

  /** When campaign.rex_monitored, workspace pause/stop must be disabled — Studio only. */
  const REX_MONITOR_LOCK = true;

  function scrollRexDestination(selector?: string) {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const main = document.querySelector("[data-ec-main-scroll]") as HTMLElement | null;
      main?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      const menu = document.querySelector("[data-ec-menu-scroll]") as HTMLElement | null;
      menu?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      if (selector) {
        window.setTimeout(() => {
          document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    } catch {
      /* scroll optional */
    }
  }

  function handleRexNavigation(p: AssistPlace) {
            setRexReturnAvailable(true);
            scrollRexDestination();
            const activeRexId = (() => { try { return window.localStorage.getItem(`rex-last-conversation:${uidRef.current ?? ""}`); } catch { return null; } })();
            if (activeRexId) setRexResumeConversationId(activeRexId);
            if (p === "workspace") {
              setAssistOpen(false);
              setRexStudioOpen(false);
              setRexPersonalDestinationId(null);
              setFeatureStudio(null);
              setRadarOpen(false);
                    setStudioOpen(false);
              setChatOpen(false);
              setChatSettingsOpen(false);
              setTeamOpen(false);
              setAdminOpen(false);
              setAppealsOpen(false);
              setPanel("none");
              setMenuView("root");
            } else if (p === "erase-data" || p === "clear-cache") {
              // Erase Data + Clear Local Cache live under Settings, not the root menu.
              setAssistOpen(false);
              setFeatureStudio(null);
              setRadarOpen(false);
              setStudioOpen(false);
              setChatOpen(false);
              setChatSettingsOpen(false);
              setTeamOpen(false);
              setPanel("menu");
              setMenuView("settings");
              window.setTimeout(() => {
                const sel = p === "erase-data" ? "[data-ec-menu-erase]" : "[data-ec-menu-clear-cache]";
                const el = document.querySelector(sel);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                else document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 9999, behavior: "smooth" });
              }, 100);
            } else if (p === "reset-workspace") {
              setAssistOpen(false);
              setFeatureStudio(null);
              setPanel("menu");
              setMenuView("root");
              window.setTimeout(() => {
                const el = document.querySelector("[data-ec-reset-workspace]");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 100);
            
            } else if (p === "erase-data" || p === "settings-erase-data" || p === "clear-cache" || p === "settings-clear-cache" || p === "export-data" || p === "settings-export-data") {
              setAssistOpen(false);
              setFeatureStudio(null);
              setRadarOpen(false);
                  setStudioOpen(false);
              setChatOpen(false);
              setChatSettingsOpen(false);
              setTeamOpen(false);
              setPanel("menu");
              setMenuView("settings");
              window.setTimeout(() => {
                const sel =
                  p === "clear-cache" || p === "settings-clear-cache" ? "[data-ec-menu-clear-cache]" :
                  p === "export-data" || p === "settings-export-data" ? "[data-ec-menu-export]" :
                  "[data-ec-menu-erase]";
                const el = document.querySelector(sel);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                else document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 9999, behavior: "smooth" });
              }, 120);
            } else if (p === "settings-campaign-protection" || p === "protection") {
              setAssistOpen(false); setPanel("menu"); setMenuView("campaignProtection");
            } else if (p === "settings-smart-fill-history" || p === "history") {
              setAssistOpen(false); setPanel("menu"); setMenuView("history");
            } else if (p === "settings-notifications" || p === "notifications") {
              setAssistOpen(false); setPanel("menu"); setMenuView("notifications");
            } else if (p === "settings-tools" || p === "tools") {
              setAssistOpen(false); setPanel("menu"); setMenuView("tools");
            } else if (p === "settings-subscription" || p === "subscription") {
              setAssistOpen(false); setPanel("menu"); setMenuView("subscription");
            } else if (p === "settings-night-mode-light" || p === "night-mode") {
              setAssistOpen(false);
              if (canCustomize) { setFeatureStudio("nightMode"); setPanel("none"); }
              else { setPanel("menu"); askUpgrade("Night Mode and interface customization require Elite Studio ProMaxx.", true); }
            } else if (p === "settings-interface" || p === "appearance") {
              setAssistOpen(false); setStudioReturnToSettings(true); setStudioOpen(true); setPanel("none");
            } else if (p === "reset-workspace") {
              setAssistOpen(false); setPanel("menu"); setMenuView("root");
              window.setTimeout(() => document.querySelector("[data-ec-reset-workspace]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
} else if (p === "workspace-menu" || p === "logout" || p === "export-data" || p === "reset-workspace" || p === "erase-data" || p === "clear-cache") {
              setFeatureStudio(null);
              setRadarOpen(false);
              setStudioOpen(false);
              setChatOpen(false);
              setChatSettingsOpen(false);
              setTeamOpen(false);
              setPanel("menu");
              setMenuView("root");
              window.setTimeout(() => {
                const menu = document.querySelector("[data-ec-menu-scroll]");
                if (p === "erase-data") {
                  const el = document.querySelector("[data-ec-menu-erase]");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                  else menu?.scrollTo({ top: menu.scrollHeight, behavior: "smooth" });
                } else if (p === "reset-workspace") {
                  const el = document.querySelector("[data-ec-reset-workspace]");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if ((p === "logout" || p === "export-data" || p === "clear-cache") && menu) menu.scrollTo({ top: menu.scrollHeight, behavior: "smooth" });
                else menu?.scrollTo({ top: 0, behavior: "instant" });
              }, 80);
            } else if (p === "account") {
              setAssistOpen(false);
              navigate({ to: "/account" });
            } else if (p === "recipients") {
              setPanel("none");
              setFeatureStudio(null);
              window.setTimeout(() => document.querySelector("[data-ec-recipients]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
            } else if (p === "recipient-valid" || p === "recipient-duplicate" || p === "recipient-risky") {
              setPanel("none");
              setFeatureStudio(null);
              setTab(p === "recipient-valid" ? "valid" : p === "recipient-duplicate" ? "duplicate" : "risky");
              window.setTimeout(() => document.querySelector("[data-ec-recipients]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
            } else if (p === "campaign-execution" || p === "campaign-progress") {
              setPanel("none");
              setFeatureStudio(null);
              const selector = p === "campaign-execution" ? '[data-tour="execute"]' : '[data-tour="progress"]';
              window.setTimeout(() => {
                const target = document.querySelector(selector);
                if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
                else document.querySelector("[data-ec-recipients]")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 80);
            } else if (p === "connect-gmail") {
              if (mode !== "elite") {
                toast.info("Gmail profile connection is available in Elite Engine mode. Switch modes to open this section.");
              } else {
                setPanel("none");
                window.setTimeout(() => {
                  const target = document.querySelector('[data-tour="connect"]') ?? profilesRef.current;
                  target?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 80);
              }
            } else if (p === "appearance") {
              setMenuView("appearance");
              setPanel("menu");
              window.setTimeout(() => document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 0, behavior: "instant" }), 0);
            } else if (p.startsWith("rex-feature-")) {
              const id = p.slice("rex-feature-".length);
              if (/^[0-9a-f-]{36}$/i.test(id)) window.location.assign("/rex/" + id);
              else toast.error("That dynamic feature route is invalid.");
            } else if (p.startsWith("rex-destination-")) {
              const id = p.slice("rex-destination-".length);
              if (/^[0-9a-f-]{36}$/i.test(id)) setRexPersonalDestinationId(id);
              else toast.error("That personal workspace destination is invalid.");
            } else if (p === "snippets-add") {
              setRadarTab("snippets");
              setRadarOpen(true);
              showPanelTip("radar");
              window.setTimeout(() => { try { window.dispatchEvent(new CustomEvent("ec-snippets-add-open")); } catch {} }, 120);
            } else if (p === "rex-monitor" || p === "campaign-monitor") {
              setRexStudioOpen(true);
              window.setTimeout(() => document.querySelector("[data-rex-monitor]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
            } else if (p === "radar" || p === "snippets" || p === "monitor") {
              setRadarTab(p);
              setRadarOpen(true); showPanelTip("radar");
            } else if (p === "settings") {
              setMenuView("settings");
              setPanel("menu");
              window.setTimeout(() => document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 0);
            } else if (p === "chat") {
              if (chatEligible) setChatOpen(true);
              else askUpgrade("Private Chat is a Premium and Elite Studio ProMaxx feature.", true);
            } else if (p === "upgrade") {
              askUpgrade("Choose the plan that fits you.");
            } else if (p === "support" || p === "appeals") {
              setAppealsOpen(true);
            } else if (p === "admin") {
              if (companyAdminAccess) setAdminOpen(true);
              else setAppealsOpen(true);
            } else if (p.startsWith("tracker-run-")) {
              setFeatureStudioFilter({ runId: p.slice("tracker-run-".length) });
              setFeatureStudio("tracker");
            } else if (p === "tracker-today") {
              setFeatureStudioFilter({ campaign: "today" });
              setFeatureStudio("tracker");
            } else if (p === "tracker-skipped" || p === "tracker-failed" || p === "tracker-completed" || p === "tracker-paused" || p === "tracker-running") {
              setFeatureStudioFilter({ campaign: p.replace("tracker-", "") });
              setFeatureStudio("tracker");
            } else if (p === "activity-campaign" || p === "activity-system") {
              setFeatureStudioFilter({ activity: p === "activity-campaign" ? "campaign" : "system" });
              setFeatureStudio("activity");
            } else if (p === "activity" || p === "planner" || p === "tracker" || p === "smartfill" || p === "sending") {
              setFeatureStudioFilter({});
              setFeatureStudio(p === "smartfill" ? "smartFill" : p);
            } else if (p === "rex-studio" || p === "rex-memory") {
              setRexStudioOpen(true);
              if (p === "rex-memory") {
                window.setTimeout(() => document.querySelector("[data-rex-memory]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
              }
            } else if (p === "studio") {
              setStudioOpen(true);
            } else if (p === "night-mode") {
              if (canCustomize) { setFeatureStudio("nightMode"); setPanel("none"); }
              else askUpgrade("Night Mode and interface customization require Elite Studio ProMaxx.", true);
            } else if (p === "hotspot") {
              setTeamOpen(true);
                        } else if (p === "protection" || p === "notifications" || p === "subscription" || p === "scope" || p === "history" || p === "tools") {
              setMenuView(p === "protection" ? "campaignProtection" : p);
              setPanel("menu");
            } else if (p === "gmail-profiles") {
              if (mode !== "elite") {
                toast.info("Connected Gmail profiles are shown in Elite mode. Switch modes in the workspace to open that section.");
              } else {
                setPanel("none");
                window.setTimeout(() => profilesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
              }
            } else if (p === "delay-settings") {
              setPanel("none");
              window.setTimeout(() => document.querySelector('[data-tour="pace"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
            } else if (p === "chat-settings") {
              if (chatEligible) { setChatOpen(true); setChatSettingsOpen(true); }
              else askUpgrade("Private Chat is a Premium and Elite Studio ProMaxx feature.", true);
            } else if (p === "templates") {
              // Focus the main workspace template editors
              setPanel("none");
              window.setTimeout(() => document.querySelector('[data-tour="templates"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
            } else if (p === "notifications-bell") {
              setPanel("bell");
            } else if (p === "learn-more") {
              navigate({ to: "/learn-more" });
            } else if (p === "privacy") {
              navigate({ to: "/privacy" });
            } else if (p === "terms") {
              navigate({ to: "/terms" });
            } else if (p === "tour" || p === "settings-walkthrough") {
              // Both registered walkthrough destinations start the existing guided tour.
              resetTour();
              setTipsOff(false);
            }

  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white pb-6">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-2.5 px-4 py-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-ink">
            <div className="flex size-5 items-center justify-center rounded-[6px] bg-brand">
              <Mail className="size-3 text-white" />
            </div>
          </div>
          <h1 className="text-[16px] font-bold tracking-tight">
            <span className="text-ink">Elite </span>
            <span className="text-brand">Connectere</span>
          </h1>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              aria-label="Notifications" data-ec-notifications-bell=""
              data-tour="bell"
              onClick={() => setPanel((p) => (p === "bell" ? "none" : "bell"))}
              className={`relative flex size-8 items-center justify-center rounded-full border border-line ${
                panel === "bell" ? "bg-soft text-brand" : "text-ink"
              }`}
            >
              <Bell className="size-4" />
              {notes.length > 1 && (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand" />
              )}
            </button>
            <button
              aria-label="Menu"
              data-tour="menu"
              onClick={openMenu}
              className={`relative z-30 flex size-8 items-center justify-center rounded-full border border-line ${
                panel === "menu" ? "bg-soft text-brand" : "text-ink"
              }`}
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>

        {panel === "bell" && (
          <div className="mx-auto max-w-xl animate-fade-in px-4 pb-3">
            <div className="rounded-xl border border-line bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="label-caps">Notifications</span>
                <button onClick={() => setPanel("none")} aria-label="Close">
                  <X className="size-3.5 text-ink-soft" />
                </button>
              </div>
              <ul className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto">
                {notes.map((n, i) => (
                  <li key={`${n}-${i}`} className="text-[12px] leading-snug text-ink-soft">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {panel === "menu" && (
          <>
            <button
              aria-label="Close menu"
              onClick={() => setPanel("none")}
              className="fixed inset-0 z-10 cursor-default bg-ink/5"
            />
            <div className="pointer-events-none fixed inset-x-0 top-[54px] z-20 mx-auto max-w-xl px-4">
              <div data-ec-menu-scroll="true" className="pointer-events-auto ml-auto max-h-[calc(100dvh-70px)] w-[74%] origin-top-right animate-scale-in overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white shadow-[0_18px_44px_-26px_oklch(0.31_0.128_268/28%)]">
                                {menuView === "root" && (
                  <div className="animate-fade-in">
                    <p className="label-caps px-3.5 py-2.5">Workspace menu</p>
                    <div className="divide-y divide-line border-t border-line">
                      <MenuToggle
                        icon={Shuffle}
                        label="2-Way rotation"
                        on={twoWay}
                        onClick={() => setTwoWay((v) => !v)}
                      />
                      <MenuRow
                        icon={ScrollText}
                        label="Activity Log"
                        sub={`${notes.length} recorded events`}
                        onClick={() => { setFeatureStudio("activity"); setPanel("none"); }}
                      />
                      <MenuRow
                        icon={NotebookPen}
                        label="Personal Planner / Scratchpad"
                        sub={`${planner.length} saved notes & plans`}
                        onClick={() => { setFeatureStudio("planner"); setPanel("none"); }}
                      />
                      <MenuRow
                        icon={Trash2}
                        label="Reset workspace"
                        dataAttr="data-ec-reset-workspace"
                        danger
                        onClick={() => {
                          resetWorkspace();
                          setPanel("none");
                          setNotes(["Workspace reset"]);
                        }}
                      />
                    </div>
                    <div className="border-t border-line">
                      <MenuRow
                        icon={Settings}
                        label="Settings"
                        sub="Customization, sounds, protection, hotspot & account"
                        onClick={() => setMenuView("settings")}
                      />
                      <MenuRow
                        icon={LogOut}
                        label="Logout"
                        danger
                        onClick={() => {
                          setAutoResumePending(false);
                          setEngine("idle");
                          setScout(false);
                          if (uid) { try { localStorage.removeItem(campaignResumeKey(uid)); } catch {} }
                          finishCampaignRun("stopped");
                          activeCampaignIdRef.current = null;
                          setPanel("none");
                          setChatOpen(false);
                          setActiveChat(null);
                          setEntitlements(null);
                          setSettings(DEFAULT_SETTINGS);
                          setNotes(["Workspace ready — no campaign running"]);
                          applyAppearance(DEFAULT_SETTINGS, false);
                          toast.dismiss();
                          void supabase.auth.signOut();
                        }}
                      />
                    </div>
                  </div>
                )}

                {menuView === "settings" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("root")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Settings</span>
                    </button>
                    <div className="border-t border-line">
                      <div className="p-3">
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-3">
                          <Search className="size-4 text-ink-soft" />
                          <input
                            value={settingsSearch}
                            onChange={(event) => setSettingsSearch(event.target.value)}
                            placeholder="Search anywhere in Elite Connectere"
                            className="min-w-0 flex-1 bg-transparent text-base outline-none"
                            aria-label="Search anywhere in Elite Connectere"
                          />
                        </label>
                      </div>
                      {settingsSearch.trim() && (
                        <div className="border-b border-line px-3 pb-3">
                          {applicationSearchResults.map((result) => (
                            <button
                              key={result.place}
                              type="button"
                              onClick={() => {
                                setSettingsSearch("");
                                if (result.place.startsWith("settings-search-")) {
                                  const match = settingsSearchItems.find(([label]) => result.place.endsWith(label.toLowerCase().replace(/[^a-z0-9]+/g, "-")));
                                  if (match) setMenuView(match[2]);
                                  return;
                                }
                                handleRexNavigation(result.place as AssistPlace);
                              }}
                              className="flex min-h-14 w-full items-center gap-2 rounded-lg px-2 text-left active:bg-soft"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-semibold text-ink">{result.label}</span>
                                <span className="block truncate text-[11px] text-ink-soft">{result.purpose}</span>
                              </span>
                              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-ink-soft">{result.kind}</span>
                            </button>
                          ))}
                          {applicationSearchResults.length === 0 && <p className="px-2 py-2 text-[12px] text-ink-soft">No matching destinations. Try describing what you want to do, or ask Rex in your own words.</p>}
                        </div>
                      )}
                      <MenuRow
                        icon={ShieldCheck}
                        label="Campaign Protection"
                        sub="Permanent duplicate protection and Gmail rotation"
                        onClick={() => setMenuView("campaignProtection")}
                      />
                      <MenuRow
                        icon={History}
                        label="Smart Fill History"
                        sub={`${smartFillHistory.length}/3 saved email sets`}
                        onClick={() => setMenuView("history")}
                      />
                      <MenuRow
                        icon={Bell}
                        label="Notification and Sound Management"
                        sub="Choose which system events notify you"
                        onClick={() => setMenuView("notifications")}
                      />
                      <MenuRow
                        icon={Sparkles}
                        label="Night Mode Light"
                        sub="Colours, speed and edge coverage"
                        onClick={() => {
                          if (!canCustomize) {
                            askUpgrade("Night Mode Light is an Elite Studio ProMaxx feature.", true);
                            return;
                          }
                          if (!canCustomize) {
                            askUpgrade("Night Mode and interface customization require Elite Studio ProMaxx.", true);
                            return;
                          }
                          setFeatureStudioReturnToSettings(true);
                          setFeatureStudio("nightMode");
                          setPanel("none");
                        }}
                      />
                      <MenuRow
                        icon={Bot}
                        label="Rex Studio"
                        sub="Customize Rex, campaign monitoring and alerts"
                        onClick={() => {
                          setRexStudioReturnToSettings(true);
                          setRexStudioOpen(true);
                          setPanel("none");
                        }}
                      />
                      <MenuRow
                        icon={MessageCircle}
                        label="Chat Settings"
                        sub={
                          chatEligible
                            ? "Chat username, chat sounds and message options"
                            : "Private Chat is Premium and ProMaxx"
                        }
                        onClick={() => {
                          if (!chatEligible) {
                            askUpgrade("Private Chat is a Premium and Elite Studio ProMaxx feature.", true);
                            return;
                          }
                          setChatSettingsReturnToSettings(true);
                          setChatSettingsOpen(true);
                          setPanel("none");
                        }}
                      />
<MenuRow
                        icon={Users}
                        label="Hotspot access"
                        sub="Share subscription benefits; Gmail slots and Chat Energy are shared"
                        onClick={() => {
                          setTeamReturnToSettings(true);
                          setTeamOpen(true);
                          setPanel("none");
                        }}
                      />
                      <MenuToggle
                        icon={Compass}
                        label="Walk-through"
                        on={!tipsOff}
                        onClick={() => {
                          const turnOn = tipsOff;
                          setTourEnabled(turnOn);
                          setTipsOff(!turnOn);
                          toast.info(turnOn ? "Walk-through turned on" : "Walk-through turned off");
                        }}
                      />
                      <MenuRow
                        icon={ShieldAlert}
                        label="Support & Appeals"
                        sub="Send a complaint, question or appeal to the Elite team"
                        onClick={() => { setAppealsReturnToSettings(true); setAppealsOpen(true); setPanel("none"); }}
                      />
                      <MenuRow
                        icon={Gauge}
                        label="Tools & Visibility"
                        sub="Smart Fill, tracker, planner and sending modes"
                        onClick={() => setMenuView("tools")}
                      />
                      <MenuRow
                        icon={Sparkles}
                        label="Interface Customization"
                        sub={canCustomize ? "Colours, type, shape and density" : "Elite Studio ProMaxx"}
                        onClick={() => {
                          setStudioReturnToSettings(true);
                          setStudioOpen(true);
                          setPanel("none");
                        }}
                      />
                      {!GOOGLE_REVIEW_MODE && (
                        <MenuRow
                          icon={ShieldCheck}
                          label="Subscription"
                          sub={
                            premium
                              ? "Premium active"
                              : entitlements?.trialActive
                              ? "Free trial running"
                              : "Free plan"
                          }
                          onClick={() => setMenuView("subscription")}
                        />
                      )}
                      <MenuRow
                        icon={Download}
                        label="Export Data / CSV Backup"
                        dataAttr="data-ec-menu-export"
                        sub="Download campaign logs"
                        onClick={exportCsv}
                      />
                      <MenuRow
                        icon={Database}
                        label="Clear Local Cache"
                        sub="Temporary data only — your campaign is kept"
                        onClick={() => {
                          setNotes(["Temporary data cleared"]);
                          setPanel("none");
                        }}
                      />
                      <MenuRow
                        icon={Trash2}
                        label="Erase Data"
                        dataAttr="data-ec-menu-erase"
                        sub="30-minute delay, cancel option, then full personal-data decision"
                        danger
                        onClick={() => setEraseWarningOpen(true)}
                      />
                    </div>
                  </div>
                )}

                {menuView === "scope" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("settings")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Scope of outreach</span>
                    </button>
                    <div className="space-y-2 border-t border-line p-3">
                      <p className="text-[11.5px] leading-snug text-ink-soft">
                        How many recipients a single campaign run targets. New campaigns start from
                        the default; the current campaign can use a different number without changing it.
                      </p>
                      <label className="block text-[11.5px] font-semibold text-ink">
                        Default scope
                        <input
                          type="number"
                          min={1}
                          value={defaultScope}
                          onChange={(e) => setDefaultScope(Math.max(1, Number(e.target.value) || 1))}
                          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-[12.5px] outline-none"
                        />
                      </label>
                      <label className="block text-[11.5px] font-semibold text-ink">
                        Current campaign scope
                        <input
                          type="number"
                          min={1}
                          value={scope}
                          onChange={(e) => {
                            const n = Math.max(1, Number(e.target.value) || 1);
                            setScope(n);
                            setTo(n);
                          }}
                          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-[12.5px] outline-none"
                        />
                      </label>
                      <button
                        onClick={() => {
                          setScope(defaultScope);
                          setTo(defaultScope);
                        }}
                        className="w-full rounded-full border border-line py-2 text-[12.5px] font-semibold text-ink"
                      >
                        Use the default for this campaign
                      </button>
                    </div>
                  </div>
                )}

                {menuView === "history" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("settings")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Smart Fill history</span>
                    </button>
                    <div className="border-t border-line">
                      {smartFillHistory.length === 0 ? (
                        <p className="px-3.5 py-4 text-center text-[12px] text-ink-soft">
                          No saved email sets yet. The last three lists you validate are kept here.
                        </p>
                      ) : (
                        smartFillHistory.map((s) => (
                          <button
                            key={s.savedAt}
                            onClick={() => {
                              setRaw(s.emails);
                              setRecipients([]);
                              setValidated(false);
                              setEditing(true);
                              setGenerated([]);
                              setPanel("none");
                            }}
                            className="flex w-full items-center gap-2 border-b border-line px-3.5 py-2.5 text-left last:border-b-0"
                          >
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                              {s.name}
                            </span>
                            <span className="shrink-0 text-[11.5px] text-ink-soft">
                              {s.count.toLocaleString()}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}


                {menuView === "notifications" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("settings")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Notification and Sound Management</span>
                    </button>
                    <div className="max-h-[420px] overflow-y-auto border-t border-line">
                      <div className="border-b border-line bg-brand-soft px-3.5 py-3">
                        <div className="flex items-start gap-2.5">
                          <Bell className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-ink">Set up phone alerts</span>
                            <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-soft">
                              Tap Enable, choose Allow, then keep notifications enabled for the installed app in iPhone Settings.
                            </span>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  const permission = await requestNotificationPermission();
                                  setAlertPermission(permission);
                                  if (permission === "granted") {
                                    void showSystemNotification("Elite Connectere", "Phone alerts are enabled.");
                                    toast.success("Phone alerts enabled");
                                  } else if (permission === "denied") {
                                    toast.error("Open iPhone Settings → Notifications → Elite Connectere and allow alerts.");
                                  }
                                }}
                                disabled={alertPermission === "granted" || alertPermission === "unsupported"}
                                className="min-h-11 rounded-full bg-brand px-3.5 text-[11px] font-bold text-white disabled:opacity-50"
                              >
                                {alertPermission === "granted" ? "Enabled" : alertPermission === "unsupported" ? "Not supported here" : "Enable phone alerts"}
                              </button>
                              {alertPermission === "denied" && (
                                <span className="text-[10.5px] font-semibold text-brand">Settings must be opened manually on iPhone.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3">
                        <span className="min-w-0 pr-2">
                          <span className="block text-[12.5px] font-semibold text-ink">Phone alerts</span>
                          <span className="block text-[11px] text-ink-soft">
                            Show an iPhone system alert for important events
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-[10px] font-bold text-ink-soft">
                          {alertPermission === "granted" ? "ALLOWED" : alertPermission === "denied" ? "BLOCKED" : alertPermission === "unsupported" ? "UNAVAILABLE" : "NOT SET UP"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <Volume2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
                          <span>
                            <span className="block text-[12.5px] font-semibold text-ink">Notification sound</span>
                            <span className="block text-[11px] text-ink-soft">Choose the alert tone used for important events</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              playSound(settings.notificationSound, settings.sounds);
                              vibrate([45, 35, 45], settings.vibration);
                            }}
                            className="min-h-11 rounded-full border border-line px-3 text-[11px] font-semibold text-ink"
                            aria-label="Test notification sound"
                          >
                            Test
                          </button>
                          <Toggle
                            on={settings.sounds}
                            onClick={() => settings.sounds ? requestSettingOff("sounds") : updateSettings({ sounds: true })}
                          />
                        </span>
                      </div>
                      <div className="border-b border-line px-3.5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span>
                            <span className="block text-[12.5px] font-semibold text-ink">Alert tone</span>
                            <span className="block text-[11px] text-ink-soft">Note, Bell, or Popcorn</span>
                          </span>
                          <select
                            aria-label="Alert tone"
                            value={settings.notificationSound}
                            onChange={(event) => updateSettings({ notificationSound: event.target.value as AppSettings["notificationSound"] })}
                            className="min-h-11 rounded-lg border border-line bg-white px-2 text-[16px] font-semibold text-ink"
                          >
                            <option value="note">Note</option>
                            <option value="bell">Bell</option>
                            <option value="popcorn">Popcorn</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <Send className="size-4 shrink-0 text-brand" aria-hidden="true" />
                          <span>
                            <span className="block text-[12.5px] font-semibold text-ink">Sending sound</span>
                            <span className="block text-[11px] text-ink-soft">Play one short sound after each email sends</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Toggle
                            on={settings.sendingSound}
                            onClick={() => {
                              if (settings.sendingSound) {
                                requestSettingOff("sendingSound");
                              } else {
                                updateSettings({ sendingSound: true });
                                if (settings.sounds) playSendSound(settings.sendingSoundVariant, true);
                              }
                            }}
                          />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex size-4 shrink-0 items-center justify-center text-brand" aria-hidden="true">◌</span>
                          <span>
                            <span className="block text-[12.5px] font-semibold text-ink">Vibration</span>
                            <span className="block text-[11px] text-ink-soft">Add haptic feedback where supported</span>
                          </span>
                        </span>
                          <Toggle
                            on={settings.vibration}
                            onClick={() => updateSettings({ vibration: !settings.vibration })}
                          />
                      </div>
                      
                      <div className="border-b border-line px-3.5 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm("Clear all activity notifications shown under the bell?")) return;
                            setNotes([]);
                            toast.success("Notifications cleared");
                          }}
                          className="w-full rounded-xl border border-line bg-soft py-2.5 text-[12.5px] font-semibold text-ink"
                        >
                          Clear activity notifications
                        </button>
                        <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
                          Removes the in-app notification list. Does not change sound or alert toggles.
                        </p>
                      </div>
                      {NOTIFICATION_KINDS.map(([key, label]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <span className="text-[12.5px] font-semibold text-ink">{label}</span>
                          <Toggle
                            on={settings.notifications[key]}
                            onClick={() =>
                              updateSettings({
                                notifications: {
                                  ...settings.notifications,
                                  [key]: !settings.notifications[key],
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {menuView === "campaignProtection" && (
                  <div className="animate-fade-in">
<button onClick={() => setMenuView("settings")} className="flex w-full items-center gap-2 px-3.5 py-2.5">
  <ChevronLeft className="size-3.5 text-brand" />
  <span className="label-caps">Settings / Campaign Protection</span>
  </button>
                    <div className="border-t border-line p-4 sm:p-6">
                      <div className="mx-auto max-w-2xl rounded-[2rem] border border-brand/30 bg-brand/5 p-5 shadow-[0_18px_50px_rgba(39,64,180,0.12)] sm:p-8">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[18px] font-bold leading-tight text-ink sm:text-[22px]">Permanent duplicate protection</span>
                          <span className="rounded-full border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand">Elite Studio ProMaxx</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">Prevents the same recipient, subject, and message from being sent again across Gmail rotation, refreshing, and revalidation. Validating again keeps protected sends marked as sent and resumes from the first pending recipient.</p>
                        <label className="mt-3 flex min-h-11 items-center gap-3 text-[12px] font-semibold text-ink">
                          <input type="checkbox" checked={permanentSendProtection} disabled readOnly className="size-4 accent-brand" />
                          Enable permanent protection
                        </label>
                        <button type="button" onClick={() => setShowProtectionDetails((value) => !value)} className="mt-2 min-h-11 text-[11px] font-semibold text-brand underline underline-offset-2">{showProtectionDetails ? "Hide details" : "Learn more"}</button>
                        {showProtectionDetails && <div className="mt-2 rounded-lg bg-background/70 p-2.5 text-[11px] leading-relaxed text-ink-soft">The protection stores a fingerprint of the recipient, subject, and message. If one Gmail account is exhausted, sending rotates to the next eligible account, but the fingerprint remains shared across the whole campaign so another account cannot duplicate it.</div>}
                      </div>
                    </div>
                  </div>
                )}

                {menuView === "tools" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("settings")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Tools & Visibility</span>
                    </button>
                    <div className="divide-y divide-line border-t border-line">
                      {([
                        ["smartFill", "Smart Fill", "Saved email lists and memory"],
                        ["tracker", "Campaign Tracker", "Five-day campaign history"],
                        ["planner", "Planner & Notes", "Manage up to five saved notes"],
                        ["activity", "Activity Recording", "Review recorded workspace events"],
                        ["sending", "Sending Modes Shown", "Choose which workspace modes are visible"],
                        ["nightMode", "Night Mode Light", "Colours, speed and edge coverage"],
                      ] as const).map(([id, label, sub]) => (
                        <MenuRow key={id} icon={id === "planner" ? NotebookPen : id === "activity" ? ScrollText : id === "sending" ? Send : id === "nightMode" ? Sparkles : Gauge} label={label} sub={sub} onClick={() => { setFeatureStudioReturnToSettings(true); setFeatureStudio(id); setPanel("none"); }} />
                      ))}
                    </div>
                  </div>
                )}

                {menuView === "appearance" && (
                  <div className="animate-fade-in">
                    <button
                      onClick={() => setMenuView("settings")}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5"
                    >
                      <ChevronLeft className="size-3.5 text-brand" />
                      <span className="label-caps">Interface Customization</span>
                    </button>
                    <div className="space-y-3 border-t border-line px-3.5 py-3">
                      {!canCustomize && (
                        <p className="flex items-start gap-1.5 rounded-xl border border-brand/25 bg-brand-soft px-2.5 py-2 text-[11.5px] leading-snug text-brand">
                          <Lock className="mt-0.5 size-3.5 shrink-0" />
                          Interface Customization is a premium feature. The workspace stays at its
                          default size until you subscribe.
                        </p>
                      )}
                      <div>
                        <p className="label-caps">Interface density</p>
                        <input
                          type="range"
                          min={0.85}
                          max={1.15}
                          step={0.05}
                          value={settings.uiDensity}
                          disabled={!canCustomize}
                          onChange={(e) => updateSettings({ uiDensity: Number(e.target.value) })}
                          className="mt-1.5 w-full accent-brand disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <p className="label-caps">Text size</p>
                        <input
                          type="range"
                          min={0.9}
                          max={1.1}
                          step={0.05}
                          value={settings.textDensity}
                          disabled={!canCustomize}
                          onChange={(e) => updateSettings({ textDensity: Number(e.target.value) })}
                          className="mt-1.5 w-full accent-brand disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <p className="label-caps">Accent colour</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {[null, { h: 4, s: 74, l: 49 }, { h: 220, s: 70, l: 45 }, { h: 160, s: 60, l: 36 }, { h: 268, s: 60, l: 50 }].map(
                            (accent, i) => (
                              <button
                                key={i}
                                disabled={!canCustomize}
                                onClick={() => updateSettings({ accent })}
                                style={
                                  accent
                                    ? { background: `hsl(${accent.h} ${accent.s}% ${accent.l}%)` }
                                    : undefined
                                }
                                className={`size-7 rounded-full border-2 disabled:opacity-40 ${
                                  accent ? "" : "bg-white"
                                } ${
                                  JSON.stringify(settings.accent) === JSON.stringify(accent)
                                    ? "border-ink"
                                    : "border-line"
                                }`}
                                aria-label={accent ? `Accent ${i}` : "Default accent"}
                              />
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {menuView === "subscription" && <div className="animate-fade-in"><p>Subscription</p></div>}
              </div>
            </div>
          </>
        )}
      </header>

      <main
        className={`mx-auto max-w-xl space-y-3 px-4 py-4 ${
          phase === "out" ? "mode-out" : phase === "in" ? "mode-in" : ""
        }`}
      >
        {/* hero */}
        <Card className="!py-2.5">
          <div className="animate-fade-in">
            <h2 className="text-[17px] font-bold leading-tight text-ink">
              Campaign Workspace
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
              Campaigns run through the persistent server queue and connected Google accounts.
            </p>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Stat
              value={sentCount.toLocaleString()}
              label="SENT"
              red
              badge={entitlements ? (entitlements.sent24h).toLocaleString() : undefined}
            />
            <Stat value={pending.toLocaleString()} label="PENDING" />
            <Stat value={pending.toLocaleString()} label="QUEUED" red />
          </div>

          {planAlert && (
            <div className="mt-2.5 rounded-xl border border-brand/25 bg-brand-soft px-3 py-2 text-[11.5px] font-semibold text-brand">
              {planAlert}
            </div>
          )}

          {offline && (
            <button
              onClick={() => void refreshProfiles()}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand/25 bg-brand-soft px-3 py-2 text-[11.5px] font-semibold text-brand"
            >
              <RotateCcw className="size-3.5" /> Connection lost — your campaign is safe. Tap to
              retry.
            </button>
          )}

          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-brand">
            <li className="flex items-center gap-1.5">
              <Lock className="size-3" /> Encrypted
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="size-3" /> Replies go to your Gmail
            </li>
            <li className="flex items-center gap-1.5">
              <MailCheck className="size-3" />
              Server queue delivery
            </li>
          </ul>
        </Card>

        {/* recipients */}
        <Card innerRef={recipientsRef} highlight={guide?.target === "recipients"}>
          <div className="flex items-center justify-between gap-2">
            <h2 data-ec-recipients className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              <Mail className="size-4 text-brand" /> Recipients Email
            </h2>
            {!validated && (
              <button
                onClick={smartFill}
                data-tour="smartfill"
                className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                <Sparkles className="size-3.5" /> Smart Fill
              </button>
            )}
          </div>

          {validated && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setEditing((e) => !e)}
                className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink"
              >
                <Pencil className="size-3.5" /> Edit list
              </button>
              <button
                onClick={smartFill}
                className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                <Sparkles className="size-3.5" /> Smart Fill
              </button>
              <button data-tour="validate"
                onClick={validate}
                className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
              >
                <ListChecks className="size-3.5" /> Re-validate
              </button>
              <button
                onClick={resetWorkspace}
                className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-1.5 text-[12.5px] font-semibold text-brand"
              >
                <Eraser className="size-3.5" /> Clear
              </button>
              <span className="text-[12px] text-ink-soft">
                {recipients.length.toLocaleString()} extracted
              </span>
            </div>
          )}

          {(editing || !validated) && (
            <textarea
              value={raw}
              rows={5}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Enter each email on a new line or paste mixed content for smart extraction"
              className="mt-2.5 w-full resize-none rounded-xl border border-line px-3 py-2 font-mono text-[12px] leading-snug text-ink outline-none placeholder:text-ink-soft/60 focus:border-ink/30"
            />
          )}

          {!validated && (
            <>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button data-tour="validate"
                  onClick={validate}
                  disabled={!raw.trim() && recipients.length === 0}
                  className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
                >
                  <ListChecks className="size-3.5" /> Validate &amp; Clean List
                </button>
                <button
                  onClick={resetWorkspace}
                  className="flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-3.5 py-2 text-[12.5px] font-semibold text-brand"
                >
                  <Eraser className="size-3.5" /> Clear
                </button>
              </div>
              <p className="mt-1.5 text-right text-[12px] text-ink-soft">
                {recipients.length.toLocaleString()} extracted
              </p>
            </>
          )}

          <div className="mt-2.5 animate-fade-in">
            <div className="flex items-center gap-1 rounded-full border border-line bg-soft p-0.5">
              {(
                [
                  ["valid", counts.valid, ShieldCheck],
                                    ["risky", counts.risky, AlertTriangle],
                ] as [Status, number, typeof ShieldCheck][]
              ).map(([key, n, Icon]) => {
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setTab(key);
                    }}
                    className={`flex flex-1 select-none items-center justify-center gap-1 rounded-full px-1.5 py-1.5 text-[11.5px] font-medium capitalize transition-colors ${
                      tab === key ? "bg-brand text-white" : "text-ink"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" /> {key}
                    <span
                      className={`rounded-full px-1 py-px text-[10px] ${
                        tab === key ? "bg-white/20" : "bg-white"
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 max-h-[168px] divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {tabList.slice(0, 400).map((r, i) => (
                <div key={`${r.email}-${i}`} className="flex items-center gap-2 px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-ink">{r.email}</p>
                    <p className="truncate text-[11px] text-ink-soft">
                      {r.name} · {r.company}
                    </p>
                  </div>
                  <p className="max-w-[46%] shrink-0 truncate text-[11px] text-ink-soft">
                    {r.reason}
                  </p>
                </div>
              ))}
              {tabList.length === 0 && (
                <p className="px-3 py-4 text-center text-[12.5px] text-ink-soft">
                  {tab === "valid"
                    ? "No valid addresses yet."
                    : `No ${tab} addresses — nothing to clean up here.`}
                </p>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
              Total {recipients.length.toLocaleString()} · Valid {counts.valid.toLocaleString()} · Duplicate{" "}
              {counts.duplicate.toLocaleString()} · Risky {counts.risky.toLocaleString()} — nothing is removed
              unless you choose to.
            </p>
}
}
          </div>
        </Card>

        {/* templates */}
        <Card className="space-y-2.5" tourId="templates">
          <div className="rounded-[14px] border border-line bg-soft p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                <Shuffle className="size-4 text-brand" /> 2-Way Generation
              </h3>
              <Toggle on={twoWay} onClick={() => setTwoWay((v) => !v)} />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">
              Alternate between two messages so every other email carries a different subject and
              body — helps avoid repetitive-content flags.
            </p>
          </div>

          <TemplateEditor title="Template A" value={tplA} onChange={setTplA} rotating={twoWay} />
          {twoWay && <TemplateEditor title="Template B" value={tplB} onChange={setTplB} rotating />}
        </Card>

        {/* elite-only: profiles + execute */}
        {mode === "elite" && (
          <>
            <Card innerRef={profilesRef} highlight={guide?.target === "profiles"} className="animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-ink">
                  <Server data-tour="profiles" className="size-4 text-brand" /> Connected Gmail Profiles
                </h2>
                <span className="text-[11px] text-ink-soft">{profiles.length}/{entitlements?.profileLimit ?? 10}</span>
              </div>
              {entitlements?.communityPromo && (
                <p className="mt-2 rounded-xl border border-brand/25 bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
                  November Bloodline privilege: connect up to 20 Gmail accounts, execute approved campaigns through Elite Engine, and use the 3-second and 4-second sending delays at no charge through 30 November.
                </p>
              )}

              {profiles.length === 0 ? (
                <>
                  <button data-tour="connect"
                    onClick={() => {
                      if (!signedIn) {
                        void connectGmail();
                        return;
                      }
                      setConnectMethodOpen(true);
                    }}
                    disabled={gmailBusy}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-[12.5px] font-semibold text-brand disabled:opacity-50"
                  >
                    <Plus className="size-4" />{" "}
                    {gmailBusy
                      ? "Opening Google…"
                      : signedIn
                        ? "Connect Gmail profile"
                        : "Sign in to connect Gmail profile"}
                  </button>
                  <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
                    No Gmail account linked yet. Emails are sent from your own Gmail address, with a
                    360–420 daily cap tracked against that account.
                  </p>
                </>
              ) : (
                <>
                  <button
      data-tour={status === "ACTIVE" ? "active-profile" : "profile-row"}
                    onClick={() => setSelectorOpen((o) => !o)}
                    aria-expanded={selectorOpen}
                    className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-soft px-3 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {current?.email.split("@")[0]}
                      </span>
                      <span className="block truncate font-mono text-[11.5px] text-ink-soft">
                        {current?.email}
                      </span>
                    </span>
                    {selectorOpen ? (
                      <ChevronUp className="size-4 shrink-0 text-brand" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-brand" />
                    )}
                  </button>

                  {selectorOpen && (
                    <div className="mt-1.5 animate-fade-in overflow-hidden rounded-2xl border border-line">
                      {/* four rows visible; the rest scroll inside */}
                      <div className="max-h-[184px] divide-y divide-line overflow-y-auto">
                        {profiles.map((p) => (
                          <ProfileRow
                            key={p.id}
                            profile={p}
                            status={statusOf(p)}
                            onSelect={() => {
                              if (!p.exhausted) setActiveProfileId(p.id);
                              setSelectorOpen(false);
                            }}
                            onLongPress={() =>
                              setConfirming({ kind: "profile", id: p.id, email: p.email })
                            }
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => setConnectMethodOpen(true)}
                        disabled={gmailBusy}
                        className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-[12.5px] font-semibold text-brand disabled:opacity-40"
                      >
                        <Plus className="size-4" /> Connect Gmail profile
                      </button>
                      <p className="border-t border-line px-3 py-1.5 text-[10.5px] leading-snug text-ink-soft">
                        Press and hold a profile for 2 seconds to disconnect it.
                      </p>
                    </div>
                  )}

                  <div className="mt-1.5 max-h-[156px] space-y-1.5 overflow-y-auto">
                    {profiles.map((p) => {
                      const s = statusOf(p);
                      const pct = Math.min((p.used / Math.max(p.limit, 1)) * 100, 100);
                      return (
                        <div key={p.id} className="rounded-xl border border-line px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 shrink-0 rounded-full ${
                                s === "ACTIVE"
                                  ? "bg-brand"
                                  : s === "EXHAUSTED"
                                    ? "bg-ink-soft"
                                    : "bg-ink"
                              }`}
                            />
                            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink">
                              {p.email}
                            </span>
                            <TargetValue
                              used={p.used}
                              limit={p.limit}
                              editable={canEditTarget}
                              onLocked={() =>
                                askUpgrade("Custom daily targets up to 420 per profile are an Elite Studio ProMaxx feature.", true)
                              }
                              onSave={async (n) => {
                                try {
                                  await setGmailTarget({ data: { profileId: p.id, target: n } });
                                  toast.success(`Daily target set to ${n}`);
                                  void refreshProfiles();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Could not update the target");
                                }
                              }}
                            />
                          </div>
                          <div
                            className={`mt-1 w-full overflow-hidden rounded-full bg-line ${
                              pct >= 100 ? "h-2" : "h-1.5"
                            }`}
                          >
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 100 ? "bg-ink" : "bg-brand"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-3 text-[10.5px] font-semibold">
                            <span className={`mr-auto ${needsReconnect[p.id] ? "text-brand" : "text-ink-soft"}`}>
                              {needsReconnect[p.id] ? "● Access expired — tap Reconnect" : "● Connected"}
                            </span>
                            <button
                              type="button"
                              disabled={gmailBusy}
                              onClick={() => void testProfile(p.id, p.email)}
                              className="text-ink-soft disabled:opacity-40"
                            >
                              Test send
                            </button>
                            <button
                              type="button"
                              disabled={gmailBusy}
                              onClick={() => void connectGmail()}
                              className="text-brand disabled:opacity-40"
                            >
                              Reconnect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-1.5 rounded-xl border border-brand/20 bg-brand-soft px-3 py-2 text-[11.5px] leading-snug text-brand">
                    Session {current?.used ?? 0}/{current?.limit ?? 0} sent today from this account
                    {GOOGLE_REVIEW_MODE
                      ? "."
                      : " · at its limit the engine moves to the next connected profile and keeps the same campaign going from the next recipient."}
                  </p>
                </>
              )}

              {Object.values(needsReconnect).some(Boolean) && (
                <button
                  type="button"
                  onClick={() => void connectGmail()}
                  disabled={gmailBusy}
                  className="mt-2 w-full rounded-xl bg-brand px-3 py-2.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Google access expired — Reconnect now
                </button>
              )}
              {connectNote && (
                <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{connectNote}</p>
              )}
            </Card>

            {validated && (
              <Card className="animate-fade-in" tourId="execute">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    <Zap className="size-4 text-brand" /> Execute Campaign
                  </h2>
                  <span className="flex items-center gap-1.5 rounded-full border border-line bg-soft px-2.5 py-1 text-[10px] font-bold tracking-widest text-ink">
                    <span
                      className={`size-1.5 rounded-full ${
                        engine === "sending" ? "bg-brand" : "bg-ink"
                      }`}
                    />
                    {engine === "sending"
                      ? nextInSec != null && nextInSec > 0
                        ? `SENDING · Next in ${nextInSec}s`
                        : "SENDING"
                      : engine === "paused"
                        ? "PAUSED"
                        : "IDLE"}
                  </span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">
                  Outbound only — deliveries are handled by your connected Gmail profiles. Replies
                  land directly in your own inbox.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    onClick={() => startCampaign()}
                    disabled={engine === "sending"}
                    className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
                  >
                    <Rocket className="size-3.5" />{" "}
                    {engine === "paused" ? "Resume Campaign" : "Execute Campaign"}
                  </button>
                  <button
                    onClick={pauseCampaign}
                    disabled={engine !== "sending"}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink disabled:opacity-40"
                  >
                    <Pause className="size-3.5" /> Pause
                  </button>
                  <button
                    onClick={() => {
                      if (engine === "sending" || engine === "paused") {
                        void stopCampaign();
                        return;
                      }
                      if (!window.confirm("Reset this campaign run? Clears the list, progress, and client send locks (same as Reset workspace). Server still blocks the exact same message to the same address.")) return;
                      resetWorkspace();
                      log("Workspace run reset — list and progress cleared. Permanent Send Protection still blocks exact duplicate message+recipient on the server.", "campaignPaused");
                      toast.success("Campaign reset");
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink"
                  >
                    <RotateCcw className="size-3.5" /> Reset
                  </button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* generated emails */}
        {validated && generated.length > 0 && (
          <Card className="animate-fade-in" tourId="progress">
            <h2 className="text-[15px] font-semibold text-ink">Generated Emails</h2>
            <p className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">
              Progress is read from the campaign database; rows are marked sent only after Gmail confirms delivery.
            </p>

            <div className="mt-2.5 flex items-center gap-1 rounded-full border border-line bg-soft p-0.5">
              {(
                [
                  ["all", activeServerCampaignId ? serverCampaignCounts.total : generated.length],
                  ["sent", sentCount],
                  ["pending", activeServerCampaignId ? pending : generated.length - sentCount],
                ] as ["all" | "sent" | "pending", number][]
              ).map(([key, n]) => (
                <button
                  key={key}
                  onClick={() => setGenTab(key)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-[12px] font-semibold capitalize transition-colors ${
                    genTab === key ? "bg-brand text-white" : "text-ink"
                  }`}
                >
                  {key} ({n})
                </button>
              ))}
            </div>

            <div className="mt-2 rounded-xl border border-line bg-soft p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Toggle
                    on={scout}
                    onClick={() => {
                      if (scout) {
                        void pauseCampaign();
                        return;
                      }
                      startCampaign();
                    }}
                  />
                  <span className="text-[13px] font-semibold text-ink">Server Worker</span>
                </div>
                <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-bold tracking-widest text-ink">
                  {scout ? "RUNNING" : "IDLE"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span data-tour="pace" className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  <Timer className="size-3.5 text-brand" /> Delay:
                </span>
                {/* WALL_CLOCK_DELAY: values are seconds; wait uses *1000 ms */ [3, 4, 5, 6, 7, 8].map((d) => {
                  const locked = (d === 3 || d === 4) && !premium && !entitlements?.communityPromo;
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        locked
                          ? askUpgrade(
                              "3s and 4s delays require Premium or Elite Studio ProMaxx.",
                            )
                          : setDelay(d)
                      }
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                        delay === d
                          ? "border-brand bg-brand text-white"
                          : locked
                            ? "border-line bg-white text-ink-soft"
                            : "border-line bg-white text-ink"
                      }`}
                    >
                      {locked && <Lock className="size-3" />}
                      {d}s
                    </button>
                  );
                })}
              </div>

              <div id="campaign-protection" data-tour="campaign-protection" className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">Campaign protection</span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span>
                </div>
                <label className="flex min-h-11 items-start gap-3 text-left">
                  <input
                    type="checkbox"
                    checked={permanentSendProtection}
                    disabled
                    readOnly
                    className="mt-1 size-4 accent-brand"
                  />
                  <span>
                    <span className="block text-[12px] font-bold text-ink">Permanent Send Protection</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">"Blocks the exact same recipient, subject, and message permanently across Gmail rotation and revalidation."</span>
                    <button type="button" onClick={() => setShowProtectionDetails((value) => !value)} className="mt-1 min-h-11 text-[11px] font-semibold text-brand underline underline-offset-2">{showProtectionDetails ? "Hide details" : "Learn more"}</button>
                  </span>
                </label>
              {showProtectionDetails && (
                <div className="mt-2 rounded-lg bg-background/70 p-2.5 text-[11px] leading-relaxed text-ink-soft">
                  <p className="font-semibold text-ink">How it protects your list</p>
                  <p className="mt-1">The system saves a permanent fingerprint of the recipient, subject, and message. If Gmail is revalidated, refreshed, or rotated, the same message is skipped instead of being sent again.</p>
                  <p className="mt-1">When a Gmail account reaches its sending limit, the engine moves to the next eligible account. The duplicate record stays with the message, not with one Gmail account, so changing accounts cannot create a duplicate.</p>
                </div>
              )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-semibold text-ink">Range:</span>
                <input
                  type="number"
                  value={from}
                  onChange={(e) => setFrom(Number(e.target.value) || 1)}
                  className="w-16 rounded-full border border-line bg-white px-2 py-1 text-center text-[12px] text-ink outline-none"
                />
                <span className="text-[12px] text-ink">to</span>
                <input
                  type="number"
                  value={to}
                  onChange={(e) => setTo(Number(e.target.value) || 1)}
                  className="w-16 rounded-full border border-line bg-white px-2 py-1 text-center text-[12px] text-ink outline-none"
                />
                <span className="text-[12px] text-ink-soft">of {generated.length}</span>
              </div>

              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-ink">
                <Info className="mt-px size-3 shrink-0 text-brand" /> Not working? Check if pop-ups
                are allowed in your browser.
              </p>
            </div>

            <div className="mt-2 max-h-[228px] divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {shownGenerated.slice(0, 400).map((g) => (
                <button
                  key={g.id}
                  onClick={() => undefined}
                  disabled={g.sent}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                    g.sent ? "bg-brand-soft/60" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-mono text-[12px] ${
                        g.sent ? "text-brand line-through decoration-brand" : "text-ink"
                      }`}
                    >
                      {g.id}. {g.email}
                    </span>
                    <span className="block truncate text-[11px] text-ink-soft">{g.subject}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-brand">
                    {g.sent ? (
                      <>
                        <span className="text-[11.5px] font-semibold">Sent</span>
                        <Lock className="size-3.5" />
                        <CheckCircle2 className="size-3.5" />
                      </>
                    ) : (
                      <>
                        <span className="text-[12px] font-semibold">{g.template}</span>
                        <ExternalLink className="size-3.5" />
                      </>
                    )}
                  </span>
                </button>
              ))}
              {shownGenerated.length === 0 && (
                <p className="px-3 py-4 text-center text-[12.5px] text-ink-soft">
                  {genTab === "sent" ? "Nothing sent yet." : "Queue is empty."}
                </p>
              )}
            </div>
          </Card>
        )}
      </main>

      {guide && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-6">
          <p className="pointer-events-auto max-w-[340px] animate-fade-in rounded-2xl bg-ink px-4 py-2.5 text-center text-[12.5px] font-medium leading-snug text-white">
            {guide.msg}
          </p>
        </div>
      )}

      {confirming?.kind === "profile" && (
        <Confirm
          title="Disconnect this Gmail profile?"
          body={`${confirming.email} will stop sending for you. Its sending history stays with the Google account.`}
          confirmLabel="Disconnect"
          onCancel={() => setConfirming(null)}
          onConfirm={() => void disconnectProfile(confirming.id, confirming.email)}
        />
      )}
      {confirming?.kind === "setting" && (
        <Confirm
          title={confirming.title}
          body={confirming.body}
          confirmLabel="Turn off"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            updateSettings({ [confirming.setting]: false } as Partial<AppSettings>);
            setConfirming(null);
          }}
        />
      )}
      {eraseWarningOpen && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center overflow-y-auto bg-red-950/85 p-4 backdrop-blur-md">
          <section role="alertdialog" aria-modal="true" aria-labelledby="erase-warning-title" aria-describedby="erase-warning-description" className="my-auto w-full max-w-lg overflow-hidden rounded-3xl border-2 border-red-500 bg-white shadow-[0_28px_90px_rgba(69,10,10,0.75)]">
            <div className="bg-gradient-to-br from-red-950 via-red-800 to-red-700 px-5 py-6 text-center text-white">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full border-2 border-red-200/70 bg-red-500/25 shadow-[0_0_32px_rgba(248,113,113,0.55)]">
                <AlertTriangle className="size-9 text-white" strokeWidth={2.6} />
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-red-100">Danger zone · read before continuing</p>
              <h2 id="erase-warning-title" className="mt-2 text-2xl font-black tracking-tight">Request complete data erasure?</h2>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-red-100">This starts a 30-minute waiting period. It does not erase anything immediately.</p>
            </div>
            <div id="erase-warning-description" className="space-y-3 p-4 text-red-950">
              <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-3.5">
                <p className="text-[12px] font-black uppercase tracking-wider text-red-900">Severe and permanent consequences</p>
                <p className="mt-2 text-[12px] font-bold leading-relaxed text-red-950">This is not a logout, cache clear, or ordinary reset. If you eventually choose YES, Elite Connectere will destroy the personal workspace history and working material attached to this account. You may lose months of conversations, plans, records, saved work and personal configuration. There is no undo button and support may not be able to recover it.</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[12px] font-semibold leading-relaxed text-red-950">
                  <li><strong>Rex is reset:</strong> conversation history, saved memories, remembered context, personal preferences, personal destinations, custom features, action history and saved Rex settings are removed.</li>
                  <li><strong>Private Chat is affected:</strong> your sent messages, chat profile and requests are deleted; incoming messages are hidden from your account. Other participants' own copies remain.</li>
                  <li><strong>Your campaign workspace is cleared:</strong> campaign drafts, recipient records, campaign content and personal delivery-history records are deleted. Already-sent email cannot be recalled.</li>
                  <li><strong>Connected work is removed:</strong> saved Gmail connection credentials/profile records, connection attempts and personal workspace records covered by the erasure process are deleted.</li>
                  <li><strong>Personal workspace state is reset:</strong> notes, saved lists, planner material, local preferences and onboarding state are cleared where handled by the app's erasure/reset handlers.</li>
                </ul>
                <button type="button" onClick={() => setEraseImpactExpanded(v => !v)} className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-red-400 bg-white px-3 text-left text-[11px] font-extrabold text-red-900">
                  {eraseImpactExpanded ? "Hide full impact and exceptions" : "Expand full impact, data categories and exceptions"}
                  {eraseImpactExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {eraseImpactExpanded && (
                  <div className="mt-3 space-y-3 rounded-xl border border-red-300 bg-white p-3 text-[11px] leading-relaxed text-red-950">
                    <div><p className="font-black uppercase tracking-wide text-red-800">What you should expect to lose</p><p className="mt-1">Personal conversation transcripts and message history; Rex memories and saved context; your own Private Chat history and account view; recipient lists and campaign drafts; saved planner, notes and list material; generated or customized personal features; personal settings and connection material; and personal activity/context records included in the erasure scope. You will need to rebuild personal setup and reconnect services.</p></div>
                    <div><p className="font-black uppercase tracking-wide text-emerald-800">What is deliberately retained</p><p className="mt-1">Master login/authentication account, payments, billing, subscription and entitlement records, protected send counts and usage statistics, Gmail identity-level daily limits, abuse/security penalties, team-seat/account-protection records and the minimal erasure audit receipt.</p></div>
                    <div><p className="font-black uppercase tracking-wide text-red-800">Important limits</p><p className="mt-1">Messages already delivered cannot be recalled. Shared chat connections and other participants' own message copies are not erased by your personal request. Some security, billing and usage records are intentionally retained. Do not proceed if you may need any personal work, conversations or records later.</p></div>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-[11.5px] leading-relaxed text-emerald-950">
                <strong>Protected:</strong> Your login, billing, payments, subscription entitlements, sending limits, protected usage statistics and account-protection records are retained. Already-sent emails cannot be recalled.
              </div>
              <p className="text-[11px] font-bold leading-relaxed text-red-800">If you choose YES at the end, the personal workspace data listed on the final confirmation screen is permanently deleted. This cannot be undone.</p>
              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                <button type="button" disabled={eraseBusy} onClick={() => void startEraseCountdown()} className="min-h-12 rounded-xl border-2 border-red-950 bg-red-700 px-4 text-[12px] font-black uppercase tracking-wide text-white shadow-lg hover:bg-red-800 disabled:opacity-50">
                  {eraseBusy ? "Starting…" : "I understand — start 30 minutes"}
                </button>
                <button type="button" disabled={eraseBusy} autoFocus onClick={() => setEraseWarningOpen(false)} className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 text-[12px] font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50">
                  Go back — keep my data
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {signedIn && uid && !eraseStatusChecked && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-background/95 p-6 backdrop-blur-md" role="status" aria-live="polite">
          <div className="max-w-sm rounded-2xl border border-line bg-white p-5 text-center shadow-xl">
            <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
            <p className="text-sm font-bold text-ink">Checking account safety</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">Your workspace will open after the Erase Data countdown status is verified.</p>
          </div>
        </div>
      )}
      {eraseRequest && new Date(eraseRequest.expires_at).getTime() > eraseNow && (
        <div className="fixed inset-x-3 top-3 z-[110] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-xl" role="status" aria-live="polite">
          <Timer className="size-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold">Erase Data countdown active</p>
            <p className="text-[11px] leading-snug">You can keep using the workspace. Final decision in {(() => { const ms = Math.max(0, new Date(eraseRequest.expires_at).getTime() - eraseNow); return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`; })()}.</p>
            <button type="button" onClick={() => setEraseImpactExpanded(v => !v)} className="mt-1 text-[11px] font-extrabold underline underline-offset-2">{eraseImpactExpanded ? "Hide impact details" : "Tap to expand: what will be permanently lost"}</button>
            {eraseImpactExpanded && <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-red-300 bg-white p-3 text-[11px] leading-relaxed text-red-950"><p><strong>Rex:</strong> conversations, saved memories, context, personal settings, custom features and action history.</p><p className="mt-1"><strong>Private Chat:</strong> your sent messages, profile and requests; incoming messages are hidden from your account. Other people's copies remain.</p><p className="mt-1"><strong>Campaigns:</strong> personal drafts, recipient records, campaign content and personal delivery history. Already-sent email cannot be recalled.</p><p className="mt-1"><strong>Connected workspace:</strong> saved connection credentials/profile records, personal lists, notes/planner material and personal workspace state handled by erasure.</p><p className="mt-2 font-bold text-emerald-800">Preserved: login, billing, payments, subscriptions, protected usage/sending limits, security penalties and team/account-protection records.</p></div>}
          </div>
          <button type="button" disabled={eraseBusy} onClick={() => void cancelEraseCountdown()} className="min-h-10 shrink-0 rounded-full border border-amber-500 bg-white px-3 text-[11px] font-extrabold disabled:opacity-50">Cancel</button>
        </div>
      )}
      {eraseRequest && new Date(eraseRequest.expires_at).getTime() <= eraseNow && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-red-950/90 p-3 backdrop-blur-md"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              return;
            }
            if (event.key === "Tab") {
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
              if (!buttons.length) return;
              const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1)
                : (currentIndex < 0 || currentIndex === buttons.length - 1 ? 0 : currentIndex + 1);
              event.preventDefault();
              buttons[nextIndex]?.focus();
            }
          }}
        >
          <section role="alertdialog" aria-modal="true" aria-labelledby="erase-data-title" aria-describedby="erase-data-description" className="my-auto w-full max-w-lg overflow-hidden rounded-3xl border-2 border-red-500 bg-white shadow-[0_28px_90px_rgba(69,10,10,0.75)]">
            <div className="border-b border-red-200 bg-gradient-to-br from-red-950 via-red-800 to-red-700 px-5 py-6 text-white">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full border-2 border-red-200/70 bg-red-500/25 shadow-[0_0_32px_rgba(248,113,113,0.55)]">
                <AlertTriangle className="size-9 text-white" strokeWidth={2.6} />
              </div>
              <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.28em] text-red-100">Final decision required</p>
              <h2 id="erase-data-title" className="mt-2 text-center text-2xl font-black tracking-tight">ERASE EVERYTHING?</h2>
              <p className="mt-2 text-center text-[13px] font-semibold leading-relaxed text-red-100">The 30-minute waiting period has ended. Your workspace is locked until you choose one of the two actions below.</p>
            </div>
            <div id="erase-data-description" className="max-h-[58vh] space-y-3 overflow-y-auto p-4 text-red-950">
              <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-3.5">
                <p className="mb-2 text-[12px] font-black uppercase tracking-wider text-red-800">Everything personal that will be erased</p>
                <ul className="space-y-2 text-[11.5px] font-semibold leading-relaxed text-red-950">
                  <li>• Campaign drafts, recipient lists, generated messages, campaigns and campaign delivery history.</li>
                  <li>• Rex conversations, messages, memories, memory settings, events, action records, custom features, destinations and personal settings.</li>
                  <li>• Your Private Chat history is removed from your account: your sent messages are deleted, received messages are hidden for your account, and your chat profile and connection requests are removed. Other participants’ copies and shared connections are preserved.</li>
                  <li>• Connected Gmail profile credentials, app connection records and connection-attempt history.</li>
                  <li>• Planner notes, saved Smart Fill lists, workspace notes, activity data, local preferences and onboarding progress.</li>
                </ul>
              </div>
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3.5 text-[11.5px] leading-relaxed text-emerald-950">
                <strong className="font-extrabold">Protected and preserved:</strong> Master Login and authentication account; payments, billing and subscription entitlements; campaign/send usage statistics; Gmail identity daily limits and account-protection penalties; team seats and account-protection records; a minimal erasure audit receipt containing only status and timestamps. Your already-sent Gmail messages are not recalled.
              </div>
              <div className="rounded-xl border-2 border-red-600 bg-red-100 p-3.5 text-center">
                <p className="text-[12px] font-black uppercase tracking-wide text-red-900">This is permanent</p>
                <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-red-900">Choose YES to erase the listed personal data now, or NO to cancel and keep it. No choice means this screen stays locked.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button type="button" disabled={eraseBusy} onClick={() => void confirmEraseData()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-red-950 bg-red-700 px-4 text-[13px] font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-red-800 disabled:opacity-50">
                  <AlertTriangle className="size-4" /> {eraseBusy ? "Processing…" : "YES — ERASE EVERYTHING"}
                </button>
                <button type="button" disabled={eraseBusy} autoFocus onClick={() => void cancelEraseCountdown()} className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50">
                  NO — KEEP MY DATA
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {premiumReason && entitlements && !GOOGLE_REVIEW_MODE && (
        <PremiumUnlock
          reason={premiumReason}
          entitlements={entitlements}
          only={premiumOnly}
          onClose={() => setPremiumReason(null)}
          busy={checkoutBusy}
          error={checkoutError}
          onSubscribe={(plan) => void subscribe(plan)}
        />
      )}
      {entitlements?.planEndsAt && entitlements.plan !== "free" && (
        <ExpiryReminder
          planEndsAt={entitlements.planEndsAt}
          planLabel={
            entitlements.plan === "promaxx"
              ? "Elite Studio ProMaxx"
              : entitlements.plan === "premium"
                ? "Premium"
                : entitlements.plan === "standard"
                  ? "Standard"
                  : entitlements.plan === "starter"
                    ? "Starter"
                    : "Your plan"
          }
          onRenew={() => {
            setPremiumReason("Renew your plan to keep Elite Engine and profiles active.");
          }}
        />
      )}
      {celebrate && (
        <EliteUnlocked
          onClose={() => {
            setCelebrate(false);
            void refreshEntitlements();
          }}
        />
      )}
  {featureStudio && (
  <FeatureStudios
    key={`${featureStudio}:${featureStudioFilter.campaign ?? "all"}:${featureStudioFilter.activity ?? "all"}:${featureStudioFilter.runId ?? "none"}` }
    {...(featureStudioFilter.campaign ? { initialCampaignFilter: featureStudioFilter.campaign } : {})}
    {...(featureStudioFilter.activity ? { initialActivityFilter: featureStudioFilter.activity } : {})}
    {...(featureStudioFilter.runId ? { initialCampaignRunId: featureStudioFilter.runId } : {})}
    studio={featureStudio}
    settings={settings}
    updateSettings={updateSettings}
    canCustomize={canCustomize}
    onUpgrade={() => askUpgrade("Night Mode and interface customization require Elite Studio ProMaxx.", true)}
          smartFillHistory={smartFillHistory}
          setSmartFillHistory={setSmartFillHistory}
          campaignHistory={campaignHistory}
          campaignRuns={campaignRuns}
          onImportRecipients={importRecipientsIntoWorkspace}
    planner={planner}
    setPlanner={setPlanner}
  activity={notes}
  sentRecipientCount={sentRecipientEmails.length}
  onDisableActivity={() => requestSettingOff("activityRecording")}
    onBack={() => { const returnToSettings = featureStudioReturnToSettings; setFeatureStudio(null); setFeatureStudioReturnToSettings(false); if (returnToSettings) { setPanel("menu"); setMenuView("settings"); } }}
  />
  )}

  {studioOpen && (
  <Studio
          settings={settings}
          allowed={canCustomize}
          onChange={updateSettings}
          onClose={() => { const returnToSettings = studioReturnToSettings; setStudioOpen(false); setStudioReturnToSettings(false); if (returnToSettings) { setPanel("menu"); setMenuView("settings"); } }}
          onUpgrade={() => {
            setStudioOpen(false);
            askUpgrade("Interface Customization is an Elite Studio ProMaxx feature.", true);
          }}
        />
      )}

      {signedIn && (
        <MagicCircle
          celebrationSignal={`${celebrate ? "subscription" : ""}:${chatHub.incoming}`}
          userKey={uid}
          badge={chatEligible ? chatHub.totalUnread + chatHub.incoming : 0}
          shortcuts={[
            {
              id: "chat",
              label: "Chat",
              icon: <MessageCircle className="size-5" />,
              badge: chatEligible ? chatHub.totalUnread + chatHub.incoming : 0,
              onSelect: () => {
                if (!chatEligible) {
                  askUpgrade("Private Chat is a Premium and Elite Studio ProMaxx feature.", true);
                  return;
                }
                setChatOpen(true);
              },
            },
            {
              id: "radar",
              label: "Radar",
              icon: <Activity className="size-5" />,
              onSelect: () => {
                setRadarOpen(true);
                try { showPanelTip("radar"); } catch {}
              },
            },
            {
              id: "rex",
              label: "Rex",
              icon: <RexAvatar size="tiny" />,
              onSelect: () => {
                const lastId = (() => { try { return window.localStorage.getItem(`rex-last-conversation:${uidRef.current ?? ""}`); } catch { return null; } })();
                setRexResumeConversationId(lastId);
                setRexReturnAvailable(false);
                setRexPersonalDestinationId(null);
                setRexStudioOpen(false);
                setFeatureStudio(null);
                setRadarOpen(false);
                setPanel("none");
                setStudioOpen(false);
                setAssistOpen(true);
              },
            },
            {
              id: "settings",
              label: "Settings",
              icon: <Settings className="size-5" />,
              onSelect: () => {
                setMenuView("settings");
                setPanel("menu");
                try { showPanelTip("settings"); } catch {}
              },
            },
            {
              id: "refresh",
              label: "Refresh",
              icon: <RotateCcw className="size-5" />,
              onSelect: async () => {
                const [profilesRefreshed, entitlementsRefreshed, hotspotRefreshed] = await Promise.all([
                  refreshProfiles(),
                  refreshEntitlements(),
                  import("@/lib/team.functions")
                    .then(({ listMyTeamSeats }) => listMyTeamSeats())
                    .then(() => true)
                    .catch((error) => {
                      console.error("[Hotspot] Refresh failed.", error);
                      return false;
                    }),
                ]);
                setAlertPermission(notificationPermission());
                window.dispatchEvent(new Event("ec:workspace-refresh"));
                if (profilesRefreshed && entitlementsRefreshed && hotspotRefreshed) {
                  const { updateAppWorker } = await import("@/lib/pwa");
                  await updateAppWorker();
                  toast.success("Latest app and workspace data loaded. Refreshing now…");
                  window.location.reload();
                } else {
                  toast.error("Refresh was incomplete. Your existing data was kept; check your connection and try again.");
                }
              },
            },
            ...(companyAdminAccess
              ? [{
                  id: "admin",
                  label: "Company",
                  icon: <ShieldAlert className="size-5" />,
                  onSelect: () => setAdminOpen(true),
                }]
              : []),
          ]}
        />
      )}
      {chatOpen && (
        <PrivateChat
          hub={chatHub}
          prefs={{ enterToSend: settings.chatEnterToSend !== false, links: settings.chatLinkPreview !== false }}
          onClose={() => setChatOpen(false)}
          onActiveChange={setActiveChat}
          onUpgrade={() => {
            setChatOpen(false);
            askUpgrade("Private Chat is a Premium and Elite Studio ProMaxx feature.", true);
          }}
          onOpenRex={() => {
            setChatOpen(false);
            setAssistOpen(true);
          }}
        />
      )}
      {chatSettingsOpen && (
        <ChatSettings settings={settings} onChange={updateSettings} onClose={() => { setChatSettingsOpen(false); const back = chatSettingsReturnToSettings; setChatSettingsReturnToSettings(false); if (back) { setPanel("menu"); setMenuView("settings"); } }} />
      )}
      <div className="fixed top-14 right-3 z-[55] flex flex-col items-end gap-1.5">
        {(engine === "sending" || engine === "paused") && (
          <CampaignTimerChip
            active={engine === "sending"}
            remaining={Math.max(
              0,
              generated.filter((g) => !g.sent && g.id >= from && g.id <= to).length,
            )}
            delaySeconds={delay}
            nextInSeconds={nextInSec}
            totalInRange={Math.max(0, to - from + 1)}
            sentInRun={generated.filter((g) => g.sent && g.id >= from && g.id <= to).length}
          />
        )}
        <PromoChip isFreeUser={!entitlements?.premium || entitlements?.plan === "free" || !!entitlements?.communityPromo} />
      </div>
      <ErrorGuideHost />
      <DidYouKnowHost
        onAskRex={(tip) => {
          try {
            window.localStorage.setItem(`rex-new-chat:${uidRef.current ?? "session"}`, "1");
          } catch {}
          setRexResumeConversationId(null);
          setRexInitialPrompt(
            `I saw this “Did you know?” tip in my workspace:

${tip.title}
${tip.body}

Please explain this feature and help me with it. Keep this as a discussion first, and ask for my approval before making any consequential change or taking an external action.`
          );
          setAssistOpen(true);
        }}
      />
      <EliteTips mode={mode} active={accepted && signedIn && !chatOpen && !radarOpen} />
      
            {assistantCelebrate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-ink/40 px-6"
          onClick={() => setAssistantCelebrate(null)}
        >
          <div className="relative w-full max-w-[340px] animate-scale-in rounded-3xl border border-line bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="mt-3 text-[18px] font-bold tracking-tight text-ink">CONGRATULATIONS!</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              You have received workspace access from{" "}
              <strong className="text-ink">{assistantCelebrate.ownerEmail}</strong>.
            </p>
            <div className="mt-4 rounded-2xl bg-soft p-3 text-[12px] text-ink-soft">
              Connect up to{" "}
              <strong className="text-brand">{assistantCelebrate.maxGmails} Gmail profile(s)</strong>.
              Your connected accounts remain private to your login.
            </div>
            <button
              type="button"
              onClick={() => setAssistantCelebrate(null)}
              className="mt-4 w-full rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white shadow"
            >
              Start Sending
            </button>
          </div>
        </div>
      )}

      {teamOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-white shadow-xl sm:rounded-2xl">
            <TeamPanel onClose={() => { setTeamOpen(false); const back = teamReturnToSettings; setTeamReturnToSettings(false); if (back) { setPanel("menu"); setMenuView("settings"); } }} />
          </div>
        </div>
      )}

      
      {connectMethodOpen && !gmailLearnMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-6 sm:items-center sm:pb-0">
          <div className="flex max-h-[min(92dvh,640px)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl animate-scale-in">
            <div className="shrink-0 border-b border-line px-4 py-3">
              <p className="text-[15px] font-bold text-ink">Connect Gmail profile</p>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
                Authorise a sending profile with Google. Tokens are stored securely on the server so campaigns keep running without an open browser tab.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <button
                type="button"
                disabled={gmailBusy}
                onClick={() => {
                  setConnectMethodOpen(false);
                  void connectGmail();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                Connect with Google
              </button>

              <button
                type="button"
                onClick={() => setGmailLearnMoreOpen(true)}
                className="mt-2.5 w-full text-center text-[12.5px] font-semibold text-brand underline-offset-2 hover:underline"
              >
                Learn More — multi-account & safety rules
              </button>

              <div className="mt-3 rounded-xl border border-line bg-soft px-3 py-3">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-ink">Managing Multiple Gmail Profiles?</p>
                    <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">
                      Google caps active browser sign-ins at 10 accounts. If Chrome blocks you or shows a "maximum accounts reached" error, open Learn More for the full guide — or use Incognito / clear browser Google sessions below.
                    </p>
                    <a
                      href="https://accounts.google.com/Logout"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-brand/30 bg-white px-3 py-2.5 text-center text-[12.5px] font-semibold text-brand shadow-sm active:bg-brand-soft"
                    >
                      Clear Browser Google Sessions
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-line px-4 py-2.5">
              <button
                type="button"
                onClick={() => setConnectMethodOpen(false)}
                className="w-full py-2 text-[12.5px] font-semibold text-ink-soft"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {gmailLearnMoreOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 px-3 pb-4 sm:items-center sm:pb-0">
          <div className="flex max-h-[min(94dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl animate-scale-in">
            <div className="shrink-0 border-b border-line px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Elite Engine</p>
              <h3 className="text-[16px] font-bold leading-snug text-ink">Managing Multiple Gmail Profiles in Elite Engine</h3>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">How Elite Engine Works</h4>
                <p className="mt-1.5">
                  When you connect an account using <span className="font-semibold text-ink">Connect with Google</span>, Elite Connectere securely receives an OAuth authorization token. Once connected, your account stays active in your campaign pool — even if you sign out of Google in your browser later. Tokens are stored encrypted on our servers so campaigns can continue without an open browser session.
                </p>
                <p className="mt-2">
                  Choose your <span className="font-semibold text-ink">best, most trusted Gmail</span> for each connection. Connecting is not always easy to repeat if Google limits permissions, so prefer accounts you own and use regularly for legitimate outreach.
                </p>
              </section>

              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Google's 10-Account Limit Explained</h4>
                <p className="mt-1.5">
                  Google limits active signed-in accounts to about 10 per browser session. If Google blocks you from adding another profile:
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                  <li>Open Google's Account Manager screen in the browser.</li>
                  <li>
                    Tap <span className="font-semibold text-ink">Remove from this device</span> on any account you are not currently linking. This only clears local browser sign-in cookies — it does <span className="font-semibold text-ink">not</span> delete your Gmail account or affect the account on your phone.
                  </li>
                  <li>Return to Elite Connectere and tap <span className="font-semibold text-ink">Connect with Google</span> to add your new profile.</li>
                </ol>
              </section>

              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Alternative Quick Fixes</h4>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-4">
                  <li>
                    <span className="font-semibold text-ink">Incognito / Private window:</span> Open Elite Connectere inside an Incognito tab to bypass browser account limits without disturbing your active logins.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">Direct session reset:</span> Use the button below to log out of all browser Google accounts and clear session locks, then connect again.
                  </li>
                </ul>
              </section>

              <section className="rounded-xl border border-brand/25 bg-brand-soft/40 px-3 py-2.5">
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">If a Gmail disconnects on its own</h4>
                <p className="mt-1.5">
                  Any Gmail that is removed <span className="font-semibold text-ink">automatically without your confirmation</span> was flagged by Google (for example, a refused send). That is not a random app glitch.
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-4">
                  <li>
                    <span className="font-semibold text-ink">1st flag in a calendar month:</span> the profile is disconnected, suspended from Elite Engine for <span className="font-semibold text-ink">5 days</span>, and monthly capacity is reduced.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">2nd flag in the same month:</span> suspension extends to <span className="font-semibold text-ink">30 days</span> with a tighter capacity cap.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">3rd flag in the same month:</span> the address is <span className="font-semibold text-ink">permanently blocked</span> from connecting on Elite Engine. the server queue remains the only supported delivery path.
                  </li>
                </ul>
                <p className="mt-2">
                  All campaign delivery runs through the persistent Gmail API worker. Always connect Gmail accounts you are allowed to use for outreach, keep pacing sensible, and avoid lists that produce high bounce or spam complaints.
                </p>
              </section>


              <section className="rounded-xl border border-line bg-soft px-3 py-2.5">
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Abuse & master-login bans</h4>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  Scams, bank impersonation, phishing, and fake campaigns are not a soft warning — the master login can be banned. Full policy and Gmail suspension ladder live on the public Learn More page.
                </p>
                <a
                  href="/learn-more#abuse-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[12.5px] font-semibold text-brand underline"
                >
                  Open full Learn More (abuse policy)
                </a>
                <a
                  href="/learn-more#gmail-profiles"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-[12.5px] font-semibold text-brand underline"
                >
                  Gmail multi-account & flag rules
                </a>
              </section>

              <section>
                <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink">Before you disconnect a working profile</h4>
                <p className="mt-1.5">
                  Manually disconnecting a healthy Gmail is allowed, but reconnecting can be harder if Google shows permission or account-picker limits. Prefer keeping stable profiles in the pool and only remove accounts you no longer intend to use for campaigns.
                </p>
              </section>
            </div>

            <div className="shrink-0 space-y-2 border-t border-line px-4 py-3">
              <a
                href="https://accounts.google.com/Logout"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-center text-[13px] font-semibold text-white"
              >
                Log out of all browser Google accounts
              </a>
              <button
                type="button"
                onClick={() => setGmailLearnMoreOpen(false)}
                className="w-full rounded-xl border border-line py-2.5 text-[13px] font-semibold text-ink"
              >
                Back to Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {adminOpen && (
        <AdminPanel isOwner={isCompany} onClose={() => setAdminOpen(false)} />
      )}

      {appealsOpen && <AppealsPanel onClose={() => { setAppealsOpen(false); const back = appealsReturnToSettings; setAppealsReturnToSettings(false); if (back) { setPanel("menu"); setMenuView("settings"); } }} />}

      {rexPersonalDestinationId && (
        <RexPersonalDestinationPage
          id={rexPersonalDestinationId}
          onBack={() => setRexPersonalDestinationId(null)}
        />
      )}

      {rexStudioOpen && (
        <RexStudio
          uid={uidRef.current ?? "session"}
          onBack={() => { setRexStudioOpen(false); const back = rexStudioReturnToSettings; setRexStudioReturnToSettings(false); if (back) { setPanel("menu"); setMenuView("settings"); } }}
          onOpenChat={(conversationId) => { setRexResumeConversationId(conversationId ?? null); setRexStudioOpen(false); setAssistOpen(true); }}
          onOpenTracker={() => { setRexStudioOpen(false); setFeatureStudioFilter({}); setFeatureStudio("tracker"); }}
        />
      )}

      {assistOpen && (
        <EliteAssist
          uid={uidRef.current ?? "session"}
          initialPrompt={rexInitialPrompt}
          onClose={() => { setAssistOpen(false); setRexInitialPrompt(""); }}
          onConfirmLogout={async () => {
            setAssistOpen(false);
            setPanel("none");
            setChatOpen(false);
            setActiveChat(null);
            toast.dismiss();
            await supabase.auth.signOut();
          }}
          resumeConversationId={rexResumeConversationId}
          onPrepareCampaign={prepareCurrentCampaignForRex}
          onExecuteCurrentCampaign={async () => {
            const started = await startCampaign();
            if (started) setFeatureStudio("tracker");
            return started;
          }}
          onPauseCurrentCampaign={pauseCampaign}
          onStopCurrentCampaign={stopCampaign}
          onImportRecipients={importRecipientsIntoWorkspace}
          onValidateRecipients={validate}
          onUpdateWorkspaceSetting={(settingKey, settingValue) => {
            if (settingKey === "campaign.delay") {
              const sec = Number(settingValue);
              if (![3, 4, 5, 6, 7, 8].includes(sec)) return false;
              setDelay(sec);
              try { delayRef.current = sec; } catch {}
              return true;
            }
            const booleanKeys = new Set([
              "activityRecording","tracker","planner","smartFill","smartFillMemory","sounds","sendingSound","vibration",
              "chatSounds","chatEnterToSend","chatLinkPreview","nightModeLight","showCampaignTimer",
            ]);
            if (settingKey.startsWith("notifications.")) {
              const notificationKey = settingKey.slice("notifications.".length) as NotificationKind;
              if (!NOTIFICATION_KINDS.some(([key]) => key === notificationKey) || !["true","false"].includes(settingValue)) return false;
              updateSettings({ notifications: { ...settings.notifications, [notificationKey]: settingValue === "true" } });
              return true;
            }
            let parsed: string | number | boolean = settingValue;
            if (booleanKeys.has(settingKey)) {
              if (!["true","false"].includes(settingValue)) return false;
              parsed = settingValue === "true";
            } else if (["uiDensity","textDensity","radius","shadow","nightModeIntensity","weight"].includes(settingKey)) {
              const numeric = Number(settingValue);
              const ranges: Record<string, [number, number]> = {
                uiDensity: [0.5, 1.5], textDensity: [0.5, 1.5], radius: [0, 2], shadow: [0, 4], nightModeIntensity: [1, 5], weight: [0, 2],
              };
              const range = ranges[settingKey];
              if (!range || !Number.isFinite(numeric) || numeric < range[0] || numeric > range[1]) return false;
              parsed = numeric;
            } else {
              const enums: Record<string, string[]> = {
                sendingMode: ["both","elite","standard"],
                notificationSound: ["note","bell","popcorn"],
                sendingSoundVariant: ["air-swish","air-swish-long","air-swish-soft","soft-sweep","pass-by"],
                alarmRingtone: ["note","bell","popcorn"],
                nightModeAnimation: ["electric","aurora","plasma","comet","circuit"],
                nightModeColor: ["rainbow","aurora","ocean","sunset"],
                nightModeSpeed: ["slow","medium","fast"],
                font: ["outfit","manrope","grotesk","lora","mono"],
                shapeMode: ["rectangle","mixed","glass-pill"],
              };
              if (settingKey === "nightModeCustomColor") {
                if (!/^#[0-9a-f]{6}$/i.test(settingValue)) return false;
              } else if (!enums[settingKey]?.includes(settingValue)) return false;
            }
            const patch = {} as Partial<AppSettings>;
            (patch as unknown as Record<string, unknown>)[settingKey] = parsed;
            updateSettings(patch);
            return true;
          }}
          onManageSmartFill={(action, name) => {
            const existingIndex = smartFillHistory.findIndex(item => item.name.trim().toLowerCase() === name.trim().toLowerCase());
            if (action === "save_current_recipients") {
              if (!settings.smartFill || !recipients.length || existingIndex >= 0 || smartFillHistory.length >= 3) return false;
              const saved = { name: name.trim(), count: recipients.length, emails: recipients.map(recipient => recipient.email).join("\n"), savedAt: Date.now() };
              setSmartFillHistory(current => {
                const index = current.findIndex(item => item.name.trim().toLowerCase() === name.trim().toLowerCase());
                if (index >= 0) return current.map((item, itemIndex) => itemIndex === index ? saved : item);
                return [saved, ...current].slice(0, 3);
              });
              setFeatureStudio("smartFill");
              return true;
            }
            if (existingIndex < 0) return false;
            if (action === "load_saved_list") {
              const saved = smartFillHistory[existingIndex];
              if (!saved?.emails?.trim()) return false;
              const csv = "email\\n" + saved.emails.split(/\\r?\\n/).filter(Boolean).join("\\n");
              return importRecipientsIntoWorkspace(csv, "Smart Fill list " + saved.name);
            }
            if (action === "delete_saved_list") {
              setSmartFillHistory(current => current.filter(item => item.name.trim().toLowerCase() !== name.trim().toLowerCase()));
              setFeatureStudio("smartFill");
              return true;
            }
            const saved = smartFillHistory[existingIndex];
            if (!saved) return false;
            const csv = "email\r\n" + saved.emails.split(/\r?\n/).filter(Boolean).map(email => '"' + email.replace(/"/g, '""') + '"').join("\r\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "smart-fill-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".csv";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setFeatureStudio("smartFill");
            return true;
          }}
          onCreatePlannerItem={(kind, title, body) => {
            if (!settings.planner) return false;
            setPlanner(current => [{ kind, title, body }, ...current]);
            setFeatureStudio("planner");
            setPanel("none");
            return true;
          }}
          onApplyCampaignTemplate={(slot, subject, body) => {
            // Keep Rex open while updating the selected template in the
            // workspace state. The user can review or revise it in chat.
            if (slot === "A") setTplA((current) => ({ ...current, subject, body }));
            else setTplB((current) => ({ ...current, subject, body }));
            setEditing(true);
          }}
          onReadActiveWorkspace={(areas) => {
            const snapshot: any = {};
            if (areas.includes("campaign_summary")) {
              snapshot.campaignSummary = {
                mode,
                engineStatus: engine,
                validated,
                totalRecipients: recipients.length,
                generatedRecipients: generated.length,
                sentCount,
                remaining: Math.max(0, generated.length - sentCount),
                selectedRange: { from, to },
                serverCampaigns: persistedCampaignWorkspace.campaigns.map((campaign) => ({
                  id: campaign.id, name: campaign.name, status: campaign.status,
                  totalRecipients: campaign.total_recipients, sentCount: campaign.actualSent,
                  failedCount: campaign.actualFailed, pendingCount: campaign.actualPending, storedSentCount: campaign.storedSentCount, storedFailedCount: campaign.storedFailedCount, counterMismatch: campaign.counterMismatch,
                  countsTruncated: campaign.countsTruncated, pauseReason: campaign.last_error,
                  updatedAt: campaign.updated_at,
                })),
                serverCampaignSource: persistedCampaignWorkspace.source,
                serverSentLast24Hours: persistedCampaignWorkspace.sentLast24Hours,
              };
            }
            if (areas.includes("recipients")) {
              snapshot.recipients = recipients.slice(0, 50).map(({ email, name, company, status, reason }) => ({ email, name, company, status, reason }));
              snapshot.recipientsTruncated = recipients.length > 50;
            }
            if (areas.includes("drafts")) {
              snapshot.templates = {
                templateA: { subject: tplA.subject.slice(0, 200), body: tplA.body.slice(0, 2_000) },
                templateB: { subject: tplB.subject.slice(0, 200), body: tplB.body.slice(0, 2_000) },
              };
              snapshot.generatedMessages = generated.slice(0, 8).map(({ email, name, company, template, subject, body, sent }) => ({ email, name, company, template, subject: subject.slice(0, 200), body: body.slice(0, 1_000), sent }));
              snapshot.generatedMessagesTruncated = generated.length > 8;
            }
            if (areas.includes("sending_capacity")) {
              snapshot.sendingCapacity = {
                canSendElite,
                profiles: profiles.slice(0, 10).map((profile: any, index: number) => ({
                  label: "Gmail profile " + (index + 1),
                  status: profile?.status ?? "unknown",
                  used: Number(profile?.used ?? profile?.sent ?? profile?.sentToday ?? 0),
                  limit: Number(profile?.limit ?? profile?.dailyLimit ?? 0),
                  remaining: Math.max(0, Number(profile?.limit ?? profile?.dailyLimit ?? 0) - Number(profile?.used ?? profile?.sent ?? profile?.sentToday ?? 0)),
                  exhausted: Boolean(profile?.exhausted),
                })),
              };
            }
            if (areas.includes("campaign_runs")) {
              // Database records are authoritative; browser run history is not delivery evidence.
              snapshot.campaignRuns = persistedCampaignWorkspace.campaigns;
              snapshot.campaignRunSource = persistedCampaignWorkspace.source;
              snapshot.campaignRecipients = persistedCampaignWorkspace.recipients;
              snapshot.campaignRecipientsTruncated = persistedCampaignWorkspace.truncated;
            }
            if (areas.includes("activity")) { snapshot.recentActivity = notes.slice(0, 20).map(note => note.slice(0, 300)); snapshot.recentActivityTruncated = notes.length > 20; }
            if (areas.includes("planner")) { snapshot.planner = planner.slice(0, 50); snapshot.plannerTruncated = planner.length > 50; }
            if (areas.includes("smart_fill_history")) snapshot.smartFillHistory = smartFillHistory.map(item => ({ name: item.name, count: item.count, savedAt: item.savedAt }));
            return snapshot;
          }}
          account={{
            mode,
            engineStatus: engine,
            sendInFlight: false,
            plan: entitlements?.plan ?? "free",
            connectedGmails: profiles.length,
            currentGmailSenderEmail: current?.email ?? "",
            currentGmailSenderFirstName,
            profileLimit: entitlements?.profileLimit ?? 5,
            delaySeconds: delay,
            recipients: generated.length,
            sent: sentCount,
            remaining: Math.max(0, generated.length - sentCount),
            gmailProfiles: profiles.map((pr: any) => `${pr?.email ?? "gmail"} · ${pr?.status ?? "?"} · sent ${pr?.sent ?? pr?.sentToday ?? 0}/${pr?.limit ?? pr?.dailyLimit ?? "?"}`),
            recentActivity: notes.slice(0, 12),
            campaignContext: JSON.stringify({
              workspaceOwner: "current signed-in user only",
              mode,
              engineStatus: engine,
              validated,
              totalRecipients: recipients.length,
              recipients: recipients.slice(0, 100).map(({ email, name, company, status, reason }) => ({ email, name, company, status, reason })),
              templateA: { subject: tplA.subject, body: tplA.body },
              templateB: { subject: tplB.subject, body: tplB.body },
              generatedCount: generated.length,
              generatedMessages: generated.slice(0, 100).map(({ email, name, company, template, subject, body, sent }) => ({ email, name, company, template, subject, body, sent })),
              campaignSentCount: sentCount,
              serverCampaigns: persistedCampaignWorkspace.campaigns, serverCampaignRecipients: persistedCampaignWorkspace.recipients, serverSentLast24Hours: persistedCampaignWorkspace.sentLast24Hours, campaignDataSource: persistedCampaignWorkspace.source, localWorkspaceRunCache: campaignRuns.slice(0, 5).map(run => ({ id: run.id, status: run.status, startedAt: run.startedAt, sentCount: run.sentCount, skippedCount: run.skippedCount, failedCount: run.failedCount })),
              truncated: recipients.length > 100 || generated.length > 100,
            }),
            walkthrough: tipsOff ? "off" : "on",
            isCompanyAdmin: companyAdminAccess,
          }}
          
          onGo={handleRexNavigation}
          searchResources={applicationSearchExtras}
        />
      )}

      {radarOpen && (
        <EliteRadarHub
          initialTab={radarTab}
          onClose={() => setRadarOpen(false)}
          sentCount={sentCount}
          totalCount={generated.length}
          pacingSeconds={delay}
          onApplyTemplate={(tpl) => {
            setTplA(tpl);
            toast.success("Applied to Template A");
          }}
          activeProfileEmail={profiles.find((p) => p.id === activeProfileId)?.email ?? ""}
          isSending={engine === "sending"}
        />
      )}
      {rexReturnAvailable && !assistOpen && !rexStudioOpen && (
        <button
          type="button"
          onClick={() => {
            const lastId = (() => { try { return window.localStorage.getItem(`rex-last-conversation:${uidRef.current ?? ""}`); } catch { return null; } })();
            setRexResumeConversationId(lastId);
            setRexReturnAvailable(false);
            setRexPersonalDestinationId(null);
            setFeatureStudio(null);
            setRadarOpen(false);
            setPanel("none");
            setStudioOpen(false);
            setAssistOpen(true);
          }}
          className="fixed bottom-24 right-4 z-[120] inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-bold text-white shadow-2xl ring-2 ring-background"
          aria-label="Return to Rex conversation"
        >
          <RexAvatar size="tiny" /> Return to Rex
        </button>
      )}

      <InstallPrompt />

      <footer className="mx-auto max-w-xl border-t border-line px-4 py-3.5 text-center">
        <p className="text-[12px] text-ink-soft">
          Elite Connectere · AI Workspace Agent Rex
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] font-medium text-ink">
          <a
            href="https://eliteconnectere.site"
            className="inline-flex items-center gap-1"
            aria-label="Elite Connectere website"
          >
            <Globe className="size-3.5 text-brand" /> Website
          </a>
          <a
            href="https://www.youtube.com/@Eliteconnectere"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
            aria-label="Elite Connectere on YouTube"
          >
            <Youtube className="size-3.5 text-brand" /> YouTube
          </a>
          <a
            href="https://www.instagram.com/eliteconnectere"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
            aria-label="Elite Connectere on Instagram"
          >
            <Instagram className="size-3.5 text-brand" /> Instagram
          </a>
          <a
            href="https://www.facebook.com/EliteConnectere"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
            aria-label="Elite Connectere on Facebook"
          >
            <Facebook className="size-3.5 text-brand" /> Facebook
          </a>
          <a
            href="https://t.me/Eliteconnectere"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
            aria-label="Elite Connectere on Telegram"
          >
            <Send className="size-3.5 text-brand" /> Telegram
          </a>
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-ink">
          <Link to="/learn-more">How it works & Rex AI</Link>
          <span className="text-ink-soft">·</span>
          <Link to="/privacy">Privacy</Link>
          <span className="text-ink-soft">·</span>
          <Link to="/terms">Terms</Link>
          <span className="text-ink-soft">·</span>
          <Link to="/support">Support</Link>
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-[11.5px] font-medium text-brand">
          <ShieldCheck className="size-3.5" /> Your workspace is protected · Rex AI is disclosed in Privacy
        </p>
        <p className="mt-2 text-[11px] text-ink-soft">
          Created by The Bloodline&#128175;
        </p>
      </footer>
    </div>
  );
}
