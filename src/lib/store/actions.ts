import { findBingoLines, inviteCode, majorityNeeded } from "../bingo";
import { emptyAvatar, normalizeAvatar } from "../avatar";
import type {
  Board,
  BoardDetail,
  BoardSummary,
  CreateBoardInput,
  Progress,
  SessionUser,
  UpdateBoardInput,
} from "../types";
import {
  getSessionUserId,
  hashPassword,
  loadDb,
  mutateDb,
  newId,
  nowIso,
  setSessionUserId,
  type Database,
} from "./db";

function emailKey(email: string) {
  return email.trim().toLowerCase();
}

function toSession(user: { id: string; email: string; displayName: string; avatarPixels?: string[] }): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarPixels: normalizeAvatar(user.avatarPixels),
  };
}

function requireUser(db: Database): SessionUser {
  const userId = getSessionUserId();
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw new Error("Bitte zuerst anmelden.");
  return toSession(user);
}

function profileOf(db: Database, userId: string) {
  const user = db.users.find((item) => item.id === userId);
  return {
    id: userId,
    displayName: user?.displayName ?? "Unbekannt",
    email: user?.email ?? "",
    avatarPixels: normalizeAvatar(user?.avatarPixels),
  };
}

function applyDeadline(board: Board): Board {
  if (
    board.revealEnabled &&
    board.status === "active" &&
    board.revealDeadline &&
    Date.now() >= new Date(board.revealDeadline).getTime()
  ) {
    return { ...board, status: "revealed" };
  }
  return board;
}

export function persistDeadlineReveals() {
  const db = loadDb();
  const due = db.boards.some(
    (board) =>
      board.revealEnabled &&
      board.status === "active" &&
      board.revealDeadline &&
      Date.now() >= new Date(board.revealDeadline).getTime(),
  );
  const missingSession = db.boards.some(
    (board) => board.status === "revealed" && !db.revealSessions.some((session) => session.boardId === board.id),
  );
  if (!due && !missingSession) return;
  mutateDb((next) => {
    for (const board of next.boards) {
      if (
        board.revealEnabled &&
        board.status === "active" &&
        board.revealDeadline &&
        Date.now() >= new Date(board.revealDeadline).getTime()
      ) {
        board.status = "revealed";
        next.notices.push({
          id: newId(),
          boardId: board.id,
          type: "revealed",
          actorUserId: board.createdBy,
          message: "Die Zeit ist abgelaufen — das Board wurde aufgelöst.",
          createdAt: nowIso(),
        });
      }
      if (board.status === "revealed") ensureRevealSession(next, board.id);
    }
  });
}

function memberCount(db: Database, boardId: string) {
  return db.members.filter((member) => member.boardId === boardId).length;
}

function isMember(db: Database, boardId: string, userId: string) {
  return db.members.some((member) => member.boardId === boardId && member.userId === userId);
}

function roleOf(db: Database, boardId: string, userId: string) {
  return db.members.find((member) => member.boardId === boardId && member.userId === userId)?.role;
}

function progressVisible(board: Board, viewerId: string, ownerId: string) {
  if (!board.revealEnabled) return true;
  if (board.status === "revealed") return true;
  return viewerId === ownerId;
}

function ensureRevealSession(db: Database, boardId: string) {
  if (db.revealSessions.some((session) => session.boardId === boardId)) return;
  db.revealSessions.push({
    boardId,
    currentIndex: 0,
    startedAt: nowIso(),
    finishedAt: null,
  });
}

function revealBoard(db: Database, boardId: string, actorUserId: string, message: string) {
  const board = db.boards.find((item) => item.id === boardId);
  if (!board || board.status === "revealed") return;
  board.status = "revealed";
  ensureRevealSession(db, boardId);
  db.notices.push({
    id: newId(),
    boardId,
    type: "revealed",
    actorUserId,
    message,
    createdAt: nowIso(),
  });
}

