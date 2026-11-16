/** Versioned local snapshot of the shared campaign workspace. */
import type { Generated, Recipient } from "@/features/data";

export const WORKSPACE_KEY = "ec.workspace.v2";
export const ONBOARDING_KEY = "ec.onboarding.v2";
export const TERMS_VERSION = "2026-11-07";

export type SmartFillSet = { name: string; count: number; emails: string; savedAt: number };
export type PlannerItem = { kind: string; title: string; body: string };
export type CampaignDay = { date: string; sent: number };
export type CampaignRecipientResult = {
  email: string;
  name?: string;
  status: "sent" | "skipped" | "failed" | "handed_off";
  reason?: string;
  at: string;
};
export type CampaignExecution = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  mode: "standard" | "elite";
  status: "running" | "paused" | "stopped" | "completed" | "failed";
  targetCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  handedOffCount: number;
  recipients: CampaignRecipientResult[];
};

export type WorkspaceSnapshot = {
  v: 1;
  mode: "standard" | "elite";
  raw: string;
  recipients: Recipient[];
  validated: boolean;
  editing: boolean;
  tab: string;
  twoWay: boolean;
  tplA: { subject: string; body: string };
  tplB: { subject: string; body: string };
  generated: Generated[];
  genTab: string;
  delay: number;
  permanentSendProtection?: boolean;
  from: number;
  to: number;
  scope: number;
  defaultScope: number;
  planner: PlannerItem[];
  notes: string[];
  smartFillHistory: SmartFillSet[];
  activeProfileId: string | null;
  cleanupHandled: boolean;
  /** Normalized recipients successfully sent by this workspace. */
  sentRecipientEmails?: string[];
  campaignHistory?: CampaignDay[];
  /** Structured execution ledger; legacy daily totals remain separate. */
  campaignRuns?: CampaignExecution[];
};

/** Each Master Login account has its own workspace snapshot. */
const wsKey = (uid: string) => `${WORKSPACE_KEY}:${uid}`;

export function loadWorkspace(uid: string): Partial<WorkspaceSnapshot> | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = window.localStorage.getItem(wsKey(uid));
    if (!raw) {
      raw = window.localStorage.getItem(WORKSPACE_KEY);
      if (raw) {
        window.localStorage.setItem(wsKey(uid), raw);
        window.localStorage.removeItem(WORKSPACE_KEY);
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    return parsed && parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot, uid: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(wsKey(uid), JSON.stringify(snapshot));
  } catch {
    /* storage full or unavailable — the session keeps working in memory */
  }
}

export function clearWorkspaceStorage(uid: string | null) {
  if (typeof window === "undefined" || !uid) return;
  window.localStorage.removeItem(wsKey(uid));
}

export function readOnboarding(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ONBOARDING_KEY);
}

export function writeOnboarding(version: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, version);
}
