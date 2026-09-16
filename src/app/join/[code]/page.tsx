"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader, Screen } from "@/components/ui";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const { user, actions } = useBingoStore();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const board = await actions.joinBoard(params.code);
        if (!cancelled) router.replace(`/boards/${board.id}`);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Beitritt fehlgeschlagen.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, params.code, router, actions]);

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title="Beitreten" backHref="/" />
        <Screen>
          <p className="rounded-3xl bg-card p-5">
            {error || `Trete Board ${params.code.toUpperCase()} bei …`}
          </p>
        </Screen>
      </div>
    </AuthGate>
  );
}
