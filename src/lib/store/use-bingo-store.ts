"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { isSupabaseConfigured } from "../supabase/client";
import { getSupabase } from "../supabase/client";
import { subscribeDb } from "./db";
import * as actions from "./actions";
import type { BoardDetail, BoardSummary, SessionUser } from "../types";

type Snapshot = {
  version: number;
  ready: boolean;
  user: SessionUser | null;
  boards: BoardSummary[];
  accounts: SessionUser[];
  boardCache: Record<string, BoardDetail>;
  boardErrors: Record<string, string>;
  backend: "supabase" | "local";
};

let state: Snapshot = {
  version: 0,
  ready: false,
  user: null,
  boards: [],
  accounts: [],
  boardCache: {},
  boardErrors: {},
  backend: isSupabaseConfigured() ? "supabase" : "local",
};

const listeners = new Set<() => void>();
let refreshPromise: Promise<void> | null = null;

function emit() {
  state = { ...state, version: state.version + 1 };
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const unsubLocal = subscribeDb(() => {
    if (!isSupabaseConfigured()) void refresh();
  });
  return () => {
    listeners.delete(listener);
    unsubLocal();
  };
}

async function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const [user, boards, accounts] = await Promise.all([
        actions.currentUser(),
        actions.listBoards(),
        actions.listAccounts(),
      ]);
      state = {
        ...state,
        ready: true,
        user,
        boards,
        accounts,
        backend: isSupabaseConfigured() ? "supabase" : "local",
      };
      emit();
      if (user) {
        try {
          await actions.persistDeadlineReveals();
        } catch {
          // ignore deadline sync errors
        }
      }
    } catch {
      state = {
        ...state,
        ready: true,
        user: null,
        boards: [],
        accounts: [],
      };
      emit();
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function loadBoard(boardId: string) {
  try {
    const detail = await actions.getBoard(boardId);
    state = {
      ...state,
      boardCache: { ...state.boardCache, [boardId]: detail },
      boardErrors: { ...state.boardErrors, [boardId]: "" },
    };
    emit();
    return detail;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Board nicht gefunden.";
    state = {
      ...state,
      boardErrors: { ...state.boardErrors, [boardId]: message },
    };
    emit();
    throw error;
  }
}

async function runAndRefresh<T>(fn: () => Promise<T>, boardId?: string): Promise<T> {
  const result = await fn();
  await refresh();
  if (boardId) await loadBoard(boardId);
  return result;
}

const storeActions = {
  ...actions,
  refresh,
  loadBoard,
  async signUp(displayName: string, email: string, password: string) {
    const user = await actions.signUp(displayName, email, password);
    await refresh();
    return user;
  },
  async signIn(email: string, password: string) {
    const user = await actions.signIn(email, password);
    await refresh();
    return user;
  },
  async consumeMagicLink(token: string) {
    const user = await actions.consumeMagicLink(token);
    await refresh();
    return user;
  },
  async signOut() {
    await actions.signOut();
    state = { ...state, user: null, boards: [], accounts: [], boardCache: {}, boardErrors: {} };
    emit();
  },
  async createBoard(input: Parameters<typeof actions.createBoard>[0]) {
    return runAndRefresh(() => actions.createBoard(input));
  },
  async joinBoard(code: string) {
    return runAndRefresh(() => actions.joinBoard(code));
  },
  async updateBoard(boardId: string, patch: Parameters<typeof actions.updateBoard>[1]) {
    return runAndRefresh(() => actions.updateBoard(boardId, patch), boardId);
  },
  async rotateInviteCode(boardId: string) {
    return runAndRefresh(() => actions.rotateInviteCode(boardId), boardId);
  },
  async updateCell(boardId: string, cellId: string, title: string, description: string) {
    return runAndRefresh(() => actions.updateCell(boardId, cellId, title, description), boardId);
  },
  async upsertProgress(
    boardId: string,
    cellId: string,
    patch: Parameters<typeof actions.upsertProgress>[2],
  ) {
    return runAndRefresh(() => actions.upsertProgress(boardId, cellId, patch), boardId);
  },
  async voteReveal(boardId: string) {
    return runAndRefresh(() => actions.voteReveal(boardId), boardId);
  },
  async ownerReveal(boardId: string) {
    return runAndRefresh(() => actions.ownerReveal(boardId), boardId);
  },
  async stepReveal(boardId: string, delta: number) {
    return runAndRefresh(() => actions.stepReveal(boardId, delta), boardId);
  },
  async restartReveal(boardId: string) {
    return runAndRefresh(() => actions.restartReveal(boardId), boardId);
  },
  async startRevealIfNeeded(boardId: string) {
    return runAndRefresh(() => actions.startRevealIfNeeded(boardId), boardId);
  },
  async toggleRevealDownvote(boardId: string, cellId: string, targetUserId: string) {
    return runAndRefresh(() => actions.toggleRevealDownvote(boardId, cellId, targetUserId), boardId);
  },
  async archiveBoard(boardId: string) {
    return runAndRefresh(() => actions.archiveBoard(boardId));
  },
  async deleteBoard(boardId: string) {
    return runAndRefresh(() => actions.deleteBoard(boardId));
  },
  async updateProfile(displayName: string, avatarPixels: string[]) {
    return runAndRefresh(() => actions.updateProfile(displayName, avatarPixels));
  },
  async switchAccount(userId: string) {
    await actions.switchAccount(userId);
    await refresh();
  },
};

function getSnapshot() {
  return state;
}

const serverSnapshot: Snapshot = {
  version: 0,
  ready: false,
  user: null,
  boards: [],
  accounts: [],
  boardCache: {},
  boardErrors: {},
  backend: "local",
};

export function useBingoStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { ...snapshot, actions: storeActions };
}

export function useBoardDetail(boardId: string) {
  const { boardCache, boardErrors, actions, ready, version } = useBingoStore();
  void version;

  useEffect(() => {
    if (!ready || !boardId) return;
    void actions.loadBoard(boardId).catch(() => undefined);
  }, [ready, boardId, actions]);

  const detail = boardCache[boardId] ?? null;
  const error = boardErrors[boardId] || "";
  const loading = ready && !detail && !error;

  const reload = useCallback(() => actions.loadBoard(boardId), [actions, boardId]);

  return useMemo(() => ({ detail, error, loading: !ready || loading, reload, actions }), [
    detail,
    error,
    ready,
    loading,
    reload,
    actions,
  ]);
}
