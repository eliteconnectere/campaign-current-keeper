import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  Copy,
  Link2,
  Pencil,
  Reply,
  Trash2,
  Check,
  CheckCheck,
  ChevronRight,
  ImagePlus,
  Loader2,
  RotateCw,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { supabase as typedClient } from "@/integrations/supabase/client";
import {
  cancelConnectionRequest,
  deleteChatHistory,
  getChatMe,
  removeConnection,
  respondConnectionRequest,
  saveChatProfile,
  sendConnectionRequest,
  syncSharedChatEnergy,
  type ChatMe,
} from "@/lib/chat.functions";
import { playSound } from "@/lib/sounds";
import { inspectOutgoingChatMessage } from "@/lib/guardian.functions";
import { RexChatFab } from "@/features/assist/RexChatFab";

// Chat tables are newer than the generated types; use an untyped handle.
const db = typedClient as unknown as SupabaseClient;
// Always upload to the same Supabase project used by the authenticated client.
// This avoids stale project URLs/keys when the backend project is replaced.
const SUPABASE_URL = typedClient.supabaseUrl;
const ANON = typedClient.supabaseKey;

type Profile = { user_id: string; display_name: string; username: string };
type Request = { id: string; sender_id: string; receiver_id: string; status: string; created_at: string };
type Connection = { id: string; user_a: string; user_b: string; created_at: string };
type Message = {
  id: string;
  connection_id: string;
  sender_id: string;
  kind: "text" | "image";
  body: string | null;
  image_path: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  reply_to?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
};

/* ------------------------------------------------------------------ */
/* Hub: always-on listener for unread counts, requests and sounds.     */
/* ------------------------------------------------------------------ */

export type ChatNotify = (kind: "chatMessage" | "chatRequest" | "chatAccepted", text: string) => void;

