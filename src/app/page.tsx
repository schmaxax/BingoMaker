"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader, Screen } from "@/components/ui";
import { statusLabel } from "@/lib/bingo";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function HomePage() {
  const { boards } = useBingoStore();
  const active = boards.filter((item) => item.board.status !== "archived");
  const archived = boards.filter((item) => item.board.status === "archived");

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title="Deine Boards" />
        <Screen>
          <div className="space-y-5">
            <Link
              href="/boards/new"
              className="flex items-center justify-between rounded-3xl bg-stamp px-5 py-4 text-white shadow-sm"
            >
              <span>
                <span className="block font-serif text-2xl">Neues Board</span>
                <span className="text-sm text-white/80">Name, Größe und Regeln festlegen</span>
              </span>
              <span className="text-3xl leading-none">+</span>
            </Link>

            <JoinStrip />

            {active.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line bg-card/70 p-6 text-center text-ink-soft">
                Noch keine Boards. Lege eines an oder tritt per Code bei.
              </p>
            ) : (
              <ul className="space-y-3">
                {active.map((item) => (
                  <li key={item.board.id}>
                    <Link
                      href={`/boards/${item.board.id}`}
                      className="block rounded-3xl border border-line bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-serif text-xl">{item.board.name}</p>
                          <p className="mt-1 text-sm text-ink-soft">
                            {item.board.size}×{item.board.size} · {item.memberCount} Mitglieder · {item.role === "owner" ? "Owner" : "Mitglied"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.board.status === "revealed" ? "bg-moss-soft text-moss" : "bg-paper-deep text-ink-soft"
                          }`}
                        >
                          {statusLabel(item.board.status)}
                        </span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper-deep">
                        <div
                          className="h-full rounded-full bg-stamp"
                          style={{ width: `${item.totalCells ? (item.ownCompleted / item.totalCells) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-ink-soft">
                        Dein Fortschritt: {item.ownCompleted}/{item.totalCells}
                        {item.hasBingo ? " · Bingo!" : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {archived.length > 0 ? (
              <details className="rounded-3xl border border-line bg-card p-4">
                <summary className="cursor-pointer font-semibold">Archiv ({archived.length})</summary>
                <ul className="mt-3 space-y-2">
                  {archived.map((item) => (
                    <li key={item.board.id}>
                      <Link href={`/boards/${item.board.id}`} className="block text-ink-soft">
                        {item.board.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </Screen>
      </div>
    </AuthGate>
  );
}

function JoinStrip() {
  const router = useRouter();
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const code = String(data.get("code") || "").trim();
        if (code) router.push(`/join/${encodeURIComponent(code.toUpperCase())}`);
      }}
    >
      <input
        name="code"
        placeholder="Einladungscode"
        className="min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 py-3 uppercase tracking-widest"
      />
      <button type="submit" className="rounded-2xl bg-ink px-4 font-semibold text-white">
        Beitreten
      </button>
    </form>
  );
}
