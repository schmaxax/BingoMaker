"use client";

import { useEffect, useSyncExternalStore } from "react";
import { dbVersion, getSessionUserId, subscribeDb } from "./db";
import * as actions from "./actions";
import type { BoardSummary, SessionUser } from "../types";

type Snapshot = {
  version: number;
  sessionId: string | null;
  user: SessionUser | null;
  boards: BoardSummary[];
  accounts: SessionUser[];
};

let cache: Snapshot | null = null;

function getSnapshot(): Snapshot {
  const version = dbVersion;
  const sessionId = getSessionUserId();
  if (cache && cache.version === version && cache.sessionId === sessionId) return cache;
  cache = {
    version,
    sessionId,
    user: actions.currentUser(),
    boards: actions.listBoards(),
    accounts: actions.listAccounts(),
  };
  return cache;
}

const serverSnapshot: Snapshot = {
  version: 0,
  sessionId: null,
  user: null,
  boards: [],
  accounts: [],
};

export function useBingoStore() {
  const snapshot = useSyncExternalStore(subscribeDb, getSnapshot, () => serverSnapshot);
  useEffect(() => {
    actions.persistDeadlineReveals();
  }, [snapshot.version]);
  return { ...snapshot, actions };
}
