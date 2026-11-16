import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Edit3, FileText, ListChecks, Mail, Plus, Send, Trash2, Upload, X, Volume2 } from "lucide-react";
import { playSendSound } from "../../lib/sounds";
import type { AppSettings } from "./settings";
import type { CampaignExecution, PlannerItem, SmartFillSet } from "../workspace/persist";

type StudioId = "smartFill" | "tracker" | "planner" | "activity" | "sending" | "nightMode";

type Props = {
  studio: StudioId;
  settings: AppSettings;
  canCustomize?: boolean;
  onUpgrade?: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  smartFillHistory: SmartFillSet[];
  setSmartFillHistory: (next: SmartFillSet[]) => void;
  campaignHistory?: { date: string; sent: number }[];
  campaignRuns?: CampaignExecution[];
  onImportRecipients?: (raw: string, sourceName?: string) => boolean;
  initialCampaignFilter?: string;
  initialActivityFilter?: string;
  initialCampaignRunId?: string;
  planner: PlannerItem[];
  setPlanner: (next: PlannerItem[]) => void;
  activity: string[];
  sentRecipientCount?: number;
  onBack: () => void;
  onDisableActivity?: (() => void) | undefined;
};

const titles: Record<StudioId, string> = {
  smartFill: "Smart Fill Studio",
  tracker: "Campaign & Activity Centre",
  planner: "Planner & Notes Studio",
  activity: "Campaign & Activity Centre",
  sending: "Sending Modes Management",
  nightMode: "Night Mode Light Studio",
};

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background animate-fade-in">
    <header className="sticky top-0 z-10 border-b border-line bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center gap-2">
        <button onClick={onBack} className="flex min-h-11 items-center gap-1 rounded-full border border-white/50 bg-white/35 px-3 text-[12.5px] font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_14px_rgba(15,23,42,0.08)] backdrop-blur-xl"><ArrowLeft className="size-4 text-brand" /> Back</button>
        <span className="label-caps ml-auto">Feature Studio</span>
      </div>
    </header>
    <main className="mx-auto max-w-xl space-y-4 p-4 pb-16"><div><p className="label-caps">Management</p><h1 className="mt-1 text-xl font-bold tracking-tight text-ink">{title}</h1></div>{children}</main>
  </div>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="card-shell space-y-3 rounded-[1.75rem] border border-white/45 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/25"><div><h2 className="text-[14px] font-bold text-ink">{title}</h2>{description && <p className="mt-1 text-[12px] leading-snug text-ink-soft">{description}</p>}</div>{children}</section>;
}

export function FeatureStudios({ studio, settings, updateSettings, canCustomize = false, onUpgrade = () => {}, smartFillHistory, setSmartFillHistory, planner, setPlanner, activity, campaignHistory = [], campaignRuns = [], sentRecipientCount = 0, onBack, onDisableActivity, onImportRecipients, initialCampaignFilter = "all", initialActivityFilter = "all", initialCampaignRunId }: Props) {
  if (studio === "smartFill") return <SmartFillStudio {...{ settings, updateSettings, smartFillHistory, setSmartFillHistory, onBack, ...(onImportRecipients ? { onImportRecipients } : {}) }} />;
  if (studio === "planner") return <PlannerStudio {...{ planner, setPlanner, onBack }} />;
  if (studio === "tracker" || studio === "activity") return <CampaignActivityCentre {...{ campaignHistory, campaignRuns, sentRecipientCount, activity, settings, updateSettings, onBack, onDisableActivity, initialCampaignFilter, initialActivityFilter, ...(initialCampaignRunId ? { initialCampaignRunId } : {}) }} />

  if (studio === "sending") return <SendingStudio {...{ settings, updateSettings, onBack }} />;
  if (studio === "nightMode") {
    if (!canCustomize) return <Shell title={titles.nightMode} onBack={onBack}>
      <Section title="Night Mode is a paid Studio feature" description="The Bloodline community privilege includes Rex and up to 20 Gmail connections only. Night Mode and interface customization require an eligible subscription.">
        <button type="button" onClick={onUpgrade} className="w-full rounded-full bg-brand px-4 py-3 text-[13px] font-semibold text-white">View eligible plans</button>
      </Section>
    </Shell>;
    return <NightModeStudio {...{ settings, updateSettings, onBack }} />;
  }
  return <Shell title={titles[studio]} onBack={onBack}>
    <Section title="Duplicate-send protection" description="The workspace keeps a private recipient bank for messages sent through this app. It is checked before every send, regardless of which connected Gmail profile is active.">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">✓</span>
        <div className="min-w-0"><p className="text-[13px] font-bold text-emerald-900">Protection is active</p><p className="mt-1 text-[11px] leading-snug text-emerald-800">Recipients already sent through this workspace are automatically skipped. Manual Gmail sends are not included.</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-soft p-3"><p className="text-2xl font-bold text-ink">{sentRecipientCount ?? 0}</p><p className="label-caps">Recipients protected</p></div><div className="rounded-xl bg-soft p-3"><p className="text-2xl font-bold text-ink">24h</p><p className="label-caps">Send window</p></div></div>
      <p className="text-[11px] leading-snug text-ink-soft">This protection is designed as a separately monetizable workspace capability. Billing can be connected later without changing the send safeguard or losing recorded history.</p>
    </Section>
    <Section title="Recent campaign history" description="Only successful sends made through this workspace appear here.">{campaignHistory.length === 0 ? <p className="rounded-xl bg-soft p-4 text-center text-[12px] text-ink-soft">No campaign days are recorded yet.</p> : <div className="space-y-2">{campaignHistory.map((day) => <div key={day.date} className="flex items-center justify-between rounded-xl border border-line bg-soft px-3 py-2.5"><div><p className="text-[12.5px] font-semibold text-ink">{day.date}</p><p className="text-[11px] text-ink-soft">Campaign activity recorded</p></div><strong className="text-[14px] text-brand">{day.sent} sent</strong></div>)}</div>}</Section>
    <Section title="Five-day retention" description="The tracker keeps at most five distinct campaign days without deleting persistent campaign records."><p className="text-[12px] text-ink-soft">New campaign activity will roll the oldest tracker day out after the fifth day.</p></Section>
  </Shell>;
}

