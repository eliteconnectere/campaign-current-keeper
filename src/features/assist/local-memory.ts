/**
 * Rex's private, device-local memory.
 *
 * Conversation history, memory preferences, and user-approved memory entries
 * live in IndexedDB on this device only. This module has no Supabase imports,
 * no expiry policy, and no automatic deletion or cleanup.
 */
export type RexMemorySettings = { saveHistory: boolean; rememberContext: boolean };
export type RexConfig = {
  displayName: string;
  personality: "balanced" | "professional" | "friendly" | "direct";
  autonomousMode: boolean;
  campaignMonitoring: boolean;
  allowCampaignExecution: boolean;
  allowCampaignScheduling: boolean;
  preSendReview: boolean;
  warnOnRisk: boolean;
  requireApproval: boolean;
  monitorDelivery: boolean;
  notifyHighRisk: boolean;
  notifyCampaignIssues: boolean;
  notifyRecommendations: boolean;
};
export const DEFAULT_REX_CONFIG: RexConfig = {
  displayName: "Rex", personality: "friendly", autonomousMode: true,
  campaignMonitoring: true, allowCampaignExecution: true, allowCampaignScheduling: true,
  preSendReview: true, warnOnRisk: true, requireApproval: false,
  monitorDelivery: true, notifyHighRisk: true, notifyCampaignIssues: true,
  notifyRecommendations: false,
};
function validateRexConfig(input: Partial<RexConfig> = {}): RexConfig {
  const name = String(input.displayName ?? "Rex").trim().replace(/[<>]/g, "").slice(0, 24) || "Rex";
  const personalities = ["balanced", "professional", "friendly", "direct"];
  return {
    displayName: name,
    personality: personalities.includes(String(input.personality)) ? input.personality as RexConfig["personality"] : "friendly",
    autonomousMode: input.autonomousMode !== false,
    campaignMonitoring: input.campaignMonitoring !== false,
    allowCampaignExecution: input.allowCampaignExecution !== false,
    allowCampaignScheduling: input.allowCampaignScheduling !== false,
    preSendReview: input.preSendReview !== false,
    warnOnRisk: input.warnOnRisk !== false,
    requireApproval: false,
    monitorDelivery: input.monitorDelivery !== false,
    notifyHighRisk: input.notifyHighRisk !== false,
    notifyCampaignIssues: input.notifyCampaignIssues !== false,
    notifyRecommendations: input.notifyRecommendations === true,
  };
}
export type RexConversation = {
  id: string;
  title: string;
  updated_at: string;
  last_message_at: string;
  created_at: string;
};
export type RexStoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
type StoredConversation = RexConversation & {
  userId: string;
  messages: RexStoredMessage[];
};
export type RexLocalMemoryEntry = {
  id: string;
  userId: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
};

const DB_NAME = "elite-connectere-rex-local-memory";
const DB_VERSION = 2;
const CONVERSATIONS = "conversations";
const SETTINGS = "settings";
const REX_CONFIG = "rexConfig";
const ENTRIES = "memoryEntries";
const DEFAULT_SETTINGS: RexMemorySettings = { saveHistory: true, rememberContext: true };

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "rex-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

function openMemoryDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("This browser does not support persistent local memory."));
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONVERSATIONS)) db.createObjectStore(CONVERSATIONS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: "userId" });
      if (!db.objectStoreNames.contains(REX_CONFIG)) db.createObjectStore(REX_CONFIG, { keyPath: "userId" });
      if (!db.objectStoreNames.contains(ENTRIES)) db.createObjectStore(ENTRIES, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      // Ask the browser to protect this origin's data from routine storage eviction.
      // This is a best-effort browser request, not a guarantee against user-cleared data.
      try {
        const storage = navigator.storage as StorageManager & { persist?: () => Promise<boolean> };
        if (typeof storage?.persist === "function") void storage.persist().catch(() => false);
      } catch { /* Persistent-storage permission is browser controlled. */ }
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open Rex local memory."));
    request.onblocked = () => reject(new Error("Rex local memory is busy in another app tab. Close the other tab and retry."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local memory request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local memory transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local memory transaction was interrupted."));
  });
}