function maybeMajorityReveal(db: Database, boardId: string, actorUserId: string) {
  const board = db.boards.find((item) => item.id === boardId);
  if (!board || !board.revealEnabled || board.ownerMode || board.status !== "active") return;
  const needed = majorityNeeded(memberCount(db, boardId));
  const votes = db.revealVotes.filter((vote) => vote.boardId === boardId).length;
  if (votes >= needed) {
    revealBoard(db, boardId, actorUserId, "Mehrheit erreicht — Fortschritte sind jetzt sichtbar.");
  }
}

function checkBingo(db: Database, board: Board, userId: string) {
  if (!board.winLogicEnabled) return;
  const cells = db.cells.filter((cell) => cell.boardId === board.id);
  const progress = db.progress.filter((item) => item.userId === userId && cells.some((cell) => cell.id === item.cellId));
  const lines = findBingoLines(
    board.size,
    new Set(
      progress
        .filter((item) => item.completed)
        .map((item) => {
          const cell = cells.find((entry) => entry.id === item.cellId);
          return cell ? `${cell.row}:${cell.col}` : "";
        })
        .filter(Boolean),
    ),
  );
  if (lines.length === 0) return;
  const already = db.bingoEvents.some((event) => event.boardId === board.id && event.userId === userId);
  if (already) return;
  const user = profileOf(db, userId);
  db.bingoEvents.push({
    id: newId(),
    boardId: board.id,
    userId,
    lines,
    createdAt: nowIso(),
  });
  db.notices.push({
    id: newId(),
    boardId: board.id,
    type: "bingo",
    actorUserId: userId,
    message: `${user.displayName} hat Bingo!`,
    createdAt: nowIso(),
  });
}

export function currentUser(): SessionUser | null {
  const db = loadDb();
  const userId = getSessionUserId();
  const user = db.users.find((item) => item.id === userId);
  if (!user) return null;
  return toSession(user);
}

export async function signUp(displayName: string, email: string, password: string): Promise<SessionUser> {
  const name = displayName.trim();
  const mail = emailKey(email);
  if (name.length < 2) throw new Error("Bitte einen Anzeigenamen mit mindestens 2 Zeichen wählen.");
  if (!mail.includes("@")) throw new Error("Bitte eine gültige E-Mail angeben.");
  if (password.length < 6) throw new Error("Passwort braucht mindestens 6 Zeichen.");

  const db = loadDb();
  if (db.users.some((item) => item.email === mail)) {
    throw new Error("Für diese E-Mail gibt es schon einen Account.");
  }
  const salt = newId();
  const passwordHash = await hashPassword(password, salt);
  const session: SessionUser = {
    id: newId(),
    email: mail,
    displayName: name,
    avatarPixels: emptyAvatar(),
  };
  mutateDb((inner) => {
    if (inner.users.some((item) => item.email === mail)) {
      throw new Error("Für diese E-Mail gibt es schon einen Account.");
    }
    inner.users.push({
      id: session.id,
      email: mail,
      displayName: name,
      avatarPixels: emptyAvatar(),
      passwordHash,
      salt,
      createdAt: nowIso(),
    });
  });
  setSessionUserId(session.id);
  return session;
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const db = loadDb();
  const user = db.users.find((item) => item.email === emailKey(email));
  if (!user) throw new Error("E-Mail oder Passwort stimmt nicht.");
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error("E-Mail oder Passwort stimmt nicht.");
  setSessionUserId(user.id);
  return toSession(user);
}

