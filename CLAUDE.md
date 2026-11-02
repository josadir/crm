# Projektregeln CRM

- Zweck: Joels eigenes CRM mit ERP-Funktionen (Angebote, Aufträge, Rechnungen, Zeiten, Ausgaben, Finanzen, Termine). Ein Nutzer, so wenig Kosten wie möglich (Leitlinie vom 30.09.2026: Preis-Leistung schlägt Komfort). Kein Backend, kein Framework, kein Build-Schritt, keine Abhängigkeiten zur Laufzeit, keine KI-Aufrufe aus der App.
- Sprache: Deutsch in Oberfläche, Kommentaren, Doku und Commit-Nachrichten. Technische Begriffe, API-Namen und Befehle bleiben im Original. Deutsche Anführungszeichen „…“ in Texten.
- Architektur: klassische Skripte in fester Reihenfolge (siehe `index.html`), alles unter dem Namensraum `window.CRM`. Reihenfolge: util, github, csv, ics, store, sync, forms, views/belege, übrige views, app.
- Belegregeln (siehe README): Belege nie löschen, Nummernkreise je Art und Jahr, Rechnungen frieren Positionen/Empfänger/Absender ein, Summen werden gerechnet. Neue Funktionen dürfen diese Regeln nicht umgehen. Statuswechsel an Belegen immer über `journal()`.
- Daten: jede fachliche Änderung läuft über `CRM.store` und endet in `commit(label)`. Das Label wird zur Commit-Nachricht im Daten-Repo, also sprechend formulieren. Neue Sammlungen in `SAMMLUNGEN` und `normalisiere()` eintragen, damit alte Datenstände weiter laden.
- Ereignisse: `data-action` (Klick), `data-submit` (Formular), `data-change` (Checkbox/Select). Handler in `CRM.actions`. Kein inline `onclick`. Fehler aus dem Store mit `sicher()` abfangen, damit sie als Toast erscheinen.
- Formulare: Vorgaben über `rein(vorgabe)` filtern, sonst überschreibt `undefined` die Standardwerte (Fund 02.11.2026).
- Sicherheit: jede Ausgabe von Nutzerdaten durch `U.esc`. Der GitHub-Token bleibt im localStorage und darf nie in Dateien, Logs oder Commits landen. Kundendaten gehören nicht in dieses Repo (nur `data/` im privaten Daten-Repo).
- Läuft auch per Doppelklick auf `index.html` (file://). Deshalb keine ES-Module, keine Webfonts, keine externen Skripte.
- Prüfen nach Änderungen: `npm run check`, dann Edge headless mit der Testseite (Demo-Daten laden, alle Ansichten rendern, Formulare durchspielen) oder im Browser alle Ansichten mit Demo-Daten durchklicken.
- Git: nach jedem Commit sofort `git push` (Vorgabe Joel, 02.11.2026).
- Datum: per `date` ermitteln, nie raten.