export async function getLocalRexMemorySettings(userId: string): Promise<{ settings: RexMemorySettings }> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(SETTINGS, "readonly");
    const done = transactionDone(tx);
    const row = await requestValue<any>(tx.objectStore(SETTINGS).get(userId));
    await done;
    return { settings: row ? { saveHistory: row.saveHistory !== false, rememberContext: row.rememberContext !== false } : { ...DEFAULT_SETTINGS } };
  } finally { db.close(); }
}

export async function getLocalRexConfig(userId: string): Promise<{ config: RexConfig }> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(REX_CONFIG, "readonly");
    const done = transactionDone(tx);
    const row = await requestValue<any>(tx.objectStore(REX_CONFIG).get(userId));
    await done;
    return { config: validateRexConfig(row?.config ?? {}) };
  } finally { db.close(); }
}

export async function saveLocalRexConfig(userId: string, config: Partial<RexConfig>): Promise<{ config: RexConfig; savedAt: string }> {
  const normalized = validateRexConfig(config);
  const savedAt = new Date().toISOString();
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(REX_CONFIG, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(REX_CONFIG).put({ userId, config: normalized, updated_at: savedAt });
    await done;
    return { config: normalized, savedAt };
  } finally { db.close(); }
}

export async function saveLocalRexMemorySettings(userId: string, settings: RexMemorySettings): Promise<{ settings: RexMemorySettings }> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(SETTINGS, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(SETTINGS).put({ userId, saveHistory: settings.saveHistory, rememberContext: settings.rememberContext, updated_at: new Date().toISOString() });
    await done;
    return { settings };
  } finally { db.close(); }
}

export async function listLocalRexConversations(userId: string): Promise<{ conversations: RexConversation[] }> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(CONVERSATIONS, "readonly");
    const done = transactionDone(tx);
    const rows = await requestValue<StoredConversation[]>(tx.objectStore(CONVERSATIONS).getAll());
    await done;
    const conversations = rows
      .filter(row => row.userId === userId)
      .map(({ id, title, updated_at, last_message_at, created_at }) => ({ id, title, updated_at, last_message_at, created_at }))
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
    return { conversations };
  } finally { db.close(); }
}

export async function deleteLocalRexConversation(userId: string, conversationId: string): Promise<void> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(CONVERSATIONS, "readwrite");
    const store = tx.objectStore(CONVERSATIONS);
    const done = transactionDone(tx);
    const row = await requestValue<StoredConversation | undefined>(store.get(conversationId));
    if (row?.userId === userId) store.delete(conversationId);
    await done;
  } finally { db.close(); }
}

export async function getLocalRexConversation(userId: string, conversationId: string): Promise<{ conversation: RexConversation | null; messages: RexStoredMessage[] }> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(CONVERSATIONS, "readonly");
    const done = transactionDone(tx);
    const row = await requestValue<StoredConversation | undefined>(tx.objectStore(CONVERSATIONS).get(conversationId));
    await done;
    if (!row || row.userId !== userId) return { conversation: null, messages: [] };
    const { id, title, updated_at, last_message_at, created_at, messages } = row;
    return { conversation: { id, title, updated_at, last_message_at, created_at }, messages: Array.isArray(messages) ? messages : [] };
  } finally { db.close(); }
}