function SmartFillStudio({ settings, updateSettings, smartFillHistory, setSmartFillHistory, onBack, onImportRecipients }: Omit<Props, "studio" | "planner" | "setPlanner" | "activity">) {
  const [name, setName] = useState(""); const [emails, setEmails] = useState(""); const [selected, setSelected] = useState<number | null>(null); const [editingName, setEditingName] = useState(""); const [editingEmails, setEditingEmails] = useState("");
  const selectedList = selected == null ? null : smartFillHistory[selected];
  function saveList() { const clean = [...new Set(emails.split(/\r?\n|,|;/).map((e) => e.trim()).filter(Boolean))]; if (!name.trim() || clean.length === 0) return; setSmartFillHistory([{ name: name.trim(), count: clean.length, emails: clean.join("\n"), savedAt: Date.now() }, ...smartFillHistory].slice(0, 3)); setName(""); setEmails(""); }
  async function importList(file?: File) { if (!file) return; const raw = await file.text(); const found = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []; const clean = [...new Set(found.map(email => email.trim().toLowerCase()))]; if (!clean.length) { window.alert("No email addresses were found in that file."); return; } if (smartFillHistory.length >= 3) { window.alert("Your three saved-list slots are full. Delete a list before importing another."); return; } const listName = file.name.replace(/\.[^.]+$/, "") || "Imported list"; if (onImportRecipients && !onImportRecipients(raw, listName)) return; setSmartFillHistory([{ name: listName, count: clean.length, emails: clean.join("\n"), savedAt: Date.now() }, ...smartFillHistory]); }
  function updateList() { if (selected == null || !editingName.trim() || !editingEmails.trim()) return; const clean = editingEmails.split(/\r?\n|,|;/).map((e) => e.trim()).filter(Boolean); setSmartFillHistory(smartFillHistory.map((item, i) => i === selected ? { ...item, name: editingName.trim(), emails: clean.join("\n"), count: clean.length } : item)); }
  return <Shell title={titles.smartFill} onBack={onBack}><Section title="Smart Fill" description="Control Smart Fill here without changing its state just by opening this studio."><div className="flex items-center justify-between"><div><p className="text-[13px] font-semibold text-ink">Smart Fill is {settings.smartFill ? "on" : "off"}</p><p className="text-[11px] text-ink-soft">Uses your saved email lists when filling recipients.</p></div><button aria-label="Toggle Smart Fill" onClick={() => updateSettings({ smartFill: !settings.smartFill })} className={`relative h-7 w-12 rounded-full ${settings.smartFill ? "bg-brand" : "bg-line"}`}><span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${settings.smartFill ? "left-6" : "left-1"}`} /></button></div></Section><Section title="Saved email lists" description={`${smartFillHistory.length} / 3 lists saved`}><div className="space-y-2">{smartFillHistory.map((item, i) => <button key={item.savedAt} onClick={() => { setSelected(i); setEditingName(item.name); setEditingEmails(item.emails); }} className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left ${selected === i ? "border-brand bg-brand-soft" : "border-line"}`}><Mail className="size-4 text-brand" /><span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{item.name}</span><span className="text-[11px] text-ink-soft">{item.count} emails</span></button>)}</div>{smartFillHistory.length < 3 ? <div className="space-y-2 border-t border-line pt-3"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="List name" className="min-h-11 w-full rounded-xl border border-line px-3 text-[16px]" /><textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="Paste one email per line" rows={4} className="w-full rounded-xl border border-line px-3 py-2 text-[16px]" /><label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line px-3 text-[12px] font-semibold text-ink"><Upload className="mr-2 size-4" />Import CSV or text file<input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(event) => { void importList(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><button onClick={saveList} className="min-h-11 w-full rounded-full bg-ink text-[13px] font-semibold text-white"><Plus className="mr-1 inline size-4" />Create list</button></div> : <p className="border-t border-line pt-3 text-[12px] text-ink-soft">Maximum reached. Delete a list before creating another.</p>}</Section>{selectedList && <Section title={`Manage “${selectedList.name}”`}><input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="min-h-11 w-full rounded-xl border border-line px-3 text-[16px]" /><textarea value={editingEmails} onChange={(e) => setEditingEmails(e.target.value)} rows={5} className="w-full rounded-xl border border-line px-3 py-2 text-[16px]" /><button type="button" onClick={() => downloadCsv((editingName.trim() || "email-list") + ".csv", [["Email"], ...editingEmails.split(/\r?\n|,|;/).map(value => value.trim()).filter(Boolean).map(value => [value])])} className="min-h-10 w-full rounded-full border border-line text-[12px] font-semibold text-ink"><Download className="mr-2 inline size-4" />Export this list</button><div className="flex gap-2"><button onClick={updateList} className="min-h-11 flex-1 rounded-full bg-ink text-[13px] font-semibold text-white"><Check className="mr-1 inline size-4" />Save changes</button><button onClick={() => { if (window.confirm("Delete this saved email list?")) { setSmartFillHistory(smartFillHistory.filter((_, i) => i !== selected)); setSelected(null); } }} className="min-h-11 rounded-full border border-brand px-4 text-brand"><Trash2 className="size-4" /></button></div></Section>}<Section title="Smart Fill Memory" description="Disabling memory does not delete saved memory."><div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-ink">Memory is {settings.smartFillMemory ? "on" : "off"}</span><button onClick={() => updateSettings({ smartFillMemory: !settings.smartFillMemory })} className={`relative h-7 w-12 rounded-full ${settings.smartFillMemory ? "bg-brand" : "bg-line"}`}><span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${settings.smartFillMemory ? "left-6" : "left-1"}`} /></button></div><p className="text-[11px] leading-relaxed text-ink-soft">Smart Fill stores your saved lists in workspace data; it has no separate hidden memory store.</p><button type="button" onClick={() => { if (window.confirm("Clear all saved Smart Fill lists from this workspace? This cannot be undone.")) { setSmartFillHistory([]); setSelected(null); setName(""); setEmails(""); setEditingName(""); setEditingEmails(""); } }} disabled={smartFillHistory.length === 0} className="min-h-11 w-full rounded-full border border-red-200 text-[12.5px] font-semibold text-red-600 disabled:opacity-40">Clear saved lists</button></Section></Shell>;
}

function PlannerStudio({ planner, setPlanner, onBack }: Pick<Props, "planner" | "setPlanner" | "onBack">) { const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [editing, setEditing] = useState<number | null>(null); function save() { if (!title.trim() && !body.trim()) return; const item = { kind: "Note", title: title.trim(), body: body.trim() }; setPlanner(editing == null ? [item, ...planner] : planner.map((x, i) => i === editing ? item : x)); setTitle(""); setBody(""); setEditing(null); } return <Shell title={titles.planner} onBack={onBack}><Section title="Notes summary" description={`${planner.length} / 5 notes saved`}><div className="flex items-center gap-2 text-[12px] text-ink-soft"><FileText className="size-4 text-brand" /> Keep your working notes in one place.</div></Section><Section title={editing == null ? "Create a note" : "Edit note"}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="min-h-11 w-full rounded-xl border border-line px-3 text-[16px]" /><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your note" rows={5} className="w-full rounded-xl border border-line px-3 py-2 text-[16px]" /><button disabled={planner.length >= 5 && editing == null} onClick={save} className="min-h-11 w-full rounded-full bg-ink text-[13px] font-semibold text-white disabled:opacity-40">{editing == null ? "Save note" : "Update note"}</button>{planner.length >= 5 && editing == null && <p className="text-[12px] text-ink-soft">Maximum reached. Delete a note before creating another.</p>}</Section><Section title="Saved notes">{planner.length === 0 ? <p className="text-center text-[12px] text-ink-soft">No notes saved yet.</p> : <div className="space-y-2">{planner.map((item, i) => <div key={`${item.title}-${i}`} className="rounded-xl border border-line p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-ink">{item.title || "Untitled"}</p><p className="mt-1 whitespace-pre-wrap text-[12px] text-ink-soft">{item.body}</p></div><button onClick={() => { setEditing(i); setTitle(item.title); setBody(item.body); }} aria-label="Edit note" className="text-ink-soft"><Edit3 className="size-4" /></button><button onClick={() => { if (window.confirm("Delete this note?")) setPlanner(planner.filter((_, index) => index !== i)); }} aria-label="Delete note" className="text-brand"><Trash2 className="size-4" /></button></div></div>)}</div>}</Section></Shell>; }

function CampaignActivityCentre({ campaignHistory = [], campaignRuns = [], sentRecipientCount = 0, activity, settings, updateSettings, onBack, onDisableActivity, initialCampaignFilter = "all", initialActivityFilter = "all", initialCampaignRunId }: Pick<Props, "campaignHistory" | "campaignRuns" | "sentRecipientCount" | "activity" | "settings" | "updateSettings" | "onBack" | "onDisableActivity" | "initialCampaignFilter" | "initialActivityFilter" | "initialCampaignRunId">) {
  const [section, setSection] = useState<"overview" | "campaigns" | "activity">(initialCampaignRunId || initialCampaignFilter !== "all" ? "campaigns" : initialActivityFilter !== "all" ? "activity" : "overview");
  const [activityFilter, setActivityFilter] = useState(initialActivityFilter);
  const [expandedRun, setExpandedRun] = useState<string | null>(initialCampaignRunId ?? null);
  const [runFilter, setRunFilter] = useState(initialCampaignFilter);
  const totalSent = campaignHistory.reduce((sum, day) => sum + day.sent, 0);
  const campaignRows = [...campaignHistory].sort((a, b) => b.date.localeCompare(a.date));
  const todayKey = new Date().toISOString().slice(0, 10);
  const visibleRuns = campaignRuns.filter(run => runFilter === "all" || (runFilter === "today" ? run.startedAt.slice(0, 10) === todayKey : runFilter === "skipped" ? run.skippedCount > 0 : runFilter === "failed" ? run.failedCount > 0 || run.status === "failed" : run.status === runFilter));
  const visibleCampaignRows = runFilter === "today" ? campaignRows.filter(day => day.date === todayKey) : campaignRows;
  const recordedSent = campaignRuns.reduce((sum, run) => sum + run.sentCount, 0);
  const recordedSkipped = campaignRuns.reduce((sum, run) => sum + run.skippedCount, 0);
  const recordedFailed = campaignRuns.reduce((sum, run) => sum + run.failedCount, 0);
  const visibleActivity = activity.filter(event => {
    if (activityFilter === "campaign") return /campaign|send|recipient|gmail/i.test(event);
    if (activityFilter === "system") return /workspace|setting|profile|subscription|plan/i.test(event);
    return true;
  });
  const buttonClass = (active: boolean) => `min-h-10 rounded-full border px-3 text-[12px] font-semibold ${active ? "border-brand bg-brand text-white" : "border-line bg-card text-ink"}`;
  return <Shell title="Campaign & Activity Centre" onBack={onBack}>
    <Section title="Workspace overview" description="A unified view of recorded campaign performance and workspace activity. Choose a card to inspect its records.">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setSection("campaigns")} className="rounded-2xl border border-line bg-soft p-4 text-left"><p className="text-2xl font-bold text-ink">{totalSent.toLocaleString()}</p><p className="label-caps">Recent successful sends</p><p className="mt-1 text-[10px] text-brand">View campaign history →</p></button>
        <button onClick={() => { setSection("campaigns"); setRunFilter("skipped"); }} className="rounded-2xl border border-line bg-soft p-4 text-left"><p className="text-2xl font-bold text-ink">{recordedSkipped}</p><p className="label-caps">Skipped recipients</p><p className="mt-1 text-[10px] text-brand">View skipped outcomes →</p></button>
        <button onClick={() => setSection("activity")} className="rounded-2xl border border-line bg-soft p-4 text-left"><p className="text-2xl font-bold text-ink">{activity.length}</p><p className="label-caps">Workspace events</p><p className="mt-1 text-[10px] text-brand">View activity records →</p></button>
        <button onClick={() => setSection("campaigns")} className="rounded-2xl border border-line bg-soft p-4 text-left"><p className="text-2xl font-bold text-ink">{campaignRuns.length}</p><p className="label-caps">Campaign executions</p><p className="mt-1 text-[10px] text-brand">View execution details →</p></button>
        <button onClick={() => { setSection("campaigns"); setRunFilter("failed"); }} className="rounded-2xl border border-line bg-soft p-4 text-left"><p className="text-2xl font-bold text-ink">{recordedFailed}</p><p className="label-caps">Failed recipients</p><p className="mt-1 text-[10px] text-brand">View failed outcomes →</p></button>
        <div className="rounded-2xl border border-line bg-soft p-4"><p className="text-2xl font-bold text-ink">{sentRecipientCount.toLocaleString()}</p><p className="label-caps">Protected recipients</p></div>
      </div>
      <div className="flex flex-wrap gap-2"><button className={buttonClass(section === "overview")} onClick={() => setSection("overview")}>Overview</button><button className={buttonClass(section === "campaigns")} onClick={() => setSection("campaigns")}>Campaign tracking</button><button className={buttonClass(section === "activity")} onClick={() => setSection("activity")}>Workspace activity</button></div>
    </Section>
    {section === "overview" && <>
      <Section title="Campaign performance" description="Historical totals are shown separately from detailed execution records. New runs record actual recipient outcomes.">
        {campaignRows.length ? <div className="space-y-2">{campaignRows.map(day => <div key={day.date} className="flex items-center justify-between rounded-xl border border-line bg-card p-3"><div><p className="text-[12px] font-semibold text-ink">{day.date}</p><p className="text-[10px] text-ink-soft">Recorded successful sends</p></div><strong className="text-sm text-brand">{day.sent.toLocaleString()} sent</strong></div>)}</div> : <p className="rounded-xl bg-soft p-4 text-center text-[12px] text-ink-soft">No successful campaign activity recorded yet.</p>}
      </Section>
      <Section title="Activity recording" description="Activity history is separate from campaign performance."><div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-ink">Recording is {settings.activityRecording ? "ON" : "OFF"}</span><button type="button" role="switch" aria-checked={settings.activityRecording} onClick={() => settings.activityRecording ? onDisableActivity?.() : updateSettings({ activityRecording: true })} className={buttonClass(settings.activityRecording)}>{settings.activityRecording ? "Turn off" : "Turn on"}</button></div><p className="text-[11px] text-ink-soft">{activity.length} events currently recorded.</p></Section>
    </>}
    {section === "campaigns" && <>
      <Section title="Execution outcomes" description="These detailed records begin with campaigns executed after the ledger update. Older history remains available as daily totals only.">
        {initialCampaignRunId && !campaignRuns.some(run => run.id === initialCampaignRunId) && <p className="rounded-xl bg-soft p-3 text-[11px] text-ink-soft">That exact campaign execution is not in the five most recent saved runs on this device. The available campaign history is shown below.</p>}
        <div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-soft p-3"><p className="text-xl font-bold text-ink">{recordedSent}</p><p className="label-caps">Sent</p></div><div className="rounded-xl bg-soft p-3"><p className="text-xl font-bold text-ink">{recordedSkipped}</p><p className="label-caps">Skipped</p></div><div className="rounded-xl bg-soft p-3"><p className="text-xl font-bold text-ink">{recordedFailed}</p><p className="label-caps">Failed</p></div></div>
        <div className="flex flex-wrap gap-2">{["all","today","running","completed","paused","stopped","skipped","failed"].map(status => <button key={status} className={buttonClass(runFilter === status)} onClick={() => setRunFilter(status)}>{status === "all" ? "All runs" : status === "today" ? "Today" : status[0]!.toUpperCase()+status.slice(1)}</button>)}</div>
        {visibleRuns.length ? <div className="space-y-2">{visibleRuns.map(run => <div key={run.id} className="rounded-xl border border-line bg-card p-3">
          <button type="button" onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)} className="w-full text-left">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[12px] font-semibold text-ink">Campaign {run.id.slice(0,8)}</p><p className="mt-1 text-[10px] text-ink-soft">{new Date(run.startedAt).toLocaleString()} · {run.mode === "elite" ? "Elite Engine" : "Standard mode"}</p></div><span className="rounded-full bg-soft px-2 py-1 text-[10px] font-bold uppercase text-brand">{run.status}</span></div>
            <div className="mt-3 grid grid-cols-5 gap-1 text-center"><div><strong className="block text-sm text-ink">{run.targetCount}</strong><span className="text-[9px] text-ink-soft">Target</span></div><div><strong className="block text-sm text-ink">{run.sentCount}</strong><span className="text-[9px] text-ink-soft">Sent</span></div><div><strong className="block text-sm text-ink">{run.skippedCount}</strong><span className="text-[9px] text-ink-soft">Skipped</span></div><div><strong className="block text-sm text-ink">{run.failedCount}</strong><span className="text-[9px] text-ink-soft">Failed</span></div><div><strong className="block text-sm text-ink">{run.handedOffCount}</strong><span className="text-[9px] text-ink-soft">Handed off</span></div></div>
            <p className="mt-2 text-[10px] font-semibold text-brand">{expandedRun === run.id ? "Hide recipient details ↑" : "Show recipient details ↓"}</p>
          </button>
          {expandedRun === run.id && <div className="mt-3 space-y-2 border-t border-line pt-3">
            <div className="flex justify-end"><button type="button" onClick={() => downloadCsv(`campaign-${run.id.slice(0,8)}-recipients.csv`, [["Email","Name","Outcome","Reason","Recorded at"], ...run.recipients.map(row => [row.email,row.name ?? "",row.status,row.reason ?? "",row.at])])} className="min-h-9 rounded-full border border-line px-3 text-[10px] font-semibold text-ink"><Download className="mr-1 inline size-3" />Export recipients</button></div>
            {(runFilter === "skipped" ? run.recipients.filter(row => row.status === "skipped") : runFilter === "failed" ? run.recipients.filter(row => row.status === "failed") : run.recipients).length ? (runFilter === "skipped" ? run.recipients.filter(row => row.status === "skipped") : runFilter === "failed" ? run.recipients.filter(row => row.status === "failed") : run.recipients).map((row,index) => <div key={`${row.email}-${index}`} className="rounded-lg bg-soft p-2"><div className="flex items-center justify-between gap-2"><span className="min-w-0 break-all text-[11px] font-semibold text-ink">{row.email}</span><span className="shrink-0 text-[10px] font-bold uppercase text-brand">{row.status}</span></div>{row.reason && <p className="mt-1 text-[10px] text-ink-soft">{row.reason}</p>}<p className="mt-1 text-[9px] text-ink-soft">{new Date(row.at).toLocaleString()}</p></div>) : <p className="text-[11px] text-ink-soft">No recipient outcomes have been recorded yet.</p>}
          </div>}
        </div>)}</div> : <p className="rounded-xl bg-soft p-4 text-center text-[12px] text-ink-soft">No detailed campaign executions match this filter yet.</p>}
      </Section>
      <Section title="Legacy daily totals" description="Older campaign history was saved as daily totals, not individual campaign records.">
        <div className="flex items-center justify-between"><span className="text-[12px] text-ink-soft">{visibleCampaignRows.length} daily records</span><button type="button" disabled={!visibleCampaignRows.length} onClick={() => downloadCsv("elite-connectere-campaign-history.csv", [["Date","Successful sends"], ...visibleCampaignRows.map(day => [day.date, String(day.sent)])])} className="min-h-10 rounded-full border border-line px-3 text-[11px] font-semibold text-ink disabled:opacity-40"><Download className="mr-1 inline size-3" />Export</button></div>
        {visibleCampaignRows.length ? visibleCampaignRows.map(day => <div key={day.date} className="mt-2 rounded-xl border border-line p-3"><div className="flex justify-between text-[12px]"><span className="font-semibold text-ink">{day.date}</span><strong className="text-brand">{day.sent} successful</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand" style={{width:`${totalSent ? Math.max(2, day.sent / totalSent * 100) : 0}%`}} /></div></div>) : <p className="py-4 text-center text-[12px] text-ink-soft">No legacy daily totals for this filter yet.</p>}
      </Section>
    </>}
    {section === "activity" && <Section title="Workspace activity" description="Inspect the actual event text recorded by the workspace.">
      <div className="flex flex-wrap gap-2"><button className={buttonClass(activityFilter === "all")} onClick={() => setActivityFilter("all")}>All events</button><button className={buttonClass(activityFilter === "campaign")} onClick={() => setActivityFilter("campaign")}>Campaign events</button><button className={buttonClass(activityFilter === "system")} onClick={() => setActivityFilter("system")}>Workspace events</button></div>
      <div className="flex items-center justify-between"><span className="text-[11px] text-ink-soft">{visibleActivity.length} matching events</span><button type="button" disabled={!visibleActivity.length} onClick={() => downloadCsv("elite-connectere-activity.csv", [["Activity"], ...visibleActivity.map(event => [event])])} className="min-h-10 rounded-full border border-line px-3 text-[11px] font-semibold text-ink disabled:opacity-40"><Download className="mr-1 inline size-3" />Export</button></div>
      {visibleActivity.length ? <ol className="max-h-[30rem] space-y-2 overflow-y-auto">{visibleActivity.map((event, i) => <li key={`${event}-${i}`} className="flex gap-3 rounded-xl border border-line bg-card p-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-brand" /><p className="min-w-0 flex-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">{event}</p></li>)}</ol> : <p className="py-4 text-center text-[12px] text-ink-soft">No matching activity records.</p>}
    </Section>}
  </Shell>;
}

function ActivityStudio({ settings, updateSettings, activity, onBack, onDisableActivity }: Pick<Props, "settings" | "updateSettings" | "activity" | "onBack" | "onDisableActivity">) {
  return <Shell title={titles.activity} onBack={onBack}>
    <Section title="Activity overview" description="A single view of recorded workspace events.">
      <div className="grid grid-cols-2 gap-2"><div className="rounded-2xl bg-soft p-4"><p className="text-2xl font-bold text-ink">{activity.length}</p><p className="label-caps">Recorded events</p></div><div className="rounded-2xl bg-soft p-4"><p className="text-2xl font-bold text-ink">{settings.activityRecording ? "ON" : "OFF"}</p><p className="label-caps">Recording status</p></div></div>
      <button type="button" disabled={!activity.length} onClick={() => downloadCsv("elite-connectere-activity.csv", [["Activity"], ...activity.map(event => [event])])} className="min-h-11 w-full rounded-full border border-line px-4 text-[12px] font-semibold text-ink disabled:opacity-40"><Download className="mr-2 inline size-4" />Export activity</button>
    </Section>
    <Section title="Recording preferences" description="Turning recording off stops new activity entries; it does not delete existing history.">
      <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-ink">Record activity</span><button type="button" role="switch" aria-checked={settings.activityRecording} onClick={() => settings.activityRecording ? onDisableActivity?.() : updateSettings({ activityRecording: true })} className={`relative h-7 w-12 rounded-full ${settings.activityRecording ? "bg-brand" : "bg-line"}`} aria-label="Toggle activity recording"><span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${settings.activityRecording ? "left-6" : "left-1"}`} /></button></div>
    </Section>
    <Section title="Activity timeline" description="Recorded workspace events.">
      {activity.length === 0 ? <p className="rounded-xl bg-soft p-4 text-center text-[12px] text-ink-soft">No activity recorded yet.</p> : <ol className="max-h-[28rem] space-y-2 overflow-y-auto">{activity.map((event, i) => <li key={`${event}-${i}`} className="flex gap-3 rounded-xl border border-line bg-card p-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-brand" /><p className="min-w-0 flex-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">{event}</p></li>)}</ol>}
    </Section>
  </Shell>;
}