export function useChatHub(opts: {
  enabled: boolean;
  activeConnectionId: string | null;
  sounds: boolean;
  notify: ChatNotify;
}) {
  const [me, setMe] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [incoming, setIncoming] = useState(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  /** Per conversation: newest incoming message time the user has actually seen. */
  const readMarks = useRef<Record<string, string>>({});
  /** Read updates still being saved; counts wait for them before reloading. */
  const pendingReads = useRef<Set<Promise<unknown>>>(new Set());

  const refresh = useCallback(async (uid: string) => {
    if (pendingReads.current.size) await Promise.allSettled([...pendingReads.current]);
    const [{ data: msgs }, { data: reqs }, { data: hidden }] = await Promise.all([
      db.from("chat_messages").select("id, connection_id, created_at").is("read_at", null).is("deleted_at", null).neq("sender_id", uid).limit(1000),
      db.from("connection_requests").select("id").eq("receiver_id", uid).eq("status", "pending"),
      db.from("chat_message_hidden").select("message_id"),
    ]);
    const hiddenIds = new Set(((hidden ?? []) as { message_id: string }[]).map((item) => item.message_id));
    const counts: Record<string, number> = {};
    for (const m of (msgs ?? []) as { id: string; connection_id: string; created_at: string }[]) {
      if (hiddenIds.has(m.id)) continue;
      const seen = readMarks.current[m.connection_id];
      if (seen && m.created_at <= seen) continue; // already viewed — never count again
      counts[m.connection_id] = (counts[m.connection_id] ?? 0) + 1;
    }
    setUnread(counts);
    setIncoming((reqs ?? []).length);
    if ((msgs ?? []).length) void db.rpc("mark_chat_delivered");
  }, []);

  useEffect(() => {
    if (!opts.enabled) return;
    let cancelled = false;
    let channel: ReturnType<typeof db.channel> | null = null;
    void db.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      setMe(uid);
      void refresh(uid);
      channel = db
        .channel(`chat-hub-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
          const m = p.new as Message;
          if (m.sender_id === uid) return; // own messages never count as unread
          void db.rpc("mark_chat_delivered");
          const o = optsRef.current;
          const viewing = o.activeConnectionId === m.connection_id && document.visibilityState === "visible";
          if (viewing) return;
          setUnread((u) => ({ ...u, [m.connection_id]: (u[m.connection_id] ?? 0) + 1 }));
          playSound("message", o.sounds);
          o.notify("chatMessage", "New private message");
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "connection_requests" }, (p) => {
          const r = p.new as Request;
          if (r.receiver_id !== uid) return;
          setIncoming((n) => n + 1);
          playSound("request", optsRef.current.sounds);
          optsRef.current.notify("chatRequest", "You have a new connection request.");
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "connection_requests" }, (p) => {
          const r = p.new as Request;
          if (r.receiver_id === uid) void refresh(uid);
          if (r.sender_id === uid && r.status === "accepted") {
            playSound("accepted", optsRef.current.sounds);
            optsRef.current.notify("chatAccepted", "Your connection request was accepted.");
          }
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void db.removeChannel(channel);
    };
  }, [opts.enabled, refresh]);

  /** Marks a conversation read up to `upTo` and saves it; badge clears at once. */
  const markRead = useCallback((cid: string, upTo: string | null) => {
    if (upTo && (!readMarks.current[cid] || upTo > readMarks.current[cid])) readMarks.current[cid] = upTo;
    setUnread((u) => {
      if (!(cid in u)) return u;
      const { [cid]: _drop, ...rest } = u;
      return rest;
    });
    const job: Promise<unknown> = Promise.resolve(db.rpc("mark_chat_read", { _cid: cid })).finally(() => {
      pendingReads.current.delete(job);
    });
    pendingReads.current.add(job);
    return job;
  }, []);
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  return { me, unread, incoming, totalUnread, markRead, refresh: async () => (me ? refresh(me) : undefined) };
}

/* ------------------------------------------------------------------ */
/* Signed image URLs (private bucket)                                  */
/* ------------------------------------------------------------------ */

const urlCache = new Map<string, string>();
function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(path ? (urlCache.get(path) ?? null) : null);
  useEffect(() => {
    if (!path || urlCache.has(path)) return;
    let live = true;
    void db.storage
      .from("chat-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl && live) {
          urlCache.set(path, data.signedUrl);
          setUrl(data.signedUrl);
        }
      });
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

/* ------------------------------------------------------------------ */
/* Main overlay                                                        */
/* ------------------------------------------------------------------ */

export type ChatPrefs = { enterToSend: boolean; links: boolean };

export function PrivateChat({
  hub,
  prefs,
  onClose,
  onActiveChange,
  onUpgrade,
  onOpenRex = () => {},
}: {
  hub: ReturnType<typeof useChatHub>;
  prefs: ChatPrefs;
  onClose: () => void;
  onActiveChange: (cid: string | null) => void;
  onUpgrade: () => void;
  onOpenRex: () => void;
}) {
  const [meInfo, setMeInfo] = useState<ChatMe | null>(null);
  const [active, setActive] = useState<{ cid: string; partner: Profile } | null>(null);

  useEffect(() => {
    void getChatMe()
      .then(setMeInfo)
      .catch(() => setMeInfo({ eligible: false, profile: null }));
  }, []);
  useEffect(() => onActiveChange(active?.cid ?? null), [active, onActiveChange]);
  useEffect(() => () => onActiveChange(null), [onActiveChange]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-background">
      <RexChatFab visible onOpen={onOpenRex} />
      {!meInfo ? (
        <div className="grid flex-1 place-items-center">
          <Loader2 className="size-5 animate-spin text-ink-soft" />
        </div>
      ) : !meInfo.eligible ? (
        <Gate onClose={onClose} onUpgrade={onUpgrade} />
      ) : !meInfo.profile ? (
        <Setup onClose={onClose} onDone={(profile) => setMeInfo({ eligible: true, profile })} />
      ) : active && hub.me ? (
        <Conversation
          me={hub.me}
          cid={active.cid}
          partner={active.partner}
          prefs={prefs}
          onBack={async (lastRead) => {
            // Persist the read state first, then return to the list.
            await hub.markRead(active.cid, lastRead);
            setActive(null);
            void hub.refresh();
          }}
          onRead={(upTo) => hub.markRead(active.cid, upTo)}
        />
      ) : (
        <Home hub={hub} onClose={onClose} onOpen={(cid, partner) => setActive({ cid, partner })} />
      )}
    </div>
  );
}

function Header({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-background px-3 py-2.5">
      <button type="button" onClick={onBack} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-muted">
        <ArrowLeft className="size-5 text-ink" />
      </button>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-ink">{title}</p>
        {sub && <p className="truncate text-[11.5px] text-ink-soft">{sub}</p>}
      </div>
    </header>
  );
}

function Gate({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  return (
    <>
      <Header title="Private Chat" onBack={onClose} />
      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[15px] font-semibold text-ink">Private Chat is part of Premium & Elite Studio ProMaxx</p>
        <p className="text-[13px] text-ink-soft">Connect privately with other Premium & Elite Studio ProMaxx members while your campaigns keep running.</p>
        <button type="button" onClick={onUpgrade} className="rounded-full bg-brand px-5 py-2 text-[13px] font-semibold text-primary-foreground">
          See Premium & ProMaxx
        </button>
      </div>
    </>
  );
}

function Setup({ onClose, onDone }: { onClose: () => void; onDone: (p: { display_name: string; username: string }) => void }) {
  const [name, setName] = useState("");
  const [user, setUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await saveChatProfile({ data: { displayName: name, username: user } });
      onDone({ display_name: name.trim(), username: user.trim().replace(/^@/, "").toLowerCase() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header title="Set up Private Chat" onBack={onClose} />
      <div className="mx-auto w-full max-w-sm space-y-3 p-5">
        <p className="text-[13px] text-ink-soft">Choose how other Premium & Elite Studio ProMaxx members find you. Your email is never shown.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-line bg-background px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand" />
        <div className="flex items-center rounded-xl border border-line px-3 focus-within:border-brand">
          <span className="text-ink-soft">@</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="username" autoCapitalize="none" className="w-full bg-transparent px-1 py-2.5 text-[14px] text-ink outline-none" />
        </div>
        {err && <p className="text-[12.5px] text-brand">{err}</p>}
        <button type="button" disabled={busy} onClick={() => void save()} className="w-full rounded-full bg-brand py-2.5 text-[14px] font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>
    </>
  );
}

/* ---------------------------- Home ---------------------------- */

function Home({
  hub,
  onClose,
  onOpen,
}: {
  hub: ReturnType<typeof useChatHub>;
  onClose: () => void;
  onOpen: (cid: string, partner: Profile) => void;
}) {
  const me = hub.me;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [people, setPeople] = useState<Record<string, Profile>>({});
  const [last, setLast] = useState<Record<string, Message>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ connection: Connection; profile: Profile } | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const [{ data: reqs }, { data: conns }] = await Promise.all([
      db.from("connection_requests").select("*").eq("status", "pending").or(`sender_id.eq.${me},receiver_id.eq.${me}`),
      db.from("connections").select("*").order("created_at", { ascending: false }),
    ]);
    const r = (reqs ?? []) as Request[];
    const c = (conns ?? []) as Connection[];
    setRequests(r);
    setConnections(c);
    const ids = new Set<string>();
    r.forEach((x) => ids.add(x.sender_id === me ? x.receiver_id : x.sender_id));
    c.forEach((x) => ids.add(x.user_a === me ? x.user_b : x.user_a));
    if (ids.size) {
      const { data: ps } = await db.from("chat_profiles").select("user_id, display_name, username").in("user_id", [...ids]);
      setPeople(Object.fromEntries(((ps ?? []) as Profile[]).map((p) => [p.user_id, p])));
    }
    if (c.length) {
      const [{ data: ms }, { data: hidden }] = await Promise.all([
        db.from("chat_messages").select("*").in("connection_id", c.map((x) => x.id))
          .order("created_at", { ascending: false }).limit(300),
        db.from("chat_message_hidden").select("message_id"),
      ]);
      const hiddenIds = new Set(((hidden ?? []) as { message_id: string }[]).map((item) => item.message_id));
      const map: Record<string, Message> = {};
      for (const m of (ms ?? []) as Message[]) {
        if (!hiddenIds.has(m.id)) map[m.connection_id] ??= m;
      }
      setLast(map);
    } else {
      setLast({});
    }
  }, [me]);

  useEffect(() => {
    void load();
  }, [load, hub.incoming, hub.totalUnread]);

  useEffect(() => {
    if (!me) return;
    const ch = db
      .channel(`chat-home-${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_requests" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "connections" }, () => void load())
      .subscribe();
    return () => {
      void db.removeChannel(ch);
    };
  }, [me, load]);

  useEffect(() => {
    const term = q.trim().replace(/^@/, "");
    if (term.length < 2 || !me) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      const safe = term.replace(/[%,()*]/g, "");
      const { data } = await db
        .from("chat_profiles")
        .select("user_id, display_name, username")
        .eq("eligible", true)
        .neq("user_id", me)
        .or(`display_name.ilike.%${safe}%,username.ilike.%${safe}%`)
        .limit(20);
      setResults((data ?? []) as Profile[]);
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, me]);

  const partnerOf = (c: Connection) => (c.user_a === me ? c.user_b : c.user_a);
  const connectedIds = useMemo(() => new Set(connections.map(partnerOf)), [connections, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const incoming = requests.filter((r) => r.receiver_id === me);
  const outgoing = requests.filter((r) => r.sender_id === me);
  const sentTo = new Set(outgoing.map((r) => r.receiver_id));
  const fromIds = new Set(incoming.map((r) => r.sender_id));
  const conversations = connections
    .filter((c) => last[c.id])
    .sort((a, b) => (last[b.id]!.created_at > last[a.id]!.created_at ? 1 : -1));
  const quiet = connections.filter((c) => !last[c.id]);
  const nameOf = (id: string): Profile => people[id] ?? { user_id: id, display_name: "Elite member", username: "" };

  async function connect(p: Profile) {
    setBusy(p.user_id);
    try {
      const res = await sendConnectionRequest({ data: { receiverId: p.user_id } });
      if (res.status === "incoming") toast.info(`${p.display_name} already sent you a request — accept it below.`);
      else if (res.status === "sent") toast.success("Request sent");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }
  async function cancel(r: Request) {
    setBusy(r.id);
    try {
      await cancelConnectionRequest({ data: { requestId: r.id } });
      await load();
      toast.success("Request cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel request.");
    } finally {
      setBusy(null);
    }
  }

  async function menuAction(action: "delete" | "unfriend") {
    if (!menu) return;
    const { connection, profile } = menu;
    setMenu(null);
    if (!window.confirm(action === "delete" ? `Delete the entire chat with ${profile.display_name}?` : `Unfriend ${profile.display_name}?`)) return;
    setBusy(connection.id);
    try {
      if (action === "delete") await deleteChatHistory({ data: { connectionId: connection.id } });
      else await removeConnection({ data: { connectionId: connection.id } });
      await load();
      toast.success(action === "delete" ? "Chat deleted" : "Connection removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function respond(r: Request, accept: boolean) {
    setBusy(r.id);
    try {
      const res = await respondConnectionRequest({ data: { requestId: r.id, accept } });
      await load();
      void hub.refresh();
      if (accept && res.connectionId) {
        toast.success("Connected");
        onOpen(res.connectionId, nameOf(r.sender_id));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not respond.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Header title="Private Chat" sub="Private connections only" onBack={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-brand">
            <Search className="size-4 shrink-0 text-ink-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="w-full min-w-0 bg-transparent py-2.5 text-[14px] text-ink outline-none" />
            {searching && <Loader2 className="size-4 animate-spin text-ink-soft" />}
          </div>

          {q.trim().length >= 2 && (
            <Section title="Search results">
              {results.length === 0 && !searching && <Empty>No members match “{q.trim()}”.</Empty>}
              {results.map((p) => {
                const state = connectedIds.has(p.user_id) ? "connected" : sentTo.has(p.user_id) ? "sent" : fromIds.has(p.user_id) ? "incoming" : "none";
                return (
                  <Row key={p.user_id} p={p}>
                    {state === "connected" ? (
                      <Pill>Connected</Pill>
                    ) : state === "sent" ? (
                      <Pill>Request sent</Pill>
                    ) : state === "incoming" ? (
                      <Pill>Wants to connect</Pill>
                    ) : (
                      <button type="button" disabled={busy === p.user_id} onClick={() => void connect(p)} className="flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60">
                        <UserPlus className="size-3.5" /> Connect
                      </button>
                    )}
                  </Row>
                );
              })}
            </Section>
          )}

          {incoming.length > 0 && (
            <Section title={`Connection requests · ${incoming.length}`}>
              {incoming.map((r) => (
                <Row key={r.id} p={nameOf(r.sender_id)}>
                  <div className="flex gap-1.5">
                    <button type="button" disabled={busy === r.id} onClick={() => void respond(r, true)} className="rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60">Accept</button>
                    <button type="button" disabled={busy === r.id} onClick={() => void respond(r, false)} className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-60">Decline</button>
                  </div>
                </Row>
              ))}
            </Section>
          )}

          {outgoing.length > 0 && (
            <Section title="Sent requests">
              {outgoing.map((r) => (
                <Row key={r.id} p={nameOf(r.receiver_id)}>
                  <button type="button" disabled={busy === r.id} onClick={() => void cancel(r)} className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-60">Cancel</button>
                </Row>
              ))}
            </Section>
          )}

          <Section title="Conversations">
            {conversations.length === 0 && <Empty>No conversations yet.</Empty>}
            {conversations.map((c) => {
              const p = nameOf(partnerOf(c));
              const m = last[c.id]!;
              const n = hub.unread[c.id] ?? 0;
              return (
                <button key={c.id} type="button" onClick={() => onOpen(c.id, p)} onContextMenu={(event) => { event.preventDefault(); setMenu({ connection: c, profile: p }); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted">
                  <Avatar name={p.display_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14px] font-semibold text-ink">{p.display_name}</p>
                      <span className="shrink-0 text-[11px] text-ink-soft">{time(m.created_at)}</span>
                    </div>
                    <p className={`truncate text-[12.5px] ${n ? "font-semibold text-ink" : "text-ink-soft"}`}>
                      {m.sender_id === me ? "You: " : ""}
                      {m.kind === "image" ? `📷 ${m.body || "Photo"}` : m.body}
                    </p>
                  </div>
                  {n > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-primary-foreground">{n}</span>}
                </button>
              );
            })}
          </Section>

          <Section title="Connections">
            {connections.length === 0 && <Empty>Search for a member above to send your first connection request.</Empty>}
            {quiet.map((c) => {
              const p = nameOf(partnerOf(c));
              return (
                <button key={c.id} type="button" onClick={() => onOpen(c.id, p)} onContextMenu={(event) => { event.preventDefault(); setMenu({ connection: c, profile: p }); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted">
                  <Avatar name={p.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{p.display_name}</p>
                    <p className="text-[12px] text-ink-soft">Connected</p>
                  </div>
                  <ChevronRight className="size-4 text-ink-soft" />
                </button>
              );
            })}
          </Section>

          {menu && (
            <div className="fixed inset-x-4 bottom-5 z-10 rounded-2xl border border-line bg-background p-2 shadow-xl">
              <p className="px-3 py-2 text-[13px] font-semibold text-ink">{menu.profile.display_name}</p>
              <button type="button" onClick={() => void menuAction("delete")} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] text-ink hover:bg-muted"><Trash2 className="size-4" /> Delete chat</button>
              <button type="button" onClick={() => void menuAction("unfriend")} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] text-ink hover:bg-muted"><Ban className="size-4" /> Unfriend</button>
              <button type="button" onClick={() => setMenu(null)} className="min-h-11 w-full rounded-xl px-3 text-left text-[14px] text-ink-soft hover:bg-muted">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-2 text-[12.5px] text-ink-soft">{children}</p>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-medium text-ink-soft">{children}</span>;
}
function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-[14px] font-bold text-brand">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
function Row({ p, children }: { p: Profile; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <Avatar name={p.display_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">{p.display_name}</p>
        {p.username && <p className="truncate text-[12px] text-ink-soft">@{p.username}</p>}
      </div>
      {children}
    </div>
  );
}
function time(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ------------------------- Conversation ------------------------- */

type Pending = { tempId: string; file: File; preview: string; caption: string; progress: number; failed: boolean; replyTo: string | null };

function uploadWithProgress(path: string, file: File, token: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/chat-images/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", ANON);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|site|app|dev|ng|uk|me|ai|info|biz|xyz|tech|store|online|edu|gov)(?:\/[^\s<]*)?)/gi;

function findLinks(text: string | null) {
  if (!text) return [] as string[];
  return [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[).,!?]+$/, "")))];
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast.success("Copied");
}

function canEdit(m: Message, me: string) {
  return m.sender_id === me && m.kind === "text" && !m.deleted_at && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;
}

function snippet(m: Message | undefined) {
  if (!m) return "Original message unavailable";
  if (m.deleted_at) return "This message was deleted";
  if (m.kind === "image") return `📷 ${m.body || "Photo"}`;
  return m.body ?? "";
}

function Conversation({
  me,
  cid,
  partner,
  prefs,
  onBack,
  onRead,
}: {
  me: string;
  cid: string;
  partner: Profile;
  prefs: ChatPrefs;
  onBack: (lastRead: string | null) => void | Promise<void>;
  onRead: (upTo: string | null) => Promise<unknown>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ file: File; preview: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [uploads, setUploads] = useState<Pending[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<Message[]>([]);
  msgsRef.current = messages;

  useEffect(() => {
    let live = true;
    const sync = async (active: boolean) => {
      try {
        const result = await syncSharedChatEnergy({ data: { active } });
        if (live) setEnergy(result.energy);
      } catch (error) {
        console.error("Shared Chat Energy sync failed", error);
      }
    };
    const syncVisibility = () => void sync(document.visibilityState === "visible");
    void syncVisibility();
    const timer = window.setInterval(syncVisibility, 10000);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncVisibility);
      // Release this login's active slot immediately; abandoned tabs expire after 30 seconds.
      void syncSharedChatEnergy({ data: { active: false } }).catch(() => {});
    };
  }, []);

  const lastIncoming = useCallback(() => {
    let t: string | null = null;
    for (const m of msgsRef.current) if (m.sender_id !== me && (!t || m.created_at > t)) t = m.created_at;
    return t;
  }, [me]);

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    void onRead(lastIncoming());
  }, [onRead, lastIncoming]);

  useEffect(() => {
    let live = true;
    void Promise.all([
      db.from("chat_messages").select("*").eq("connection_id", cid).order("created_at", { ascending: true }).limit(500),
      db.from("chat_message_hidden").select("message_id"),
    ]).then(([{ data }, { data: hid }]) => {
      if (!live) return;
      setHidden(new Set(((hid ?? []) as { message_id: string }[]).map((h) => h.message_id)));
      msgsRef.current = (data ?? []) as Message[];
      setMessages(msgsRef.current);
      setLoaded(true);
      markRead();
    });
    const ch = db
      .channel(`chat-conv-${cid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `connection_id=eq.${cid}` }, (p) => {
        const m = p.new as Message;
        setMessages((list) => {
          const next = list.some((x) => x.id === m.id) ? list : [...list, m];
          msgsRef.current = next;
          return next;
        });
        if (m.sender_id !== me) markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `connection_id=eq.${cid}` }, (p) => {
        const m = p.new as Message;
        setMessages((list) => list.map((x) => (x.id === m.id ? m : x)));
      })
      .subscribe();
    const onVis = () => markRead();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVis);
      void db.removeChannel(ch);
    };
  }, [cid, me, markRead]);

  const visible = useMemo(() => messages.filter((m) => !hidden.has(m.id)), [messages, hidden]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [visible.length, uploads.length, draft]);

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 130)}px`;
  }, [text]);

  function startReply(m: Message) {
    if (m.deleted_at) return;
    setEditing(null);
    setReplyTo(m);
    navigator.vibrate?.(15);
    taRef.current?.focus();
  }

  function startEdit(m: Message) {
    if (!canEdit(m, me)) {
      toast.error("Messages can only be edited within 15 minutes.");
      return;
    }
    setReplyTo(null);
    setEditing(m);
    setText(m.body ?? "");
    setTimeout(() => taRef.current?.focus(), 0);
  }

  async function sendText() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    if (!editing) {
      try {
        const check = await inspectOutgoingChatMessage({ data: { connectionId: cid, body } });
        if (!check.allowed) {
          setSending(false);
          toast.error(check.message);
          return;
        }
      } catch (e) {
        setSending(false);
        toast.error(e instanceof Error ? e.message : "The message safety check failed. Nothing was sent.");
        return;
      }
    }
    if (editing) {
      const { error } = await db.rpc("edit_chat_message", { _id: editing.id, _body: body });
      setSending(false);
      if (error) {
        toast.error(error.message.includes("no longer") ? "Messages can only be edited within 15 minutes." : "Edit not saved. Try again.");
        return;
      }
      const at = new Date().toISOString();
      setMessages((list) => list.map((x) => (x.id === editing.id ? { ...x, body, edited_at: at } : x)));
      setEditing(null);
      setText("");
      return;
    }
    const { data, error } = await db
      .from("chat_messages")
      .insert({ connection_id: cid, sender_id: me, kind: "text", body, reply_to: replyTo?.id ?? null })
      .select("*")
      .single();
    setSending(false);
    if (error) {
      toast.error("Message not sent. Check your connection and try again.");
      return;
    }
    setText("");
    setReplyTo(null);
    setMessages((list) => (list.some((x) => x.id === (data as Message).id) ? list : [...list, data as Message]));
    taRef.current?.focus();
  }

  async function deleteForMe(m: Message) {
    setMenu(null);
    const { error } = await db.rpc("hide_chat_message", { _id: m.id });
    if (error) return void toast.error("Could not delete. Try again.");
    setHidden((h) => new Set(h).add(m.id));
    if (replyTo?.id === m.id) setReplyTo(null);
    if (editing?.id === m.id) {
      setEditing(null);
      setText("");
    }
  }
  async function deleteForEveryone(m: Message) {
    setMenu(null);
    const { error } = await db.rpc("delete_chat_message_everyone", { _id: m.id });
    if (error) return void toast.error("Could not delete for everyone.");
    const at = new Date().toISOString();
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, body: null, deleted_at: at } : x)));
    if (editing?.id === m.id) {
      setEditing(null);
      setText("");
    }
  }

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    setTimeout(() => setFlash(null), 1200);
  }

  async function runUpload(item: Pending) {
    const { data: s } = await db.auth.getSession();
    const token = s.session?.access_token;
    const update = (patch: Partial<Pending>) => setUploads((u) => u.map((x) => (x.tempId === item.tempId ? { ...x, ...patch } : x)));
    if (!token) return update({ failed: true });
    const ext = (item.file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
    const path = `${cid}/${crypto.randomUUID()}.${ext}`;
    try {
      update({ failed: false, progress: 0 });
      if (item.caption.trim()) {
        const check = await inspectOutgoingChatMessage({ data: { connectionId: cid, body: item.caption } });
        if (!check.allowed) {
          update({ failed: true });
          toast.error(check.message);
          return;
        }
      }
      await uploadWithProgress(path, item.file, token, (p) => update({ progress: p }));
      const { data, error } = await db
        .from("chat_messages")
        .insert({ connection_id: cid, sender_id: me, kind: "image", image_path: path, body: item.caption || null, reply_to: item.replyTo })
        .select("*")
        .single();
      if (error) throw error;
      urlCache.set(path, item.preview);
      setUploads((u) => u.filter((x) => x.tempId !== item.tempId));
      setMessages((list) => (list.some((x) => x.id === (data as Message).id) ? list : [...list, data as Message]));
    } catch {
      update({ failed: true });
    }
  }

  function sendImage() {
    if (!draft) return;
    const item: Pending = { tempId: crypto.randomUUID(), file: draft.file, preview: draft.preview, caption: caption.trim(), progress: 0, failed: false, replyTo: replyTo?.id ?? null };
    setUploads((u) => [...u, item]);
    setDraft(null);
    setCaption("");
    setReplyTo(null);
    void runUpload(item);
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error("Only images can be sent.");
    if (f.size > 10 * 1024 * 1024) return void toast.error("Images must be under 10 MB.");
    setEditing(null);
    setDraft({ file: f, preview: URL.createObjectURL(f) });
  }

  async function back() {
    if (leaving) return;
    setLeaving(true);
    await onBack(lastIncoming());
  }

  const bar = editing
    ? { label: "Editing message", text: editing.body ?? "", close: () => { setEditing(null); setText(""); } }
    : replyTo
      ? { label: `Replying to ${replyTo.sender_id === me ? "yourself" : partner.display_name}`, text: snippet(replyTo), close: () => setReplyTo(null) }
      : null;

  return (
    <>
      <Header title={partner.display_name} sub={partner.username ? `@${partner.username} · Connected` : "Connected"} onBack={() => void back()} />
      <div className="border-b border-line bg-background px-3 py-1.5" aria-label={energy == null ? "Chat energy synchronizing" : `Chat energy ${Math.round(energy)} percent`}>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${energy ?? 0}%` }} /></div>
        <p className="mt-1 text-[10px] text-ink-soft">Chat energy · {energy == null ? "Syncing…" : `${Math.round(energy)}%`}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/40">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-1 px-3 py-3">
          {loaded && visible.length === 0 && uploads.length === 0 && (
            <p className="py-8 text-center text-[12.5px] text-ink-soft">You're connected. Say hello to {partner.display_name}.</p>
          )}
          {visible.map((m) => (
            <Bubble
              key={m.id}
              m={m}
              mine={m.sender_id === me}
              me={me}
              partnerName={partner.display_name}
              quoted={m.reply_to ? byId.get(m.reply_to) : undefined}
              flash={flash === m.id}
              links={prefs.links}
              onOpen={setViewer}
              onMenu={() => setMenu(m)}
              onReply={() => startReply(m)}
              onJump={jumpTo}
            />
          ))}
          {uploads.map((u) => (
            <div key={u.tempId} className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-brand p-1 text-primary-foreground">
              <div className="relative">
                <img src={u.preview} alt="" className="max-h-48 w-48 rounded-xl object-cover opacity-70" />
                <div className="absolute inset-0 grid place-items-center">
                  {u.failed ? (
                    <button type="button" onClick={() => void runUpload(u)} className="flex items-center gap-1 rounded-full bg-background px-3 py-1.5 text-[12px] font-semibold text-brand">
                      <RotateCw className="size-3.5" /> Retry
                    </button>
                  ) : (
                    <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11.5px] font-semibold text-ink">{Math.round(u.progress * 100)}%</span>
                  )}
                </div>
              </div>
              {u.failed && <p className="px-2 py-1 text-[11.5px]">Upload failed — not sent</p>}
              {!u.failed && <div className="mx-1 my-1 h-1 overflow-hidden rounded-full bg-primary-foreground/30"><div className="h-full bg-primary-foreground transition-all" style={{ width: `${u.progress * 100}%` }} /></div>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-background px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        <div className="mx-auto w-full max-w-xl">
          {bar && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-brand bg-muted px-3 py-1.5">
              {editing ? <Pencil className="size-4 shrink-0 text-brand" /> : <Reply className="size-4 shrink-0 text-brand" />}
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-brand">{bar.label}</p>
                <p className="truncate text-[12.5px] text-ink-soft">{bar.text}</p>
              </div>
              <button type="button" aria-label="Cancel" onClick={bar.close} className="grid size-7 place-items-center rounded-full hover:bg-background"><X className="size-4 text-ink-soft" /></button>
            </div>
          )}
          {draft && (
            <div className="mb-2 flex gap-2 rounded-xl border border-line p-2">
              <img src={draft.preview} alt="Selected" className="size-20 shrink-0 rounded-lg object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink">Image preview</span>
                  <button type="button" aria-label="Remove image" onClick={() => setDraft(null)} className="grid size-6 place-items-center rounded-full hover:bg-muted"><X className="size-4 text-ink-soft" /></button>
                </div>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} placeholder="Add a caption (optional)" className="w-full rounded-lg border border-line bg-background px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand" />
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            {!editing && (
              <button type="button" aria-label="Add image" onClick={() => fileRef.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-muted">
                <ImagePlus className="size-5" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
            {!draft && (
              <textarea
                ref={taRef}
                value={text}
                rows={1}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && bar) bar.close();
                  if (prefs.enterToSend && e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                    e.preventDefault();
                    void sendText();
                  }
                }}
                placeholder={editing ? "Edit message" : "Message"}
                className="max-h-[130px] min-h-[40px] w-full min-w-0 resize-none rounded-2xl border border-line bg-background px-3.5 py-2 text-[14.5px] leading-snug text-ink outline-none focus:border-brand"
              />
            )}
            {draft && <div className="flex-1" />}
            <button
              type="button"
              aria-label={editing ? "Save edit" : "Send"}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => (draft ? sendImage() : void sendText())}
              disabled={draft ? false : !text.trim() || sending}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground disabled:opacity-40"
            >
              {editing ? <Check className="size-4" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {menu && (
        <ActionSheet
          m={menu}
          me={me}
          onClose={() => setMenu(null)}
          onReply={() => {
            const m = menu;
            setMenu(null);
            startReply(m);
          }}
          onEdit={() => {
            const m = menu;
            setMenu(null);
            startEdit(m);
          }}
          onDeleteMe={() => void deleteForMe(menu)}
          onDeleteAll={() => void deleteForEveryone(menu)}
        />
      )}

      {viewer && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-ink/95" onClick={() => setViewer(null)}>
          <div className="flex justify-end p-3">
            <button type="button" aria-label="Close image" className="grid size-10 place-items-center rounded-full bg-background/15 text-background">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            <img src={viewer} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

function ActionSheet({
  m,
  me,
  onClose,
  onReply,
  onEdit,
  onDeleteMe,
  onDeleteAll,
}: {
  m: Message;
  me: string;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDeleteMe: () => void;
  onDeleteAll: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const links = m.deleted_at ? [] : findLinks(m.body);
  const editable = canEdit(m, me);
  const mine = m.sender_id === me;
  const left = Math.max(0, Math.ceil((EDIT_WINDOW_MS - (Date.now() - new Date(m.created_at).getTime())) / 60000));
  const Item = ({ icon, label, sub, onClick, danger }: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void; danger?: boolean }) => (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted ${danger ? "text-destructive" : "text-ink"}`}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{label}</span>
        {sub && <span className="block truncate text-[11.5px] text-ink-soft">{sub}</span>}
      </span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div role="menu" aria-label="Message actions" className="w-full max-w-md overflow-hidden rounded-t-2xl bg-background pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto my-2 h-1 w-10 rounded-full bg-line" />
        {m.body && !m.deleted_at && <p className="line-clamp-2 border-b border-line px-4 pb-2 text-[12.5px] text-ink-soft">{m.body}</p>}
        {!confirm ? (
          <>
            {!m.deleted_at && <Item icon={<Reply className="size-4" />} label="Reply" onClick={onReply} />}
            {m.body && !m.deleted_at && (
              <Item icon={<Copy className="size-4" />} label="Copy text" onClick={() => { void copyText(m.body!); onClose(); }} />
            )}
            {links.map((l) => (
              <Item key={l} icon={<Link2 className="size-4" />} label="Copy link" sub={l} onClick={() => { void copyText(l); onClose(); }} />
            ))}
            {mine && m.kind === "text" && !m.deleted_at && (
              editable ? (
                <Item icon={<Pencil className="size-4" />} label="Edit" sub={`Available for ${left} more min`} onClick={onEdit} />
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 text-ink-soft opacity-60">
                  <Pencil className="size-4" />
                  <span className="text-[13px]">Edit unavailable — 15 minutes have passed</span>
                </div>
              )
            )}
            <Item icon={<Trash2 className="size-4" />} label="Delete" danger onClick={() => setConfirm(true)} />
          </>
        ) : (
          <>
            <p className="px-4 pb-1 pt-1 text-[13px] font-semibold text-ink">Delete message?</p>
            <Item icon={<Trash2 className="size-4" />} label="Delete for me" sub="Removed only from your chat" danger onClick={onDeleteMe} />
            {mine && !m.deleted_at && (
              <Item icon={<Trash2 className="size-4" />} label="Delete for everyone" sub="Removed for both of you" danger onClick={onDeleteAll} />
            )}
            <Item icon={<X className="size-4" />} label="Cancel" onClick={() => setConfirm(false)} />
          </>
        )}
      </div>
    </div>
  );
}

function Linkified({ text, enabled, mine }: { text: string; enabled: boolean; mine: boolean }) {
  if (!enabled) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0].replace(/[).,!?]+$/, "");
    const i = match.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    parts.push(
      <a key={i} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`underline underline-offset-2 ${mine ? "" : "text-brand"}`}>
        {raw}
      </a>,
    );
    last = i + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Bubble({
  m,
  mine,
  me,
  partnerName,
  quoted,
  flash,
  links,
  onOpen,
  onMenu,
  onReply,
  onJump,
}: {
  m: Message;
  mine: boolean;
  me: string;
  partnerName: string;
  quoted: Message | undefined;
  flash: boolean;
  links: boolean;
  onOpen: (url: string) => void;
  onMenu: () => void;
  onReply: () => void;
  onJump: (id: string) => void;
}) {
  const url = useSignedUrl(m.kind === "image" && !m.deleted_at ? m.image_path : null);
  const t = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const status = m.read_at ? "read" : m.delivered_at ? "delivered" : "sent";
  const [dx, setDx] = useState(0);
  const [visibleBodyLength, setVisibleBodyLength] = useState(1800);
  const g = useRef<{ x: number; y: number; timer: number | null; swiping: boolean; long: boolean; id: number } | null>(null);

  function down(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const timer = window.setTimeout(() => {
      if (!g.current || g.current.swiping) return;
      g.current.long = true;
      navigator.vibrate?.(20);
      onMenu();
    }, 480);
    g.current = { x: e.clientX, y: e.clientY, timer, swiping: false, long: false, id: e.pointerId };
  }
  function move(e: React.PointerEvent) {
    const s = g.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!s.swiping && Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.5 && !m.deleted_at) {
      s.swiping = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) {
      if (s.timer) window.clearTimeout(s.timer);
      s.timer = null;
    }
    if (s.swiping) setDx(Math.max(-80, Math.min(80, ddx)));
  }
  function end() {
    const s = g.current;
    g.current = null;
    if (!s) return;
    if (s.timer) window.clearTimeout(s.timer);
    if (s.swiping && Math.abs(dx) >= 56) onReply();
    setDx(0);
  }

  return (
    <div id={`msg-${m.id}`} className={`relative flex ${mine ? "justify-end" : "justify-start"}`}>
      {dx !== 0 && (
        <span className={`absolute top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-background text-brand shadow ${dx > 0 ? "left-1" : "right-1"}`} style={{ opacity: Math.min(1, Math.abs(dx) / 56) }}>
          <Reply className="size-4" />
        </span>
      )}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 180ms ease-out", touchAction: "pan-y", WebkitTouchCallout: "none" }}
        className={`max-w-[78%] select-none overflow-hidden rounded-2xl ${m.kind === "image" && !m.deleted_at ? "p-1" : "px-3 py-1.5"} ${
          mine ? "rounded-br-md bg-brand text-primary-foreground" : "rounded-bl-md border border-line bg-background text-ink"
        } ${flash ? "ring-4 ring-brand/40" : ""}`}
      >
        {m.reply_to && !m.deleted_at && (
          <button
            type="button"
            onClick={() => quoted && onJump(quoted.id)}
            className={`mb-1 block w-full rounded-lg border-l-4 px-2 py-1 text-left ${m.kind === "image" ? "mx-1 mt-1 w-[calc(100%-0.5rem)]" : ""} ${
              mine ? "border-primary-foreground/70 bg-primary-foreground/15" : "border-brand bg-muted"
            }`}
          >
            <span className={`block text-[11px] font-semibold ${mine ? "" : "text-brand"}`}>
              {quoted ? (quoted.sender_id === me ? "You" : partnerName) : "Reply"}
            </span>
            <span className={`block truncate text-[12px] ${mine ? "text-primary-foreground/80" : "text-ink-soft"}`}>{snippet(quoted)}</span>
          </button>
        )}
        {m.deleted_at ? (
          <p className={`flex items-center gap-1.5 text-[13.5px] italic ${mine ? "text-primary-foreground/80" : "text-ink-soft"}`}>
            <Ban className="size-3.5" /> This message was deleted
          </p>
        ) : (
          <>
            {m.kind === "image" && (
              <button type="button" onClick={() => url && onOpen(url)} className="block">
                {url ? (
                  <img src={url} alt={m.body ?? "Photo"} draggable={false} className="max-h-48 w-48 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-32 w-48 place-items-center rounded-xl bg-muted"><Loader2 className="size-4 animate-spin text-ink-soft" /></span>
                )}
              </button>
            )}
            {m.body && (
              <>
                <p className={`whitespace-pre-wrap break-words text-[14px] leading-snug ${m.kind === "image" ? "px-2 pt-1" : ""}`}>
                  <Linkified text={m.body.slice(0, visibleBodyLength)} enabled={links} mine={mine} />
                  {m.body.length > visibleBodyLength && <span aria-hidden="true">…</span>}
                </p>
                {m.body.length > visibleBodyLength && <button type="button" onClick={() => setVisibleBodyLength(length => length + 1800)} className={`mt-1 rounded-full px-2 py-1 text-[11px] font-bold underline underline-offset-2 ${mine ? "text-primary-foreground" : "text-brand"}`}>Show more ({Math.min(1800, m.body.length - visibleBodyLength).toLocaleString()} characters)</button>}
                {visibleBodyLength > 1800 && m.body.length <= visibleBodyLength && <button type="button" onClick={() => setVisibleBodyLength(1800)} className={`mt-1 block px-2 py-1 text-[11px] font-semibold underline underline-offset-2 ${mine ? "text-primary-foreground/80" : "text-brand"}`}>Collapse message</button>}
              </>
            )}
          </>
        )}
        <div className={`flex items-center justify-end gap-1 text-[10.5px] ${m.kind === "image" && !m.deleted_at ? "px-2 pb-0.5" : ""} ${mine ? "text-primary-foreground/75" : "text-ink-soft"}`}>
          {m.edited_at && !m.deleted_at && <span>edited ·</span>}
          <span>{t}</span>
          {mine && (
            <span title={status} aria-label={status}>
              {status === "sent" ? <Check className="size-3.5" /> : <CheckCheck className={`size-3.5 ${status === "read" ? "text-sky-300" : ""}`} />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