export async function appendLocalRexConversationMessages(
  userId: string,
  conversationId: string | null,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ conversationId: string | null; stored: number }> {
  const clean = messages
    .filter(message => (message.role === "user" || message.role === "assistant") && String(message.content ?? "").trim())
    .map(message => ({ role: message.role, content: String(message.content).slice(0, 8000) }));
  if (!clean.length) return { conversationId, stored: 0 };
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(CONVERSATIONS, "readwrite");
    const store = tx.objectStore(CONVERSATIONS);
    const now = new Date().toISOString();
    const id = conversationId || makeId();
    const done = transactionDone(tx);
    void done.catch(() => undefined);
    const read = store.get(id);
    const result = await new Promise<StoredConversation>((resolve, reject) => {
      read.onsuccess = () => {
        const existing = read.result as StoredConversation | undefined;
        if (existing && existing.userId !== userId) { reject(new Error("This local conversation belongs to another account.")); return; }
        const firstUser = clean.find(message => message.role === "user");
        const row: StoredConversation = existing ?? {
          id, userId, title: (firstUser?.content.slice(0, 60) || "Conversation with Rex"),
          created_at: now, updated_at: now, last_message_at: now, messages: [],
        };
        row.messages = [...(Array.isArray(row.messages) ? row.messages : []), ...clean.map(message => ({
          id: makeId(), role: message.role, content: message.content, created_at: now,
        }))];
        row.updated_at = now;
        row.last_message_at = now;
        if ((!row.title || row.title === "Conversation with Rex") && firstUser) row.title = firstUser.content.slice(0, 60);
        store.put(row);
        resolve(row);
      };
      read.onerror = () => reject(read.error ?? new Error("Could not read the local conversation."));
    });
    await done;
    return { conversationId: result.id, stored: clean.length };
  } catch (error) {
    throw error;
  } finally { db.close(); }
}


export async function saveLocalRexMemoryEntry(userId: string, category: string, content: string): Promise<RexLocalMemoryEntry> {
  const cleanContent = String(content ?? "").trim().slice(0, 4000);
  if (!cleanContent) throw new Error("Memory content cannot be empty.");
  const now = new Date().toISOString();
  const entry: RexLocalMemoryEntry = {
    id: makeId(), userId, category: String(category || "context").slice(0, 60),
    content: cleanContent, created_at: now, updated_at: now,
  };
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(ENTRIES, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(ENTRIES).add(entry);
    await done;
    return entry;
  } finally { db.close(); }
}

export async function deleteLocalRexMemoryEntry(userId: string, memoryId: string): Promise<void> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(ENTRIES, "readwrite");
    const store = tx.objectStore(ENTRIES);
    const done = transactionDone(tx);
    const row = await requestValue<RexLocalMemoryEntry | undefined>(store.get(memoryId));
    if (row?.userId === userId) store.delete(memoryId);
    await done;
  } finally { db.close(); }
}

/** Build a bounded context from local memories and previous chats for Rex's next turn. */
export async function buildLocalRexMemoryContext(userId: string, currentConversationId: string | null, maxChars = 8000): Promise<string> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction([CONVERSATIONS, ENTRIES], "readonly");
    const done = transactionDone(tx);
    const [conversationRows, entryRows] = await Promise.all([
      requestValue<StoredConversation[]>(tx.objectStore(CONVERSATIONS).getAll()),
      requestValue<RexLocalMemoryEntry[]>(tx.objectStore(ENTRIES).getAll()),
    ]);
    await done;
    const parts: string[] = [];
    for (const entry of entryRows.filter(row => row.userId === userId).sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
      parts.push("[Saved memory: " + entry.category + "] " + entry.content);
    }
    const conversations = conversationRows
      .filter(row => row.userId === userId && row.id !== currentConversationId)
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
      .slice(0, 8);
    for (const conversation of conversations) {
      const recent = (conversation.messages ?? []).slice(-8);
      if (!recent.length) continue;
      parts.push("[Previous conversation: " + conversation.title + "]");
      for (const message of recent) parts.push((message.role === "user" ? "User: " : "Rex: ") + message.content.slice(0, 1200));
    }
    return parts.join("\n").slice(-maxChars);
  } finally { db.close(); }
}
