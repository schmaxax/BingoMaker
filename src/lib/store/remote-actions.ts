import { findBingoLines, inviteCode, majorityNeeded } from "../bingo";
import { emptyAvatar, normalizeAvatar } from "../avatar";
import { getSupabase } from "../supabase/client";
import type {
  Board,
  BoardDetail,
  BoardSummary,
  CreateBoardInput,
  Progress,
  PublicProfile,
  RevealDownvote,
  RevealSession,
  RevealVote,
  SessionUser,
  UpdateBoardInput,
} from "../types";

type ProfileRow = {
  id: string;
  display_name: string;
  email: string;
  avatar_pixels: string[] | null;
};

type BoardRow = {
  id: string;
  name: string;
  size: number;
  status: Board["status"];
  owner_mode: boolean;
  reveal_enabled: boolean;
  win_logic_enabled: boolean;
  reveal_deadline: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
  archived_at: string | null;
};

function mapBoard(row: BoardRow): Board {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    status: row.status,
    ownerMode: row.owner_mode,
    revealEnabled: row.reveal_enabled,
    winLogicEnabled: row.win_logic_enabled,
    revealDeadline: row.reveal_deadline,
    inviteCode: row.invite_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

function mapProfile(row: ProfileRow): PublicProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    avatarPixels: normalizeAvatar(row.avatar_pixels),
  };
}

function sbError(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

async function requireAuthUser() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Bitte zuerst anmelden.");
  return data.user;
}

async function ensureProfile(userId: string, email: string, displayName?: string): Promise<SessionUser> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      displayName: existing.display_name,
      avatarPixels: normalizeAvatar(existing.avatar_pixels),
    };
  }
  const name = (displayName?.trim() || email.split("@")[0] || "Bingolover").slice(0, 80);
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email: email.toLowerCase(),
      display_name: name,
      avatar_pixels: emptyAvatar(),
    })
    .select("*")
    .single();
  if (error || !data) sbError(error, "Profil konnte nicht angelegt werden.");
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    avatarPixels: normalizeAvatar(data.avatar_pixels),
  };
}

