const DB_KEY = "bingo-maker.db.v1";
const SESSION_KEY = "bingo-maker.session";
const CHANNEL = "bingo-maker-sync";

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  avatarPixels?: string[];
  passwordHash: string;
  salt: string;
  createdAt: string;
};

export type MagicToken = {
  token: string;
  email: string;
  expiresAt: number;
};

export type Database = {
  users: UserRecord[];
  boards: import("../types").Board[];
  members: import("../types").Member[];
  cells: import("../types").Cell[];
  progress: import("../types").Progress[];
  revealVotes: import("../types").RevealVote[];
  revealSessions: import("../types").RevealSession[];
  revealDownvotes: import("../types").RevealDownvote[];
  bingoEvents: import("../types").BingoEvent[];
  notices: import("../types").BoardNotice[];
  magicTokens: MagicToken[];
};

function emptyDb(): Database {
  return {
    users: [],
    boards: [],
    members: [],
    cells: [],
    progress: [],
    revealVotes: [],
    revealSessions: [],
    revealDownvotes: [],
    bingoEvents: [],
    notices: [],
    magicTokens: [],
  };
}

let memory = emptyDb();
let loaded = false;
export let dbVersion = 0;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadDb(): Database {
  if (!canUseStorage()) return memory;
  if (!loaded) {
    try {
      const raw = localStorage.getItem(DB_KEY);
      memory = raw ? { ...emptyDb(), ...(JSON.parse(raw) as Database) } : emptyDb();
    } catch {
      memory = emptyDb();
    }
    loaded = true;
  }
  memory.revealSessions ??= [];
  memory.revealDownvotes ??= [];
  return memory;
}

export function saveDb(next: Database) {
  memory = next;
  loaded = true;
  dbVersion += 1;
  if (canUseStorage()) {
    localStorage.setItem(DB_KEY, JSON.stringify(next));
  }
}

export function getSessionUserId(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionUserId(userId: string | null) {
  if (!canUseStorage()) return;
  const current = localStorage.getItem(SESSION_KEY);
  if (userId === current || (!userId && !current)) return;
  if (userId) localStorage.setItem(SESSION_KEY, userId);
  else localStorage.removeItem(SESSION_KEY);
  dbVersion += 1;
  emitDb();
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

export function subscribeDb(listener: () => void) {
  listeners.add(listener);
  if (canUseStorage() && !channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      loaded = false;
      loadDb();
      dbVersion += 1;
      listeners.forEach((fn) => fn());
    };
    window.addEventListener("storage", (event) => {
      if (event.key === DB_KEY || event.key === SESSION_KEY) {
        loaded = false;
        loadDb();
        dbVersion += 1;
        listeners.forEach((fn) => fn());
      }
    });
  }
  return () => listeners.delete(listener);
}

export function emitDb() {
  listeners.forEach((fn) => fn());
  channel?.postMessage({ t: Date.now() });
}

export function mutateDb(mutator: (db: Database) => Database | void) {
  const current = structuredClone(loadDb());
  const next = mutator(current) ?? current;
  saveDb(next);
  emitDb();
  return next;
}
