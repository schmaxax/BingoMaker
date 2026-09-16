"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { BingoGrid } from "@/components/bingo-grid";
import { AppHeader, PrimaryButton, Screen, SecondaryButton } from "@/components/ui";
import { statusLabel } from "@/lib/bingo";
import { getBoard, ownerReveal, voteReveal } from "@/lib/store/actions";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const { user } = useBingoStore();
  const boardId = params.boardId;

  if (!user) {
    return (
      <AuthGate>
        <div />
      </AuthGate>
    );
  }

  let detail;
  try {
    detail = getBoard(boardId);
  } catch (error) {
    return (
      <AuthGate>
        <AppHeader title="Board" backHref="/" />
        <Screen>
          <p className="rounded-3xl bg-card p-5 text-stamp">
            {error instanceof Error ? error.message : "Board nicht gefunden."}
          </p>
        </Screen>
      </AuthGate>
    );
  }

  const { board } = detail;
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${board.inviteCode}` : `/join/${board.inviteCode}`;
  const voted = detail.revealVotes.some((vote) => vote.userId === user.id);
  const latestBingo = detail.notices.find((notice) => notice.type === "bingo");

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title={board.name} backHref="/" />
        <Screen>
          <div className="space-y-4">
            {latestBingo ? (
              <div className="rounded-3xl bg-stamp px-4 py-3 text-white shadow-sm">
                <p className="font-serif text-2xl">Bingo!</p>
                <p className="text-sm text-white/85">{latestBingo.message}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-card px-3 py-1 font-semibold">{statusLabel(board.status)}</span>
              <span className="rounded-full bg-card px-3 py-1">{board.size}×{board.size}</span>
              <span className="rounded-full bg-card px-3 py-1">{detail.members.length} Leute</span>
              {board.winLogicEnabled ? <span className="rounded-full bg-card px-3 py-1">Gewinnlogik an</span> : null}
            </div>

            <BingoGrid detail={detail} userId={user.id} />
            <p className="text-center text-sm text-ink-soft">
              {board.status === "revealed"
                ? "Haken, Notizen und Fotos sind eingefroren. Die Gruppe wertet jetzt Feld für Feld aus."
                : "Tippen hakt ab. Das Notiz-Symbol öffnet deine private Notiz und dein Foto — unsichtbar für die anderen bis zum Reveal."}
            </p>

            {board.revealEnabled && board.status === "active" ? (
              <section className="rounded-3xl border border-line bg-card p-4">
                <p className="font-semibold">Reveal</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Fortschritte bleiben privat
                  {board.revealDeadline
                    ? ` bis ${new Date(board.revealDeadline).toLocaleString("de-DE")}`
                    : ", bis das Board aufgelöst wird"}
                  .
                </p>
                {board.ownerMode && detail.canRevealNow ? (
                  <div className="mt-3">
                    <PrimaryButton type="button" onClick={() => ownerReveal(board.id)}>
                      Board beenden & Reveal
                    </PrimaryButton>
                  </div>
                ) : null}
                {!board.ownerMode && detail.canRevealNow ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm">
                      Stimmen: {detail.revealVotes.length}/{detail.votesNeeded} (Mehrheit)
                    </p>
                    <SecondaryButton type="button" onClick={() => voteReveal(board.id)}>
                      {voted ? "Stimme zurückziehen" : "Für Auflösung stimmen"}
                    </SecondaryButton>
                  </div>
                ) : null}
              </section>
            ) : null}

            {board.status === "revealed" ? (
              <Link
                href={`/boards/${board.id}/reveal`}
                className="block rounded-3xl bg-stamp px-5 py-4 text-white shadow-sm"
              >
                <p className="font-serif text-2xl">Auswertung</p>
                <p className="mt-1 text-sm text-white/85">
                  Feld für Feld durchgehen, Belege der anderen sehen, ungültige Haken downvoten — am Ende gewinnt, wer
                  die meisten Punkte hat.
                </p>
              </Link>
            ) : null}

            {detail.canInvite ? (
              <section className="rounded-3xl border border-line bg-card p-4">
                <p className="font-semibold">Freund:innen einladen</p>
                <p className="mt-2 font-mono text-2xl tracking-[0.3em]">{board.inviteCode}</p>
                <p className="mt-1 break-all text-sm text-ink-soft">{inviteUrl}</p>
              </section>
            ) : null}

            <div className="flex gap-2">
              <Link
                href={`/boards/${board.id}/fields`}
                className="flex-1 rounded-2xl bg-ink px-4 py-3 text-center font-semibold text-white"
              >
                Feldinhalte
              </Link>
              <Link
                href={`/boards/${board.id}/settings`}
                className="flex-1 rounded-2xl border border-line bg-card px-4 py-3 text-center font-semibold"
              >
                Einstellungen
              </Link>
            </div>
          </div>
        </Screen>
      </div>
    </AuthGate>
  );
}