function TrackerStudio({ campaignHistory = [], sentRecipientCount = 0, onBack }: Pick<Props, "campaignHistory" | "sentRecipientCount" | "onBack">) {
  const total = campaignHistory.reduce((sum, day) => sum + day.sent, 0);
  return <Shell title={titles.tracker} onBack={onBack}>
    <Section title="Campaign performance" description="Successful sends recorded by the workspace.">
      <div className="grid grid-cols-2 gap-2"><div className="rounded-2xl bg-soft p-4"><p className="text-2xl font-bold text-ink">{total}</p><p className="label-caps">Sends in history</p></div><div className="rounded-2xl bg-soft p-4"><p className="text-2xl font-bold text-ink">{campaignHistory.length}</p><p className="label-caps">Recorded days</p></div></div>
      <p className="text-[11px] text-ink-soft">{sentRecipientCount} recipients currently covered by duplicate-send protection.</p>
      <button type="button" disabled={!campaignHistory.length} onClick={() => downloadCsv("elite-connectere-campaign-tracker.csv", [["Date","Successful sends"], ...campaignHistory.map(day => [day.date, String(day.sent)])])} className="min-h-11 w-full rounded-full border border-line px-4 text-[12px] font-semibold text-ink disabled:opacity-40"><Download className="mr-2 inline size-4" />Export tracker data</button>
    </Section>
    <Section title="Daily activity" description="Recorded campaign days.">
      {campaignHistory.length ? <div className="space-y-2">{campaignHistory.map(day => <div key={day.date} className="rounded-xl border border-line bg-card p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[12px] font-semibold text-ink">{day.date}</span><strong className="text-sm text-brand">{day.sent} sent</strong></div><div className="h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand" style={{width: `${total ? Math.max(2, day.sent / total * 100) : 0}%`}} /></div></div>)}</div> : <p className="rounded-xl bg-soft p-4 text-center text-[12px] text-ink-soft">No successful campaign activity has been recorded yet.</p>}
    </Section>
    <Section title="History retention" description="Exporting creates a separate CSV copy."><p className="text-[12px] text-ink-soft">Exporting does not delete or change campaign records.</p></Section>
  </Shell>;
}

