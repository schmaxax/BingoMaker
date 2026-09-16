import { isSupabaseConfigured } from "../supabase/client";
import * as local from "./local-actions";
import * as remote from "./remote-actions";
import type {
  Board,
  BoardDetail,
  BoardSummary,
  CreateBoardInput,
  Progress,
  SessionUser,
  UpdateBoardInput,
} from "../types";

function useRemote() {
  return isSupabaseConfigured();
}

export async function currentUser(): Promise<SessionUser | null> {
  return useRemote() ? remote.currentUser() : Promise.resolve(local.currentUser());
}

export async function signUp(displayName: string, email: string, password: string) {
  return useRemote() ? remote.signUp(displayName, email, password) : local.signUp(displayName, email, password);
}

export async function signIn(email: string, password: string) {
  return useRemote() ? remote.signIn(email, password) : local.signIn(email, password);
}

export async function requestMagicLink(email: string) {
  return useRemote() ? remote.requestMagicLink(email) : local.requestMagicLink(email);
}

export async function consumeMagicLink(token: string) {
  return useRemote() ? remote.consumeMagicLink(token) : local.consumeMagicLink(token);
}

export async function signOut() {
  return useRemote() ? remote.signOut() : Promise.resolve(local.signOut());
}

export async function listBoards(): Promise<BoardSummary[]> {
  return useRemote() ? remote.listBoards() : Promise.resolve(local.listBoards());
}

export async function createBoard(input: CreateBoardInput): Promise<Board> {
  return useRemote() ? remote.createBoard(input) : Promise.resolve(local.createBoard(input));
}

export async function getBoard(boardId: string): Promise<BoardDetail> {
  return useRemote() ? remote.getBoard(boardId) : Promise.resolve(local.getBoard(boardId));
}

export async function joinBoard(code: string): Promise<Board> {
  return useRemote() ? remote.joinBoard(code) : Promise.resolve(local.joinBoard(code));
}

export async function updateBoard(boardId: string, patch: UpdateBoardInput): Promise<Board> {
  return useRemote() ? remote.updateBoard(boardId, patch) : Promise.resolve(local.updateBoard(boardId, patch));
}

export async function rotateInviteCode(boardId: string): Promise<string> {
  return useRemote() ? remote.rotateInviteCode(boardId) : Promise.resolve(local.rotateInviteCode(boardId));
}

export async function updateCell(boardId: string, cellId: string, title: string, description: string) {
  return useRemote()
    ? remote.updateCell(boardId, cellId, title, description)
    : Promise.resolve(local.updateCell(boardId, cellId, title, description));
}

export async function upsertProgress(
  boardId: string,
  cellId: string,
  patch: Partial<Pick<Progress, "completed" | "note" | "photoDataUrl">>,
) {
  return useRemote()
    ? remote.upsertProgress(boardId, cellId, patch)
    : Promise.resolve(local.upsertProgress(boardId, cellId, patch));
}

export async function voteReveal(boardId: string) {
  return useRemote() ? remote.voteReveal(boardId) : Promise.resolve(local.voteReveal(boardId));
}

export async function ownerReveal(boardId: string) {
  return useRemote() ? remote.ownerReveal(boardId) : Promise.resolve(local.ownerReveal(boardId));
}

export async function stepReveal(boardId: string, delta: number) {
  return useRemote() ? remote.stepReveal(boardId, delta) : Promise.resolve(local.stepReveal(boardId, delta));
}

export async function restartReveal(boardId: string) {
  return useRemote() ? remote.restartReveal(boardId) : Promise.resolve(local.restartReveal(boardId));
}

export async function startRevealIfNeeded(boardId: string) {
  return useRemote()
    ? remote.startRevealIfNeeded(boardId)
    : Promise.resolve(local.startRevealIfNeeded(boardId));
}

export async function toggleRevealDownvote(boardId: string, cellId: string, targetUserId: string) {
  return useRemote()
    ? remote.toggleRevealDownvote(boardId, cellId, targetUserId)
    : Promise.resolve(local.toggleRevealDownvote(boardId, cellId, targetUserId));
}

export async function archiveBoard(boardId: string) {
  return useRemote() ? remote.archiveBoard(boardId) : Promise.resolve(local.archiveBoard(boardId));
}

export async function deleteBoard(boardId: string) {
  return useRemote() ? remote.deleteBoard(boardId) : Promise.resolve(local.deleteBoard(boardId));
}

export async function listAccounts(): Promise<SessionUser[]> {
  return useRemote() ? remote.listAccounts() : Promise.resolve(local.listAccounts());
}

export async function updateProfile(displayName: string, avatarPixels: string[]) {
  return useRemote()
    ? remote.updateProfile(displayName, avatarPixels)
    : Promise.resolve(local.updateProfile(displayName, avatarPixels));
}

export async function switchAccount(userId: string) {
  return useRemote() ? remote.switchAccount(userId) : Promise.resolve(local.switchAccount(userId));
}

export async function persistDeadlineReveals() {
  return useRemote() ? remote.persistDeadlineReveals() : Promise.resolve(local.persistDeadlineReveals());
}

export { isSupabaseConfigured };