async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from("cell-photos").createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function uploadPhoto(boardId: string, userId: string, cellId: string, dataUrl: string) {
  const supabase = getSupabase();
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${boardId}/${userId}/${cellId}.jpg`;
  const { error } = await supabase.storage.from("cell-photos").upload(path, blob, {
    upsert: true,
    contentType: blob.type || "image/jpeg",
  });
  if (error) sbError(error, "Foto-Upload fehlgeschlagen.");
  return path;
}

async function deletePhoto(path: string | null) {
  if (!path) return;
  const supabase = getSupabase();
  await supabase.storage.from("cell-photos").remove([path]);
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

async function persistBoardReveal(boardId: string, actorUserId: string, message: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("boards").update({ status: "revealed" }).eq("id", boardId);
  if (error) sbError(error, "Reveal fehlgeschlagen.");
  await supabase.from("board_notices").insert({
    board_id: boardId,
    type: "revealed",
    actor_user_id: actorUserId,
    message,
  });
  await supabase.from("reveal_sessions").upsert({
    board_id: boardId,
    current_index: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
  });
}

async function checkBingo(board: Board, userId: string, displayName: string) {
  if (!board.winLogicEnabled) return;
  const supabase = getSupabase();
  const { data: cells } = await supabase.from("cells").select("id, row, col").eq("board_id", board.id);
  if (!cells?.length) return;
  const cellIds = cells.map((c) => c.id);
  const { data: progress } = await supabase
    .from("cell_progress")
    .select("cell_id, completed")
    .eq("user_id", userId)
    .in("cell_id", cellIds);
  const completed = new Set(
    (progress ?? [])
      .filter((p) => p.completed)
      .map((p) => {
        const cell = cells.find((c) => c.id === p.cell_id);
        return cell ? `${cell.row}:${cell.col}` : "";
      })
      .filter(Boolean),
  );
  const lines = findBingoLines(board.size, completed);
  if (lines.length === 0) return;
  const { data: existing } = await supabase
    .from("bingo_events")
    .select("id")
    .eq("board_id", board.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;
  await supabase.from("bingo_events").insert({
    board_id: board.id,
    user_id: userId,
    lines,
  });
  await supabase.from("board_notices").insert({
    board_id: board.id,
    type: "bingo",
    actor_user_id: userId,
    message: `${displayName} hat Bingo!`,
  });
}

export async function currentUser(): Promise<SessionUser | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return ensureProfile(data.user.id, data.user.email ?? "", data.user.user_metadata?.display_name);
}

export async function signUp(displayName: string, email: string, password: string): Promise<SessionUser> {
  const name = displayName.trim();
  const mail = email.trim().toLowerCase();
  if (name.length < 2) throw new Error("Bitte einen Anzeigenamen mit mindestens 2 Zeichen wählen.");
  if (!mail.includes("@")) throw new Error("Bitte eine gültige E-Mail angeben.");
  if (password.length < 6) throw new Error("Passwort braucht mindestens 6 Zeichen.");

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: mail,
    password,
    options: { data: { display_name: name } },
  });
  if (error) {
    const message = error.message || "Registrierung fehlgeschlagen.";
    if (/invalid path/i.test(message)) {
      throw new Error(
        "Ungültige Supabase-URL. In Vercel/`.env.local` muss NEXT_PUBLIC_SUPABASE_URL nur die Project URL sein, z. B. https://xxxx.supabase.co — ohne /rest/v1/.",
      );
    }
    throw new Error(message);
  }
  if (!data.user) throw new Error("Registrierung fehlgeschlagen.");
  if (!data.session) {
    throw new Error(
      "Account angelegt. Bitte E-Mail bestätigen (oder in Supabase Auth → Confirm email deaktivieren), dann einloggen.",
    );
  }
  return ensureProfile(data.user.id, mail, name);
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error("E-Mail oder Passwort stimmt nicht.");
  if (!data.user) throw new Error("Login fehlgeschlagen.");
  return ensureProfile(data.user.id, data.user.email ?? email);
}

export async function requestMagicLink(email: string): Promise<string> {
  const mail = email.trim().toLowerCase();
  if (!mail.includes("@")) throw new Error("Bitte eine gültige E-Mail angeben.");
  const supabase = getSupabase();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { error } = await supabase.auth.signInWithOtp({
    email: mail,
    options: { emailRedirectTo: `${origin}/login` },
  });
  if (error) sbError(error, "Magic-Link konnte nicht gesendet werden.");
  return "";
}

export async function consumeMagicLink(_token: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("Magic-Link ungültig oder abgelaufen.");
  return user;
}

export async function signOut() {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

export async function listBoards(): Promise<BoardSummary[]> {
  const user = await currentUser();
  if (!user) return [];
  const supabase = getSupabase();

  const { data: memberships, error } = await supabase
    .from("board_members")
    .select("board_id, role, boards(*)")
    .eq("user_id", user.id);
  if (error) sbError(error, "Boards konnten nicht geladen werden.");

  const summaries: BoardSummary[] = [];
  for (const membership of memberships ?? []) {
    const raw = membership.boards as BoardRow | BoardRow[] | null;
    const boardRow = Array.isArray(raw) ? raw[0] : raw;
    if (!boardRow) continue;
    let board = applyDeadline(mapBoard(boardRow));
    if (board.status === "revealed" && boardRow.status === "active") {
      await persistBoardReveal(board.id, board.createdBy, "Die Zeit ist abgelaufen — das Board wurde aufgelöst.");
      board = { ...board, status: "revealed" };
    }
    const { count: totalCells } = await supabase
      .from("cells")
      .select("*", { count: "exact", head: true })
      .eq("board_id", board.id);
    const { data: cells } = await supabase.from("cells").select("id").eq("board_id", board.id);
    const cellIds = (cells ?? []).map((c) => c.id);
    let ownCompleted = 0;
    if (cellIds.length) {
      const { count } = await supabase
        .from("cell_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("completed", true)
        .in("cell_id", cellIds);
      ownCompleted = count ?? 0;
    }
    const { count: memberCount } = await supabase
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .eq("board_id", board.id);
    const { data: bingo } = await supabase
      .from("bingo_events")
      .select("id")
      .eq("board_id", board.id)
      .eq("user_id", user.id)
      .maybeSingle();
    summaries.push({
      board,
      role: membership.role as "owner" | "member",
      memberCount: memberCount ?? 0,
      ownCompleted,
      totalCells: totalCells ?? 0,
      hasBingo: Boolean(bingo),
    });
  }
  return summaries.sort((a, b) => b.board.createdAt.localeCompare(a.board.createdAt));
}

export async function createBoard(input: CreateBoardInput): Promise<Board> {
  const user = await requireAuthUser();
  await ensureProfile(user.id, user.email ?? "", user.user_metadata?.display_name);
  const size = Math.min(6, Math.max(3, Math.round(input.size)));
  const name = input.name.trim();
  if (!name) throw new Error("Bitte einen Board-Namen angeben.");

  const supabase = getSupabase();
  const { data: boardRow, error } = await supabase
    .from("boards")
    .insert({
      name,
      size,
      owner_mode: input.ownerMode,
      reveal_enabled: input.revealEnabled,
      win_logic_enabled: input.winLogicEnabled,
      reveal_deadline: input.revealDeadline,
      invite_code: inviteCode(),
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !boardRow) sbError(error, "Board konnte nicht erstellt werden.");

  const { error: memberError } = await supabase.from("board_members").insert({
    board_id: boardRow.id,
    user_id: user.id,
    role: input.ownerMode ? "owner" : "member",
  });
  if (memberError) sbError(memberError, "Mitgliedschaft fehlgeschlagen.");

  const cells = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      cells.push({ board_id: boardRow.id, row, col, title: "", description: "" });
    }
  }
  const { error: cellsError } = await supabase.from("cells").insert(cells);
  if (cellsError) sbError(cellsError, "Felder konnten nicht erstellt werden.");

  return mapBoard(boardRow as BoardRow);
}

export async function getBoard(boardId: string): Promise<BoardDetail> {
  const authUser = await requireAuthUser();
  const user = await ensureProfile(authUser.id, authUser.email ?? "");
  const supabase = getSupabase();

  const { data: boardRow, error } = await supabase.from("boards").select("*").eq("id", boardId).single();
  if (error || !boardRow) throw new Error("Board nicht gefunden.");
  let board = applyDeadline(mapBoard(boardRow as BoardRow));
  if (board.status === "revealed" && boardRow.status === "active") {
    await persistBoardReveal(board.id, board.createdBy, "Die Zeit ist abgelaufen — das Board wurde aufgelöst.");
    board = { ...board, status: "revealed" };
  }

  const { data: membership } = await supabase
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) throw new Error("Kein Zugriff auf dieses Board.");

  const { data: memberRows } = await supabase
    .from("board_members")
    .select("board_id, user_id, role, joined_at, profiles(*)")
    .eq("board_id", boardId);
  const members = (memberRows ?? []).map((row) => {
    const profileRaw = row.profiles as ProfileRow | ProfileRow[] | null;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    return {
      boardId: row.board_id,
      userId: row.user_id,
      role: row.role as "owner" | "member",
      joinedAt: row.joined_at,
      profile: profile
        ? mapProfile(profile)
        : { id: row.user_id, displayName: "Unbekannt", email: "", avatarPixels: emptyAvatar() },
    };
  });

  const { data: cellRows } = await supabase.from("cells").select("*").eq("board_id", boardId);
  const cells = (cellRows ?? [])
    .map((cell) => ({
      id: cell.id,
      boardId: cell.board_id,
      row: cell.row,
      col: cell.col,
      title: cell.title,
      description: cell.description,
      updatedAt: cell.updated_at,
      updatedBy: cell.updated_by,
    }))
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const cellIds = cells.map((c) => c.id);
  const { data: progressRows } = cellIds.length
    ? await supabase.from("cell_progress").select("*").in("cell_id", cellIds)
    : { data: [] as Array<Record<string, unknown>> };

  const profileById = new Map(members.map((m) => [m.userId, m.profile]));
  const progress = await Promise.all(
    (progressRows ?? []).map(async (row) => {
      const photoDataUrl = await signedPhotoUrl(row.photo_path as string | null);
      return {
        cellId: row.cell_id as string,
        userId: row.user_id as string,
        completed: Boolean(row.completed),
        note: (row.note as string) ?? "",
        photoDataUrl,
        updatedAt: row.updated_at as string,
        profile:
          profileById.get(row.user_id as string) ??
          ({ id: row.user_id, displayName: "Unbekannt", email: "", avatarPixels: emptyAvatar() } as PublicProfile),
      };
    }),
  );

  const { data: voteRows } = await supabase.from("reveal_votes").select("*").eq("board_id", boardId);
  const revealVotes: RevealVote[] = (voteRows ?? []).map((vote) => ({
    boardId: vote.board_id,
    userId: vote.user_id,
    votedAt: vote.voted_at,
  }));

  const { data: sessionRow } = await supabase.from("reveal_sessions").select("*").eq("board_id", boardId).maybeSingle();
  const revealSession: RevealSession | null = sessionRow
    ? {
        boardId: sessionRow.board_id,
        currentIndex: sessionRow.current_index,
        startedAt: sessionRow.started_at,
        finishedAt: sessionRow.finished_at,
      }
    : null;

  const { data: downvoteRows } = await supabase.from("reveal_downvotes").select("*").eq("board_id", boardId);
  const revealDownvotes: RevealDownvote[] = (downvoteRows ?? []).map((vote) => ({
    boardId: vote.board_id,
    cellId: vote.cell_id,
    targetUserId: vote.target_user_id,
    voterUserId: vote.voter_user_id,
    createdAt: vote.created_at,
  }));

  const { data: noticeRows } = await supabase
    .from("board_notices")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });
  const { data: bingoRows } = await supabase.from("bingo_events").select("*").eq("board_id", boardId);

  const viewerRole = membership.role as "owner" | "member";
  const canManage = board.ownerMode ? viewerRole === "owner" : true;

  return {
    board,
    members,
    cells,
    progress,
    revealVotes,
    revealSession,
    revealDownvotes,
    votesNeeded: majorityNeeded(members.length),
    notices: (noticeRows ?? []).map((notice) => ({
      id: notice.id,
      boardId: notice.board_id,
      type: notice.type,
      actorUserId: notice.actor_user_id,
      message: notice.message,
      createdAt: notice.created_at,
    })),
    bingoEvents: (bingoRows ?? []).map((event) => ({
      id: event.id,
      boardId: event.board_id,
      userId: event.user_id,
      lines: event.lines,
      createdAt: event.created_at,
    })),
    viewerRole,
    canInvite: canManage,
    canRevealNow: board.revealEnabled && board.status === "active" && (board.ownerMode ? viewerRole === "owner" : true),
    canManage,
    canDelete: board.ownerMode ? viewerRole === "owner" : board.createdBy === user.id,
  };
}

export async function joinBoard(code: string): Promise<Board> {
  await requireAuthUser();
  const supabase = getSupabase();
  const { data: boardId, error } = await supabase.rpc("join_board_by_code", { p_code: code });
  if (error) sbError(error, "Beitritt fehlgeschlagen.");
  const { data: boardRow, error: boardError } = await supabase.from("boards").select("*").eq("id", boardId).single();
  if (boardError || !boardRow) sbError(boardError, "Board nicht gefunden.");
  return mapBoard(boardRow as BoardRow);
}

export async function updateBoard(boardId: string, patch: UpdateBoardInput): Promise<Board> {
  const detail = await getBoard(boardId);
  if (!detail.canManage) throw new Error("Keine Berechtigung für die Board-Einstellungen.");
  const supabase = getSupabase();
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Name darf nicht leer sein.");
    updates.name = name;
  }
  if (patch.ownerMode !== undefined) updates.owner_mode = patch.ownerMode;
  if (patch.revealEnabled !== undefined) updates.reveal_enabled = patch.revealEnabled;
  if (patch.winLogicEnabled !== undefined) updates.win_logic_enabled = patch.winLogicEnabled;
  if (patch.revealDeadline !== undefined) updates.reveal_deadline = patch.revealDeadline;

  const { data, error } = await supabase.from("boards").update(updates).eq("id", boardId).select("*").single();
  if (error || !data) sbError(error, "Speichern fehlgeschlagen.");

  if (patch.ownerMode !== undefined) {
    await supabase
      .from("board_members")
      .update({ role: patch.ownerMode ? "owner" : "member" })
      .eq("board_id", boardId)
      .eq("user_id", data.created_by);
  }
  return mapBoard(data as BoardRow);
}

export async function rotateInviteCode(boardId: string): Promise<string> {
  const detail = await getBoard(boardId);
  if (!detail.canInvite) throw new Error("Keine Berechtigung zum Einladen.");
  const code = inviteCode();
  const supabase = getSupabase();
  const { error } = await supabase.from("boards").update({ invite_code: code }).eq("id", boardId);
  if (error) sbError(error, "Code konnte nicht erneuert werden.");
  return code;
}

export async function updateCell(boardId: string, cellId: string, title: string, description: string) {
  const user = await requireAuthUser();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("cells")
    .update({
      title: title.trim(),
      description: description.trim(),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", cellId)
    .eq("board_id", boardId);
  if (error) sbError(error, "Feld speichern fehlgeschlagen.");
}

export async function upsertProgress(
  boardId: string,
  cellId: string,
  patch: Partial<Pick<Progress, "completed" | "note" | "photoDataUrl">>,
) {
  const authUser = await requireAuthUser();
  const user = await ensureProfile(authUser.id, authUser.email ?? "");
  const detail = await getBoard(boardId);
  if (detail.board.status === "archived") throw new Error("Dieses Board ist archiviert.");
  if (detail.board.status === "revealed") {
    throw new Error("Nach dem Reveal sind Haken, Notizen und Fotos eingefroren.");
  }

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("cell_progress")
    .select("*")
    .eq("cell_id", cellId)
    .eq("user_id", user.id)
    .maybeSingle();

  let photoPath = existing?.photo_path ?? null;
  if (patch.photoDataUrl === null) {
    await deletePhoto(photoPath);
    photoPath = null;
  } else if (patch.photoDataUrl?.startsWith("data:")) {
    photoPath = await uploadPhoto(boardId, user.id, cellId, patch.photoDataUrl);
  }

  const next = {
    cell_id: cellId,
    user_id: user.id,
    completed: patch.completed ?? existing?.completed ?? false,
    note: patch.note ?? existing?.note ?? "",
    photo_path: photoPath,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("cell_progress").upsert(next);
  if (error) sbError(error, "Fortschritt speichern fehlgeschlagen.");
  await checkBingo(detail.board, user.id, user.displayName);
}

export async function voteReveal(boardId: string) {
  const user = await requireAuthUser();
  const detail = await getBoard(boardId);
  if (!detail.board.revealEnabled) throw new Error("Reveal ist für dieses Board aus.");
  if (detail.board.status !== "active") return;
  if (detail.board.ownerMode) throw new Error("Im Owner-Modus löst der Owner die Auflösung aus.");

  const supabase = getSupabase();
  const existing = detail.revealVotes.find((vote) => vote.userId === user.id);
  if (existing) {
    await supabase.from("reveal_votes").delete().eq("board_id", boardId).eq("user_id", user.id);
  } else {
    const { error } = await supabase.from("reveal_votes").insert({ board_id: boardId, user_id: user.id });
    if (error) sbError(error, "Stimme speichern fehlgeschlagen.");
  }

  const refreshed = await getBoard(boardId);
  if (refreshed.revealVotes.length >= refreshed.votesNeeded) {
    await persistBoardReveal(boardId, user.id, "Mehrheit erreicht — Fortschritte sind jetzt sichtbar.");
  }
}

export async function ownerReveal(boardId: string) {
  const authUser = await requireAuthUser();
  const user = await ensureProfile(authUser.id, authUser.email ?? "");
  const detail = await getBoard(boardId);
  if (!detail.board.revealEnabled) throw new Error("Reveal ist für dieses Board aus.");
  if (detail.board.ownerMode && detail.viewerRole !== "owner") throw new Error("Nur der Owner kann beenden.");
  if (!detail.board.ownerMode) throw new Error("Ohne Owner-Modus braucht es eine Mehrheit.");
  await persistBoardReveal(boardId, user.id, `${user.displayName} hat das Board beendet.`);
}

export async function stepReveal(boardId: string, delta: number) {
  await requireAuthUser();
  const detail = await getBoard(boardId);
  if (detail.board.status !== "revealed") throw new Error("Die Auswertung startet erst nach dem Reveal.");
  await startRevealIfNeeded(boardId);
  const supabase = getSupabase();
  const { data: session } = await supabase.from("reveal_sessions").select("*").eq("board_id", boardId).single();
  if (!session) throw new Error("Keine Auswertung gefunden.");
  const nextIndex = Math.min(detail.cells.length, Math.max(0, session.current_index + delta));
  const { error } = await supabase
    .from("reveal_sessions")
    .update({
      current_index: nextIndex,
      finished_at: nextIndex >= detail.cells.length ? new Date().toISOString() : null,
    })
    .eq("board_id", boardId);
  if (error) sbError(error, "Auswertung speichern fehlgeschlagen.");
}

export async function restartReveal(boardId: string) {
  await requireAuthUser();
  const detail = await getBoard(boardId);
  if (detail.board.status !== "revealed") throw new Error("Die Auswertung startet erst nach dem Reveal.");
  const supabase = getSupabase();
  const { error } = await supabase.from("reveal_sessions").upsert({
    board_id: boardId,
    current_index: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
  });
  if (error) sbError(error, "Auswertung neu starten fehlgeschlagen.");
}

export async function startRevealIfNeeded(boardId: string) {
  await requireAuthUser();
  const detail = await getBoard(boardId);
  if (detail.board.status !== "revealed") return;
  if (detail.revealSession) return;
  const supabase = getSupabase();
  await supabase.from("reveal_sessions").upsert({
    board_id: boardId,
    current_index: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
  });
}

export async function toggleRevealDownvote(boardId: string, cellId: string, targetUserId: string) {
  const user = await requireAuthUser();
  if (user.id === targetUserId) throw new Error("Du kannst dich nicht selbst downvoten.");
  const detail = await getBoard(boardId);
  if (detail.board.status !== "revealed") throw new Error("Downvotes gibt es erst in der Auswertung.");
  const existing = detail.revealDownvotes.find(
    (vote) => vote.cellId === cellId && vote.targetUserId === targetUserId && vote.voterUserId === user.id,
  );
  const supabase = getSupabase();
  if (existing) {
    await supabase
      .from("reveal_downvotes")
      .delete()
      .eq("board_id", boardId)
      .eq("cell_id", cellId)
      .eq("target_user_id", targetUserId)
      .eq("voter_user_id", user.id);
  } else {
    const { error } = await supabase.from("reveal_downvotes").insert({
      board_id: boardId,
      cell_id: cellId,
      target_user_id: targetUserId,
      voter_user_id: user.id,
    });
    if (error) sbError(error, "Downvote speichern fehlgeschlagen.");
  }
}

export async function archiveBoard(boardId: string) {
  const detail = await getBoard(boardId);
  if (!detail.canManage) throw new Error("Keine Berechtigung.");
  const supabase = getSupabase();
  const { error } = await supabase
    .from("boards")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", boardId);
  if (error) sbError(error, "Archivieren fehlgeschlagen.");
}

export async function deleteBoard(boardId: string) {
  const detail = await getBoard(boardId);
  if (!detail.canDelete) throw new Error("Nur der Ersteller bzw. Owner kann löschen.");
  const supabase = getSupabase();
  const { error } = await supabase.from("boards").delete().eq("id", boardId);
  if (error) sbError(error, "Löschen fehlgeschlagen.");
}

export async function listAccounts(): Promise<SessionUser[]> {
  const user = await currentUser();
  return user ? [user] : [];
}

export async function updateProfile(displayName: string, avatarPixels: string[]) {
  const name = displayName.trim();
  if (name.length < 2) throw new Error("Bitte einen Anzeigenamen mit mindestens 2 Zeichen wählen.");
  const user = await requireAuthUser();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name, avatar_pixels: normalizeAvatar(avatarPixels) })
    .eq("id", user.id);
  if (error) sbError(error, "Profil speichern fehlgeschlagen.");
}

export async function switchAccount(_userId: string) {
  throw new Error("Account-Wechsel: bitte ausloggen und mit dem anderen Konto einloggen.");
}

export async function persistDeadlineReveals() {
  const boards = await listBoards();
  for (const item of boards) {
    if (
      item.board.revealEnabled &&
      item.board.status === "active" &&
      item.board.revealDeadline &&
      Date.now() >= new Date(item.board.revealDeadline).getTime()
    ) {
      await persistBoardReveal(
        item.board.id,
        item.board.createdBy,
        "Die Zeit ist abgelaufen — das Board wurde aufgelöst.",
      );
    }
  }
}