function NightModeStudio({ settings, updateSettings, onBack }: Pick<Props, "settings" | "updateSettings" | "onBack">) {
  const colors = [["rainbow", "Rainbow", "Full-spectrum rotating colour"], ["aurora", "Aurora", "Cool green and violet glow"], ["ocean", "Ocean", "Blue and cyan ambience"], ["sunset", "Sunset", "Warm pink, orange and gold"]] as const;
  const animations = [
    ["electric", "Electric Flux", "Fast branching energy flashes and electric arcs"],
    ["aurora", "Aurora Waves", "Slow flowing ribbons of atmospheric light"],
    ["plasma", "Plasma Pulse", "Deep, rhythmic waves of glowing energy"],
    ["comet", "Comet Trails", "A bright moving trail travelling around the screen edge"],
    ["circuit", "Neon Circuit", "Segmented, stepping pulses like a living neon circuit"],
  ] as const;
  const speeds = [["slow", "Slow"], ["medium", "Medium"], ["fast", "Fast"]] as const;
  return <Shell title={titles.nightMode} onBack={onBack}>
    <Section title="Edge light" description="Night Mode Light and its animation, colours, and intensity are part of Elite Studio ProMaxx. Changes apply immediately while eligible.">
      <div className="flex items-center justify-between"><div><p className="text-[13px] font-semibold text-ink">Night Mode Light</p><p className="text-[11px] text-ink-soft">{settings.nightModeLight ? "Active around the screen edge" : "Turn it on to preview your edge light"}</p></div><button type="button" aria-label="Toggle Night Mode Light" onClick={() => updateSettings({ nightModeLight: !settings.nightModeLight })} className={`relative h-7 w-12 rounded-full ${settings.nightModeLight ? "bg-brand" : "bg-line"}`}><span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${settings.nightModeLight ? "left-6" : "left-1"}`} /></button></div>
    </Section>
    <Section title="Choose an animation" description="Choose the visual effect itself. This is separate from choosing its colours.">
      <div className="space-y-2">{animations.map(([value, label, description]) => <button type="button" key={value} onClick={() => updateSettings({ nightModeAnimation: value })} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${settings.nightModeAnimation === value ? "border-brand bg-brand-soft" : "border-line"}`}><span className={`night-animation-preview night-animation-preview--${value}`} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink">{label}</span><span className="block text-[11px] text-ink-soft">{description}</span></span><span className="text-[11px] font-semibold text-brand">{settings.nightModeAnimation === value ? "Selected" : "Choose"}</span></button>)}</div>
    </Section>
    <Section title="Choose your colours" description="Colour selection changes the palette, not the animation type."><div className="grid grid-cols-2 gap-2">{colors.map(([value, label, description]) => <button type="button" key={value} onClick={() => updateSettings({ nightModeColor: value })} className={`min-h-20 rounded-xl border p-3 text-left ${settings.nightModeColor === value ? "border-brand bg-brand-soft" : "border-line"}`}><span className={`mb-2 block h-2 rounded-full night-swatch-${value}`} /><span className="block text-[12.5px] font-semibold text-ink">{label}</span><span className="mt-0.5 block text-[10.5px] leading-tight text-ink-soft">{description}</span></button>)}</div><div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-soft p-3"><label className="relative flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_var(--line),0_0_14px_rgba(0,0,0,0.12)] night-color-wheel"><span className="size-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: settings.nightModeCustomColor }} /><input aria-label="Night Mode custom color" type="color" value={settings.nightModeCustomColor} onChange={(event) => updateSettings({ nightModeCustomColor: event.target.value })} className="absolute inset-0 cursor-pointer opacity-0" /></label><div className="min-w-0 flex-1"><p className="text-[12.5px] font-semibold text-ink">Color wheel accent</p><p className="text-[11px] text-ink-soft">Tap the wheel to add a personal glow to the edge.</p><code className="mt-1 block text-[11px] font-semibold uppercase text-brand">{settings.nightModeCustomColor}</code></div></div></Section>
    <Section title="Animation speed"><div className="grid grid-cols-3 gap-2">{speeds.map(([value, label]) => <button type="button" key={value} onClick={() => updateSettings({ nightModeSpeed: value })} className={`min-h-11 rounded-full border text-[12px] font-semibold ${settings.nightModeSpeed === value ? "border-brand bg-brand text-white" : "border-line text-ink"}`}>{label}</button>)}</div></Section>
    <Section title="Edge coverage" description="Control the strength and reach of the light around the screen."><input aria-label="Night Mode Light intensity" type="range" min="1" max="5" step="1" value={settings.nightModeIntensity} onChange={(event) => updateSettings({ nightModeIntensity: Number(event.target.value) })} className="w-full accent-[hsl(var(--brand))]" /><div className="flex justify-between text-[11px] text-ink-soft"><span>Soft</span><span>Maximum glow</span></div></Section>
  </Shell>;
}

