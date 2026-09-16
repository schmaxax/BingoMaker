"use client";

import { ConfettiBurst } from "@/components/confetti-burst";
import { PixelAvatar } from "@/components/pixel-avatar";
import { ProgressPhoto } from "@/components/progress-photo";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import {
  downvotesFor,
  invalidateVotesNeeded,
  isCompletionInvalid,
  revealScoreForUser,
  reviewedCellCount,
} from "@/lib/reveal";
import { restartReveal, stepReveal, toggleRevealDownvote } from "@/lib/store/actions";
import type { BoardDetail } from "@/lib/types";

export function RevealCeremony({ detail, userId }: { detail: BoardDetail; userId: string }) {
  const { board, members, cells, progress, revealDownvotes } = detail;
  const session = detail.revealSession;
  const finished = Boolean(session?.finishedAt) || (session?.currentIndex ?? 0) >= cells.length;
  const currentIndex = Math.min(session?.currentIndex ?? 0, cells.length);
  const currentCell = finished ? null : cells[currentIndex];
  const reviewedCount = reviewedCellCount(cells.length, currentIndex, finished);
  const votesNeeded = invalidateVotesNeeded(members.length);
  const scores = new Map(
    members.map((member) => [
      member.userId,
      revealScoreForUser(member.userId, cells, progress, revealDownvotes, members.length, reviewedCount),
    ]),
  );
  const ranked = finished
    ? [...members].sort((a, b) => (scores.get(b.userId) ?? 0) - (scores.get(a.userId) ?? 0))
    : members;
  const topScore = Math.max(0, ...ranked.map((member) => scores.get(member.userId) ?? 0));
  const winners = new Set(
    finished && topScore > 0
      ? ranked.filter((member) => (scores.get(member.userId) ?? 0) === topScore).map((member) => member.userId)
      : [],
  );

  return (
    <div className="space-y-5">
      <RevealScoreboard
        members={ranked}
        scores={scores}
        maxScore={cells.length}
        showNames={finished}
        winners={winners}
      />

      {finished ? (
        <Finale
          boardName={board.name}
          winners={ranked.filter((member) => winners.has(member.userId))}
          topScore={topScore}
          onBack={() => stepReveal(board.id, -1)}
          onRestart={() => restartReveal(board.id)}
        />
      ) : currentCell ? (
        <>
          <section className="rounded-3xl border border-line bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              Feld {currentIndex + 1} von {cells.length}
            </p>
            <p className="mt-1 font-serif text-2xl">
              {currentCell.title || `Feld ${currentCell.row + 1}/${currentCell.col + 1}`}
            </p>
            {currentCell.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{currentCell.description}</p>
            ) : null}
            <p className="mt-3 text-sm text-ink-soft">
              Schaut euch Haken, Notizen und Fotos an. Wenn ein Beleg nicht zählt, downvotet ihn — ab {votesNeeded}{" "}
              {votesNeeded === 1 ? "Stimme" : "Stimmen"} der anderen wird das Feld ungültig.
            </p>
          </section>

          <div className="space-y-3">
            {members.map((member) => {
              const entry = progress.find((item) => item.cellId === currentCell.id && item.userId === member.userId);
              const completed = Boolean(entry?.completed);
              const votes = downvotesFor(revealDownvotes, currentCell.id, member.userId);
              const invalid = isCompletionInvalid(
                revealDownvotes,
                currentCell.id,
                member.userId,
                members.length,
              );
              const mine = member.userId === userId;
              const voted = votes.some((vote) => vote.voterUserId === userId);
              return (
                <article
                  key={member.userId}
                  className={`rounded-3xl border p-4 ${
                    invalid
                      ? "border-stamp/40 bg-stamp/5"
                      : completed
                        ? "border-moss/30 bg-card"
                        : "border-line bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 font-semibold">
                      <PixelAvatar
                        pixels={member.profile.avatarPixels}
                        name={member.profile.displayName}
                        size={36}
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{member.profile.displayName}</span>
                        <span className={`text-sm font-medium ${invalid ? "text-stamp" : "text-ink-soft"}`}>
                          {invalid
                            ? "Ungültig"
                            : completed
                              ? "Abgehakt"
                              : "Nicht abgehakt"}
                        </span>
                      </span>
                    </p>
                    {completed && !mine ? (
                      <button
                        type="button"
                        onClick={() => toggleRevealDownvote(board.id, currentCell.id, member.userId)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                          voted ? "bg-stamp text-white" : "border border-line bg-paper"
                        }`}
                      >
                        {voted ? "Downvote weg" : "Downvoten"}
                      </button>
                    ) : null}
                  </div>
                  {completed && votes.length > 0 ? (
                    <p className="mt-2 text-xs text-ink-soft">
                      {votes.length}/{votesNeeded} Downvotes
                      {invalid ? " · zählt nicht" : ""}
                    </p>
                  ) : null}
                  {entry?.note ? <p className="mt-3 whitespace-pre-wrap text-sm">{entry.note}</p> : null}
                  {entry?.photoDataUrl ? (
                    <ProgressPhoto
                      src={entry.photoDataUrl}
                      alt={`Foto von ${member.profile.displayName}`}
                      className="mt-3"
                    />
                  ) : completed && !entry?.note ? (
                    <p className="mt-3 text-sm text-ink-soft">Kein Beleg hinterlegt.</p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton type="button" disabled={currentIndex === 0} onClick={() => stepReveal(board.id, -1)}>
              Zurück
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => stepReveal(board.id, 1)}>
              {currentIndex + 1 >= cells.length ? "Ergebnis" : "Nächstes Feld"}
            </PrimaryButton>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RevealScoreboard({
  members,
  scores,
  maxScore,
  showNames,
  winners,
}: {
  members: BoardDetail["members"];
  scores: Map<string, number>;
  maxScore: number;
  showNames: boolean;
  winners: Set<string>;
}) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Punktestand</p>
      <div className="mt-4 flex items-end justify-around gap-2 overflow-x-auto pb-1">
        {members.map((member) => {
          const score = scores.get(member.userId) ?? 0;
          const pct = maxScore ? (score / maxScore) * 100 : 0;
          const winner = winners.has(member.userId);
          return (
            <div key={member.userId} className="flex w-14 shrink-0 flex-col items-center gap-2">
              <div className={winner ? "rounded-full ring-2 ring-gold ring-offset-2 ring-offset-card" : ""}>
                <PixelAvatar pixels={member.profile.avatarPixels} name={member.profile.displayName} size={40} />
              </div>
              <div className="relative h-32 w-7 overflow-hidden rounded-full bg-paper-deep">
                <div
                  className={`absolute bottom-0 w-full rounded-full transition-[height] duration-500 ${
                    winner ? "bg-gold" : "bg-stamp"
                  }`}
                  style={{ height: `${Math.max(pct, score > 0 ? 8 : 0)}%` }}
                />
              </div>
              <p className="text-sm font-bold tabular-nums">{score}</p>
              {showNames ? (
                <p className="w-full truncate text-center text-[11px] font-semibold leading-tight">
                  {member.profile.displayName}
                </p>
              ) : (
                <span className="sr-only">{member.profile.displayName}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Finale({
  boardName,
  winners,
  topScore,
  onBack,
  onRestart,
}: {
  boardName: string;
  winners: BoardDetail["members"];
  topScore: number;
  onBack: () => void;
  onRestart: () => void;
}) {
  const title =
    winners.length === 0
      ? "Kein Punkt vergeben"
      : winners.length === 1
        ? `${winners[0].profile.displayName} hat gewonnen!`
        : "Unentschieden!";

  return (
    <section className="relative space-y-4">
      <ConfettiBurst />
      <div className="rounded-3xl bg-stamp px-5 py-6 text-center text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{boardName}</p>
        <p className="mt-2 font-serif text-3xl leading-tight">{title}</p>
        {winners.length > 1 ? (
          <p className="mt-2 text-sm text-white/85">
            {winners.map((member) => member.profile.displayName).join(" & ")} mit je {topScore}{" "}
            {topScore === 1 ? "Punkt" : "Punkten"}
          </p>
        ) : winners.length === 1 ? (
          <p className="mt-2 text-sm text-white/85">
            {topScore} {topScore === 1 ? "gültiges Feld" : "gültige Felder"}
          </p>
        ) : (
          <p className="mt-2 text-sm text-white/85">Niemand hat ein gültiges Feld abgehakt.</p>
        )}
        {winners.length > 0 ? (
          <div className="mt-4 flex justify-center gap-2">
            {winners.map((member) => (
              <PixelAvatar
                key={member.userId}
                pixels={member.profile.avatarPixels}
                name={member.profile.displayName}
                size={48}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton type="button" onClick={onBack}>
          Letztes Feld
        </SecondaryButton>
        <PrimaryButton type="button" onClick={onRestart}>
          Nochmal durchgehen
        </PrimaryButton>
      </div>
    </section>
  );
}
