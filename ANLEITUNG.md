# Trading Journal – Version 2

Neu: Begrüßung mit Namen, rotierender Ticker oben, aufgeräumtes Dashboard und Synchronisierung zwischen Mac und iPhone.

## Hochladen

Dateien wie gehabt bei GitHub Pages oder Netlify Drop hochladen. Wenn du eine ältere Version ersetzt: einmal die Seite auf dem Handy schließen und neu öffnen, damit der Service Worker die neue Fassung zieht.

## Synchronisierung einrichten (einmalig, ca. 5 Minuten)

1. Auf supabase.com kostenlos registrieren, neues Projekt anlegen (Region Frankfurt ist am nächsten).
2. Links im Menü auf **SQL Editor**, das folgende einfügen und ausführen:

```sql
create table journals (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table journals enable row level security;
create policy "anon" on journals
  for all to anon using (true) with check (true);
```

3. Unter **Project Settings → API** findest du `Project URL` und den `anon public` Key.
4. In der App oben rechts auf **Sync** tippen, beides eintragen, dazu einen frei gewählten Journal-Namen (z. B. `myron-main`), dann auf "Verbinden und laden".
5. Auf dem zweiten Gerät exakt dieselben drei Angaben eintragen — fertig.

Danach wird nach jeder Änderung automatisch hochgeladen, und beim Öffnen der App automatisch geladen. Der Punkt neben "Sync" zeigt den Zustand: grün heißt synchron, gelb heißt gerade unterwegs, rot heißt Fehler.

**Wichtig zur Sicherheit:** Der anon key steckt nicht im Code, sondern nur lokal auf deinen Geräten. Trotzdem gilt: Wer Key und Journal-Namen kennt, kommt an die Daten. Nicht öffentlich posten. Wenn du es wirklich dicht haben willst, geht es mit Supabase-Login (E-Mail + Passwort) — das baue ich dir bei Bedarf ein.

## Ohne Sync

Funktioniert unverändert: alles bleibt lokal im Gerät, Export und Import über den Sync-Tab.
