"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready } = useBingoStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [ready, user, pathname, router]);

  if (!ready || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-ink-soft">
        {ready ? "Weiterleitung zum Login …" : "Lade …"}
      </div>
    );
  }

  return <>{children}</>;
}
