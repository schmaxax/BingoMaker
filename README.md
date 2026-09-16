# Freundes-Bingo

Web-App für ein gemeinsames Bingo-Board: Feldinhalte bearbeitet die ganze Gruppe, der persönliche Fortschritt (Haken, Notizen, Fotos) bleibt privat, bis das Board aufgelöst wird.

## Starten

```bash
npm install
npm run dev
```

Danach [http://localhost:3000](http://localhost:3000) öffnen.

- **Ohne** `NEXT_PUBLIC_SUPABASE_*`: Demo-Modus (Daten nur im Browser/`localStorage`).
- **Mit** Supabase-Keys: Auth, Boards und Fortschritt landen in der Supabase-DB.

## Supabase + Vercel

1. In Supabase den Inhalt von `supabase/schema.sql` im **SQL Editor** ausführen.
2. Auth → Providers: E-Mail an. Für Tests optional **Confirm email** aus.
3. Authentication → URL Configuration: Site URL = deine Vercel-URL, Redirect URLs = `https://deine-app.vercel.app/**` und `http://localhost:3000/**`.
4. In Vercel → Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Neu deployen. Danach Registrierung/Login erscheint unter **Authentication → Users** und **Table Editor → profiles**.

## Getroffene Defaults zu den offenen Fragen

- **Ohne Owner-Modus:** Reveal per einfacher Mehrheit (`floor(n/2)+1`). Stimmen lassen sich zurückziehen. Zusätzlich gilt ein optionales Enddatum.
- **Bei Bingo:** visuelle Markierung der Gewinnlinie plus In-App-Hinweis an alle Mitglieder. Keine Push-Benachrichtigungen in dieser Version.
- **Reveal aus:** Fortschritte der Gruppe sind sofort sichtbar (kein Verstecken).
- **Reveal an:** fremde Fortschritte/Fotos sind bis zur Auflösung unsichtbar.
- Jeder Account kann Boards erstellen. Boardgröße 3×3 bis 6×6.

## Mehrspieler auf einem Gerät (Demo)

1. Account A anlegen, Board erstellen, Code notieren.
2. Logout, Account B anlegen, per Code beitreten.
3. B hakt Felder ab — A sieht das erst nach Reveal (wenn Reveal an ist).

Für echte Nutzung über mehrere Handys brauchst du die Supabase-Keys in Vercel (siehe oben).
# BingoMaker
