"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PixelAvatar } from "@/components/pixel-avatar";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export function AppHeader({ title, backHref }: { title?: string; backHref?: string }) {
  const { user, actions } = useBingoStore();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {backHref ? (
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-lg"
            aria-label="Zurück"
          >
            ←
          </Link>
        ) : (
          <Link href="/" className="font-serif text-xl tracking-tight text-stamp">
            Bingo
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight">{title ?? "Freundes-Bingo"}</p>
          {user ? (
            <Link href="/profile" className="truncate text-xs text-ink-soft underline-offset-2 hover:underline">
              {user.displayName}
            </Link>
          ) : null}
        </div>
        {user && pathname !== "/login" ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" aria-label="Profil bearbeiten" className="shrink-0">
              <PixelAvatar pixels={user.avatarPixels} name={user.displayName} size={36} />
            </Link>
            <button
              type="button"
              className="rounded-full border border-line bg-card px-3 py-1.5 text-sm"
              onClick={() => {
                actions.signOut();
                router.push("/login");
              }}
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-24">{children}</div>;
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-2xl bg-stamp px-4 py-3.5 text-center font-semibold text-white shadow-sm disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-2xl border border-line bg-card px-4 py-3.5 font-semibold disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 outline-none ring-stamp focus:ring-2";
