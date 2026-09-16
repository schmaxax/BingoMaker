"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { PixelAvatar } from "@/components/pixel-avatar";
import { AppHeader, Field, PrimaryButton, Screen, SecondaryButton, inputClass } from "@/components/ui";
import {
  archiveBoard,
  deleteBoard,
  getBoard,
  rotateInviteCode,
  updateBoard,
} from "@/lib/store/actions";
import { useBingoStore } from "@/lib/store/use-bingo-store";

export default function SettingsPage() {
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

  try {
    getBoard(boardId);
  } catch (error) {
    return (
      <AuthGate>
        <AppHeader title="Einstellungen" backHref="/" />
        <Screen>
          <p className="text-stamp">{error instanceof Error ? error.message : "Kein Zugriff."}</p>
        </Screen>
      </AuthGate>
    );
  }

  return <SettingsForm boardId={boardId} />;
}

function SettingsForm({ boardId }: { boardId: string }) {
  const { version } = useBingoStore();
  const router = useRouter();
  const detail = getBoard(boardId);
  void version;
  const { board } = detail;
  const [name, setName] = useState(board.name);
  const [ownerMode, setOwnerMode] = useState(board.ownerMode);
  const [revealEnabled, setRevealEnabled] = useState(board.revealEnabled);
  const [winLogicEnabled, setWinLogicEnabled] = useState(board.winLogicEnabled);
  const [deadline, setDeadline] = useState(
    board.revealDeadline ? board.revealDeadline.slice(0, 16) : "",
  );
  const [error, setError] = useState("");
  const [code, setCode] = useState(board.inviteCode);

  function save(event: FormEvent) {
    event.preventDefault();
    try {
      updateBoard(boardId, {
        name,
        ownerMode,
        revealEnabled,
        winLogicEnabled,
        revealDeadline: deadline ? new Date(deadline).toISOString() : null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <AuthGate>
      <div className="flex min-h-full flex-col">
        <AppHeader title="Einstellungen" backHref={`/boards/${boardId}`} />
        <Screen>
          <form className="space-y-5" onSubmit={save}>
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} disabled={!detail.canManage} />
            </Field>
            <Toggle title="Owner/Admin-Modus" checked={ownerMode} onChange={setOwnerMode} disabled={!detail.canManage} />
            <Toggle title="Reveal-Funktion" checked={revealEnabled} onChange={setRevealEnabled} disabled={!detail.canManage} />
            <Toggle title="Gewinnlogik" checked={winLogicEnabled} onChange={setWinLogicEnabled} disabled={!detail.canManage} />
            {revealEnabled ? (
              <Field label="Enddatum">
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={!detail.canManage}
                />
              </Field>
            ) : null}
            {error ? <p className="text-sm font-semibold text-stamp">{error}</p> : null}
            {detail.canManage ? <PrimaryButton type="submit">Änderungen speichern</PrimaryButton> : null}
          </form>

          <section className="mt-8 space-y-3 rounded-3xl border border-line bg-card p-4">
            <p className="font-semibold">Mitglieder</p>
            <ul className="space-y-2 text-sm">
              {detail.members.map((member) => (
                <li key={member.userId} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <PixelAvatar pixels={member.profile.avatarPixels} name={member.profile.displayName} size={28} />
                    <span className="truncate">{member.profile.displayName}</span>
                  </span>
                  <span className="text-ink-soft">{member.role === "owner" ? "Owner" : "Mitglied"}</span>
                </li>
              ))}
            </ul>
            {detail.canInvite ? (
              <>
                <p className="font-mono text-xl tracking-[0.25em]">{code}</p>
                <SecondaryButton
                  type="button"
                  onClick={() => setCode(rotateInviteCode(boardId))}
                >
                  Neuen Code erzeugen
                </SecondaryButton>
              </>
            ) : null}
          </section>

          <div className="mt-6 space-y-3">
            {detail.canManage ? (
              <SecondaryButton
                type="button"
                onClick={() => {
                  archiveBoard(boardId);
                  router.push("/");
                }}
              >
                Board archivieren
              </SecondaryButton>
            ) : null}
            {detail.canDelete ? (
              <button
                type="button"
                className="w-full rounded-2xl bg-stamp-dark px-4 py-3.5 font-semibold text-white"
                onClick={() => {
                  if (confirm("Board unwiderruflich löschen?")) {
                    deleteBoard(boardId);
                    router.push("/");
                  }
                }}
              >
                Board löschen
              </button>
            ) : null}
          </div>
        </Screen>
      </div>
    </AuthGate>
  );
}

function Toggle({
  title,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-3xl border border-line bg-card px-4 py-4 text-left disabled:opacity-60"
    >
      <span className="font-semibold">{title}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${checked ? "bg-moss text-white" : "bg-paper-deep"}`}>
        {checked ? "An" : "Aus"}
      </span>
    </button>
  );
}