function SendingStudio({ settings, updateSettings, onBack }: Pick<Props, "settings" | "updateSettings" | "onBack">) {
  const sounds = [
    ["air-swish", "Air swish", "A smooth, quick pass through the air"],
    ["air-swish-long", "Air swish — long glide", "A longer, deeper glide through the air"],
    ["air-swish-soft", "Air swish — soft", "A quieter, gentler airy sweep"],
    ["soft-sweep", "Soft sweep", "A short rising sweep with a clean finish"],
    ["pass-by", "Pass-by", "A quick fly-by with a stronger Doppler-style finish"],
  ] as const;
  return <Shell title={titles.sending} onBack={onBack}>
    <Section title="Compare sending sounds" description="Tap each option to hear it. These are temporary previews so you can choose the one that feels right. The selected sound is used when mail is sent.">
      <div className="space-y-2">{sounds.map(([value, label, description]) => <button key={value} type="button" onClick={() => { updateSettings({ sendingSound: true, sendingSoundVariant: value }); playSendSound(value, settings.sounds !== false); }} className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 text-left ${settings.sendingSoundVariant === value ? "border-brand bg-brand-soft" : "border-line"}`}><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Volume2 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink">{label}</span><span className="block text-[11px] text-ink-soft">{description}</span></span><span className="text-[11px] font-semibold text-brand">{settings.sendingSoundVariant === value ? "Selected" : "Play"}</span></button>)}</div>
      <p className="rounded-xl bg-soft p-3 text-[11px] leading-snug text-ink-soft">Choose one of these five sending-sound previews. The selected sound is used for real sent-mail confirmations and can be changed here at any time.</p>
    </Section>
    <Section title="Visible sending modes" description="This changes workspace presentation only. It does not change Elite Engine access or sending behavior."><div className="space-y-2">{([['both', 'Both', 'Show Standard and Elite Engine'], ['standard', 'Standard only', 'Center Standard mode'], ['elite', 'Elite only', 'Center Elite Engine']] as const).map(([value, label, description]) => <button key={value} onClick={() => updateSettings({ sendingMode: value })} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left ${settings.sendingMode === value ? "border-brand bg-brand-soft" : "border-line"}`}><span className={`flex size-5 items-center justify-center rounded-full border ${settings.sendingMode === value ? "border-brand bg-brand text-white" : "border-line"}`}>{settings.sendingMode === value && <Check className="size-3" />}</span><span><span className="block text-[13px] font-semibold text-ink">{label}</span><span className="block text-[11px] text-ink-soft">{description}</span></span></button>)}</div></Section>
  </Shell>;
}