export async function requestMagicLink(email: string): Promise<string> {
  const mail = emailKey(email);
  if (!mail.includes("@")) throw new Error("Bitte eine gültige E-Mail angeben.");
  const token = newId().replaceAll("-", "").slice(0, 20);
  mutateDb((db) => {
    db.magicTokens = db.magicTokens.filter((item) => item.expiresAt > Date.now());
    db.magicTokens.push({
      token,
      email: mail,
      expiresAt: Date.now() + 1000 * 60 * 30,
    });
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/login?magic=${token}`;
}

export async function consumeMagicLink(token: string): Promise<SessionUser> {
  let userId = "";
  mutateDb((db) => {
    const match = db.magicTokens.find((item) => item.token === token && item.expiresAt > Date.now());
    if (!match) throw new Error("Dieser Magic-Link ist ungültig oder abgelaufen.");
    db.magicTokens = db.magicTokens.filter((item) => item.token !== token);
    let user = db.users.find((item) => item.email === match.email);
    if (!user) {
      const salt = newId();
      user = {
        id: newId(),
        email: match.email,
        displayName: match.email.split("@")[0] || "Bingo-Freund",
        avatarPixels: emptyAvatar(),
        passwordHash: "",
        salt,
        createdAt: nowIso(),
      };
      db.users.push(user);
    }
    userId = user.id;
  });
  setSessionUserId(userId);
  const user = currentUser();
  if (!user) throw new Error("Login per Magic-Link fehlgeschlagen.");
  return user;
}

export function signOut() {
  setSessionUserId(null);
}

export function listBoards(): BoardSummary[] {
  const db = loadDb();
  const user = currentUser();
  if (!user) return [];
  return db.members
    .filter((member) => member.userId === user.id)
    .map((member) => {
      const board = applyDeadline(db.boards.find((item) => item.id === member.boardId)!);
      const cells = db.cells.filter((cell) => cell.boardId === board.id);
      const ownCompleted = db.progress.filter(
        (item) => item.userId === user.id && item.completed && cells.some((cell) => cell.id === item.cellId),
      ).length;
      const hasBingo = db.bingoEvents.some((event) => event.boardId === board.id && event.userId === user.id);
      return {
        board,
        role: member.role,
        memberCount: memberCount(db, board.id),
        ownCompleted,
        totalCells: cells.length,
        hasBingo,
      };
    })
    .sort((a, b) => b.board.createdAt.localeCompare(a.board.createdAt));
}

export function createBoard(input: CreateBoardInput): Board {
  const size = Math.min(6, Math.max(3, Math.round(input.size)));
  const name = input.name.trim();
  if (!name) throw new Error("Bitte einen Board-Namen angeben.");

  let created: Board | null = null;
  mutateDb((db) => {
    const user = requireUser(db);
    const board: Board = {
      id: newId(),
      name,
      size,
      status: "active",
      ownerMode: input.ownerMode,
      revealEnabled: input.revealEnabled,
      winLogicEnabled: input.winLogicEnabled,
      revealDeadline: input.revealDeadline,
      inviteCode: inviteCode(),
      createdBy: user.id,
      createdAt: nowIso(),
      archivedAt: null,
    };
    db.boards.push(board);
    db.members.push({
      boardId: board.id,
      userId: user.id,
      role: input.ownerMode ? "owner" : "member",
      joinedAt: nowIso(),
    });
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        db.cells.push({
          id: newId(),
          boardId: board.id,
          row,
          col,
          title: "",
          description: "",
          updatedAt: nowIso(),
          updatedBy: null,
        });
      }
    }
    created = board;
  });
  if (!created) throw new Error("Board konnte nicht erstellt werden.");
  return created;
}

export function getBoard(boardId: string): BoardDetail {
  const db = loadDb();
  const user = requireUser(db);
  const found = db.boards.find((item) => item.id === boardId);
  if (!found) throw new Error("Board nicht gefunden.");
  const board = applyDeadline(found);
  if (!isMember(db, boardId, user.id)) throw new Error("Kein Zugriff auf dieses Board.");

  const viewerRole = roleOf(db, boardId, user.id) ?? "member";
  const members = db.members
    .filter((member) => member.boardId === boardId)
    .map((member) => ({ ...member, profile: profileOf(db, member.userId) }));
  const cells = db.cells
    .filter((cell) => cell.boardId === boardId)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const progress = db.progress
    .filter((item) => cells.some((cell) => cell.id === item.cellId))
    .filter((item) => progressVisible(board, user.id, item.userId))
    .map((item) => ({ ...item, profile: profileOf(db, item.userId) }));
  const revealVotes = db.revealVotes.filter((vote) => vote.boardId === boardId);
  const revealSession = db.revealSessions.find((session) => session.boardId === boardId) ?? null;
  const revealDownvotes = db.revealDownvotes.filter((vote) => vote.boardId === boardId);
  const canManage = board.ownerMode ? viewerRole === "owner" : true;
  const canInvite = canManage;
  const canRevealNow =
    board.revealEnabled &&
    board.status === "active" &&
    (board.ownerMode ? viewerRole === "owner" : true);
  const canDelete = board.ownerMode ? viewerRole === "owner" : board.createdBy === user.id;

  return {
    board,
    members,
    cells,
    progress,
    revealVotes,
    revealSession,
    revealDownvotes,
    votesNeeded: majorityNeeded(members.length),
    notices: db.notices.filter((notice) => notice.boardId === boardId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    bingoEvents: db.bingoEvents.filter((event) => event.boardId === boardId),
    viewerRole,
    canInvite,
    canRevealNow,
    canManage,
    canDelete,
  };
}

export function joinBoard(code: string): Board {
  const normalized = code.trim().toUpperCase();
  let joined: Board | null = null;
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.inviteCode === normalized && item.status !== "archived");
    if (!board) throw new Error("Einladungscode unbekannt.");
    if (isMember(db, board.id, user.id)) {
      joined = board;
      return;
    }
    db.members.push({
      boardId: board.id,
      userId: user.id,
      role: "member",
      joinedAt: nowIso(),
    });
    db.notices.push({
      id: newId(),
      boardId: board.id,
      type: "joined",
      actorUserId: user.id,
      message: `${user.displayName} ist dem Board beigetreten.`,
      createdAt: nowIso(),
    });
    joined = board;
  });
  if (!joined) throw new Error("Beitritt fehlgeschlagen.");
  return joined;
}

export function updateBoard(boardId: string, patch: UpdateBoardInput): Board {
  let updated: Board | null = null;
  mutateDb((db) => {
    const user = requireUser(db);
    const detailRole = roleOf(db, boardId, user.id);
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || !detailRole) throw new Error("Kein Zugriff.");
    const canManage = board.ownerMode ? detailRole === "owner" : true;
    if (!canManage) throw new Error("Keine Berechtigung für die Board-Einstellungen.");
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error("Name darf nicht leer sein.");
      board.name = name;
    }
    if (patch.ownerMode !== undefined) {
      board.ownerMode = patch.ownerMode;
      const creator = db.members.find((member) => member.boardId === boardId && member.userId === board.createdBy);
      if (creator) creator.role = patch.ownerMode ? "owner" : "member";
    }
    if (patch.revealEnabled !== undefined) board.revealEnabled = patch.revealEnabled;
    if (patch.winLogicEnabled !== undefined) board.winLogicEnabled = patch.winLogicEnabled;
    if (patch.revealDeadline !== undefined) board.revealDeadline = patch.revealDeadline;
    updated = board;
  });
  if (!updated) throw new Error("Speichern fehlgeschlagen.");
  return updated;
}

export function rotateInviteCode(boardId: string): string {
  let code = "";
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    const role = roleOf(db, boardId, user.id);
    if (!board || !role) throw new Error("Kein Zugriff.");
    const canInvite = board.ownerMode ? role === "owner" : true;
    if (!canInvite) throw new Error("Keine Berechtigung zum Einladen.");
    board.inviteCode = inviteCode();
    code = board.inviteCode;
  });
  return code;
}

export function updateCell(boardId: string, cellId: string, title: string, description: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    if (!isMember(db, boardId, user.id)) throw new Error("Kein Zugriff.");
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || board.status === "archived") throw new Error("Dieses Board ist archiviert.");
    const cell = db.cells.find((item) => item.id === cellId && item.boardId === boardId);
    if (!cell) throw new Error("Feld nicht gefunden.");
    cell.title = title.trim();
    cell.description = description.trim();
    cell.updatedAt = nowIso();
    cell.updatedBy = user.id;
  });
}

export function upsertProgress(
  boardId: string,
  cellId: string,
  patch: Partial<Pick<Progress, "completed" | "note" | "photoDataUrl">>,
) {
  mutateDb((db) => {
    const user = requireUser(db);
    if (!isMember(db, boardId, user.id)) throw new Error("Kein Zugriff.");
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || board.status === "archived") throw new Error("Dieses Board ist archiviert.");
    if (board.status === "revealed") {
      throw new Error("Nach dem Reveal sind Haken, Notizen und Fotos eingefroren.");
    }
    const cell = db.cells.find((item) => item.id === cellId && item.boardId === boardId);
    if (!cell) throw new Error("Feld nicht gefunden.");
    let row = db.progress.find((item) => item.cellId === cellId && item.userId === user.id);
    if (!row) {
      row = {
        cellId,
        userId: user.id,
        completed: false,
        note: "",
        photoDataUrl: null,
        updatedAt: nowIso(),
      };
      db.progress.push(row);
    }
    if (patch.completed !== undefined) row.completed = patch.completed;
    if (patch.note !== undefined) row.note = patch.note;
    if (patch.photoDataUrl !== undefined) row.photoDataUrl = patch.photoDataUrl;
    row.updatedAt = nowIso();
    checkBingo(db, board, user.id);
  });
}

export function voteReveal(boardId: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || !isMember(db, boardId, user.id)) throw new Error("Kein Zugriff.");
    if (!board.revealEnabled) throw new Error("Reveal ist für dieses Board aus.");
    if (board.status !== "active") return;
    if (board.ownerMode) throw new Error("Im Owner-Modus löst der Owner die Auflösung aus.");
    const existing = db.revealVotes.find((vote) => vote.boardId === boardId && vote.userId === user.id);
    if (existing) {
      db.revealVotes = db.revealVotes.filter((vote) => vote !== existing);
    } else {
      db.revealVotes.push({ boardId, userId: user.id, votedAt: nowIso() });
    }
    maybeMajorityReveal(db, boardId, user.id);
  });
}

export function ownerReveal(boardId: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    const role = roleOf(db, boardId, user.id);
    if (!board || !role) throw new Error("Kein Zugriff.");
    if (!board.revealEnabled) throw new Error("Reveal ist für dieses Board aus.");
    if (board.ownerMode && role !== "owner") throw new Error("Nur der Owner kann beenden.");
    if (!board.ownerMode) throw new Error("Ohne Owner-Modus braucht es eine Mehrheit.");
    revealBoard(db, boardId, user.id, `${user.displayName} hat das Board beendet.`);
  });
}

export function stepReveal(boardId: string, delta: number) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || !isMember(db, boardId, user.id)) throw new Error("Kein Zugriff.");
    if (board.status !== "revealed") throw new Error("Die Auswertung startet erst nach dem Reveal.");
    ensureRevealSession(db, boardId);
    const session = db.revealSessions.find((item) => item.boardId === boardId);
    if (!session) throw new Error("Keine Auswertung gefunden.");
    const cellCount = db.cells.filter((cell) => cell.boardId === boardId).length;
    const nextIndex = Math.min(cellCount, Math.max(0, session.currentIndex + delta));
    session.currentIndex = nextIndex;
    session.finishedAt = nextIndex >= cellCount ? nowIso() : null;
  });
}

export function restartReveal(boardId: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || !isMember(db, boardId, user.id)) throw new Error("Kein Zugriff.");
    if (board.status !== "revealed") throw new Error("Die Auswertung startet erst nach dem Reveal.");
    ensureRevealSession(db, boardId);
    const session = db.revealSessions.find((item) => item.boardId === boardId);
    if (!session) throw new Error("Keine Auswertung gefunden.");
    session.currentIndex = 0;
    session.finishedAt = null;
    session.startedAt = nowIso();
  });
}

export function startRevealIfNeeded(boardId: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || !isMember(db, boardId, user.id)) throw new Error("Kein Zugriff.");
    if (board.status !== "revealed") return;
    ensureRevealSession(db, boardId);
  });
}

export function toggleRevealDownvote(boardId: string, cellId: string, targetUserId: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    if (!board || !isMember(db, boardId, user.id)) throw new Error("Kein Zugriff.");
    if (board.status !== "revealed") throw new Error("Downvotes gibt es erst in der Auswertung.");
    if (user.id === targetUserId) throw new Error("Du kannst dich nicht selbst downvoten.");
    if (!isMember(db, boardId, targetUserId)) throw new Error("Nur Mitglieder können bewertet werden.");
    const cell = db.cells.find((item) => item.id === cellId && item.boardId === boardId);
    if (!cell) throw new Error("Feld nicht gefunden.");
    const cells = db.cells.filter((item) => item.boardId === boardId).sort((a, b) => a.row - b.row || a.col - b.col);
    ensureRevealSession(db, boardId);
    const session = db.revealSessions.find((item) => item.boardId === boardId);
    const cellIndex = cells.findIndex((item) => item.id === cellId);
    if (!session || cellIndex < 0) throw new Error("Feld nicht gefunden.");
    const reviewed = session.finishedAt ? cells.length : session.currentIndex;
    if (cellIndex > reviewed) throw new Error("Dieses Feld ist noch nicht dran.");
    const completed = db.progress.some(
      (item) => item.cellId === cellId && item.userId === targetUserId && item.completed,
    );
    if (!completed) throw new Error("Nur abgehakte Felder können ungültig gemacht werden.");
    const existing = db.revealDownvotes.find(
      (vote) =>
        vote.boardId === boardId &&
        vote.cellId === cellId &&
        vote.targetUserId === targetUserId &&
        vote.voterUserId === user.id,
    );
    if (existing) {
      db.revealDownvotes = db.revealDownvotes.filter((vote) => vote !== existing);
    } else {
      db.revealDownvotes.push({
        boardId,
        cellId,
        targetUserId,
        voterUserId: user.id,
        createdAt: nowIso(),
      });
    }
  });
}

export function archiveBoard(boardId: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    const role = roleOf(db, boardId, user.id);
    if (!board || !role) throw new Error("Kein Zugriff.");
    const allowed = board.ownerMode ? role === "owner" : true;
    if (!allowed) throw new Error("Keine Berechtigung.");
    board.status = "archived";
    board.archivedAt = nowIso();
  });
}

export function deleteBoard(boardId: string) {
  mutateDb((db) => {
    const user = requireUser(db);
    const board = db.boards.find((item) => item.id === boardId);
    const role = roleOf(db, boardId, user.id);
    if (!board || !role) throw new Error("Kein Zugriff.");
    const allowed = board.ownerMode ? role === "owner" : board.createdBy === user.id;
    if (!allowed) throw new Error("Nur der Ersteller bzw. Owner kann löschen.");
    db.boards = db.boards.filter((item) => item.id !== boardId);
    db.members = db.members.filter((item) => item.boardId !== boardId);
    const cellIds = new Set(db.cells.filter((cell) => cell.boardId === boardId).map((cell) => cell.id));
    db.cells = db.cells.filter((cell) => cell.boardId !== boardId);
    db.progress = db.progress.filter((item) => !cellIds.has(item.cellId));
    db.revealVotes = db.revealVotes.filter((item) => item.boardId !== boardId);
    db.revealSessions = db.revealSessions.filter((item) => item.boardId !== boardId);
    db.revealDownvotes = db.revealDownvotes.filter((item) => item.boardId !== boardId);
    db.bingoEvents = db.bingoEvents.filter((item) => item.boardId !== boardId);
    db.notices = db.notices.filter((item) => item.boardId !== boardId);
  });
}

export function listAccounts(): SessionUser[] {
  return loadDb().users.map((user) => toSession(user));
}

export function updateProfile(displayName: string, avatarPixels: string[]) {
  const name = displayName.trim();
  if (name.length < 2) throw new Error("Bitte einen Anzeigenamen mit mindestens 2 Zeichen wählen.");
  mutateDb((db) => {
    const user = requireUser(db);
    const record = db.users.find((item) => item.id === user.id);
    if (!record) throw new Error("Profil nicht gefunden.");
    record.displayName = name;
    record.avatarPixels = normalizeAvatar(avatarPixels);
  });
}

export function switchAccount(userId: string) {
  const user = loadDb().users.find((item) => item.id === userId);
  if (!user) throw new Error("Account nicht gefunden.");
  setSessionUserId(user.id);
}
