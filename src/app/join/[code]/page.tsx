"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader, Screen } from "@/components/ui";
import { joinBoard } from "@/lib/store/actions";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const { user } = useBingoStore();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      try {
        const board = joinBoard(params.code);
        router.replace(`/boards/${board.id}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Beitritt fehlgeschlagen.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, params.code, router]);

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
