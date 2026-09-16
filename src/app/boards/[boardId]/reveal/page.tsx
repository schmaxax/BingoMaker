"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { RevealCeremony } from "@/components/reveal-ceremony";
import { AppHeader, Screen } from "@/components/ui";
import { getBoard, startRevealIfNeeded } from "@/lib/store/actions";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function RevealPage() {
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
        <AppHeader title="Auswertung" backHref="/" />
        <Screen>
          <p className="rounded-3xl bg-card p-5 text-stamp">
            {error instanceof Error ? error.message : "Board nicht gefunden."}
          </p>
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

  return (
    <AuthGate>
      <RevealReady boardId={boardId} userId={user.id} />
    </AuthGate>
  );
}

function RevealReady({ boardId, userId }: { boardId: string; userId: string }) {
  const { version } = useBingoStore();
  const detail = getBoard(boardId);
  void version;

  useEffect(() => {
    if (detail.board.status === "revealed" && !detail.revealSession) {
      startRevealIfNeeded(boardId);
    }
  }, [boardId, detail.board.status, detail.revealSession]);

  if (!detail.revealSession) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader title="Auswertung" backHref={`/boards/${boardId}`} />
        <Screen>
          <p className="text-ink-soft">Auswertung wird vorbereitet …</p>
        </Screen>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="Auswertung" backHref={`/boards/${boardId}`} />
      <Screen>
        <RevealCeremony detail={detail} userId={userId} />
      </Screen>
    </div>
  );
}
