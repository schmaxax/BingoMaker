"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { RevealCeremony } from "@/components/reveal-ceremony";
import { AppHeader, Screen } from "@/components/ui";
import { useBingoStore, useBoardDetail } from "@/lib/store/use-bingo-store";

export default function RevealPage() {
  const params = useParams<{ boardId: string }>();
  const { user } = useBingoStore();
  const boardId = params.boardId;
  const { detail, error, loading, actions } = useBoardDetail(boardId);

  useEffect(() => {
    if (detail?.board.status === "revealed" && !detail.revealSession) {
      void actions.startRevealIfNeeded(boardId);
    }
  }, [boardId, detail?.board.status, detail?.revealSession, actions]);

  if (!user) {
    return (
      <AuthGate>
        <div />
      </AuthGate>
    );
  }

  if (loading) {
    return (
      <AuthGate>
        <AppHeader title="Auswertung" backHref={`/boards/${boardId}`} />
        <Screen>
          <p className="text-ink-soft">Auswertung wird geladen …</p>
        </Screen>
      </AuthGate>
    );
  }

  if (error || !detail) {
    return (
      <AuthGate>
        <AppHeader title="Auswertung" backHref="/" />
        <Screen>
          <p className="rounded-3xl bg-card p-5 text-stamp">{error || "Board nicht gefunden."}</p>
        </Screen>
      </AuthGate>
    );
  }

  if (detail.board.status !== "revealed") {
    return (
      <AuthGate>
        <AppHeader title="Auswertung" backHref={`/boards/${boardId}`} />
        <Screen>
          <p className="rounded-3xl bg-card p-5 text-ink-soft">
            Die Auswertung startet, sobald das Board per Stimme, Owner oder Enddatum aufgelöst ist.
          </p>
        </Screen>
      </AuthGate>
    );
  }

  if (!detail.revealSession) {
    return (
      <AuthGate>
        <AppHeader title="Auswertung" backHref={`/boards/${boardId}`} />
        <Screen>
          <p className="text-ink-soft">Auswertung wird vorbereitet …</p>
        </Screen>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title="Auswertung" backHref={`/boards/${boardId}`} />
        <Screen>
          <RevealCeremony detail={detail} userId={user.id} />
        </Screen>
      </div>
    </AuthGate>
  );
}
