# Freundes-Bingo

Web-App für ein gemeinsames Bingo-Board: Feldinhalte bearbeitet die ganze Gruppe, der persönliche Fortschritt (Haken, Notizen, Fotos) bleibt privat, bis das Board aufgelöst wird.

## Starten

```bash
npm install
npm run dev
```

Danach [http://localhost:3000](http://localhost:3000) öffnen. Ohne Supabase-Keys läuft die App im **Demo-Modus** (Daten im Browser, Realtime zwischen Tabs).

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

Für echte Nutzung über mehrere Handys: Supabase-Projekt anlegen, `supabase/schema.sql` ausführen, `.env.local` aus `.env.example` füllen. Der aktuelle Client nutzt den lokalen Store; der SQL-Stand ist die Ziel-Datenbank mit RLS.
# BingoMaker
