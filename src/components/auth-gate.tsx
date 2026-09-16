"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user } = useBingoStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [hydrated, user, pathname, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-ink-soft">
        {hydrated ? "Weiterleitung zum Login …" : "Lade …"}
      </div>
    );
  }

  return <>{children}</>;
}
