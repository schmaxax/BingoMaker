import { majorityNeeded } from "./bingo";
import type { Cell, Progress, RevealDownvote } from "./types";

export function invalidateVotesNeeded(memberCount: number): number {
  return majorityNeeded(Math.max(1, memberCount - 1));
}

export function downvotesFor(
  votes: RevealDownvote[],
  cellId: string,
  targetUserId: string,
): RevealDownvote[] {
  return votes.filter((vote) => vote.cellId === cellId && vote.targetUserId === targetUserId);
}

export function isCompletionInvalid(
  votes: RevealDownvote[],
  cellId: string,
  targetUserId: string,
  memberCount: number,
): boolean {
  return downvotesFor(votes, cellId, targetUserId).length >= invalidateVotesNeeded(memberCount);
}

export function reviewedCellCount(cellCount: number, currentIndex: number, finished: boolean): number {
  if (finished) return cellCount;
  return Math.min(cellCount, Math.max(0, currentIndex + 1));
}

export function revealScoreForUser(
  userId: string,
  cells: Cell[],
  progress: Progress[],
  votes: RevealDownvote[],
  memberCount: number,
  reviewedCount: number,
): number {
  let score = 0;
  for (const cell of cells.slice(0, reviewedCount)) {
    const done = progress.some((item) => item.cellId === cell.id && item.userId === userId && item.completed);
    if (!done) continue;
    if (isCompletionInvalid(votes, cell.id, userId, memberCount)) continue;
    score += 1;
  }
  return score;
}
