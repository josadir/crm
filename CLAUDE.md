# Projektregeln CRM

- Zweck: Joels eigenes CRM. Ein Nutzer, so wenig Kosten wie möglich (Leitlinie vom 30.09.2026: Preis-Leistung schlägt Komfort). Kein Backend, kein Framework, kein Build-Schritt, keine Abhängigkeiten zur Laufzeit.
- Sprache: Deutsch in Oberfläche, Kommentaren, Doku und Commit-Nachrichten. Technische Begriffe, API-Namen und Befehle bleiben im Original. Deutsche Anführungszeichen „…“ in Texten.
- Architektur: klassische Skripte in fester Reihenfolge (siehe `index.html`), alles unter dem Namensraum `window.CRM`. Reihenfolge einhalten: util, github, csv, store, sync, forms, views, app.
- Daten: jede fachliche Änderung läuft über `CRM.store` und endet in `commit(label)`. Das Label wird zur Commit-Nachricht im Daten-Repo, also sprechend formulieren.
- Ereignisse: `data-action` (Klick), `data-submit` (Formular), `data-change` (Checkbox/Select). Handler werden in `CRM.actions` registriert. Kein inline `onclick`.
- Sicherheit: jede Ausgabe von Nutzerdaten durch `U.esc`. Der GitHub-Token bleibt im localStorage und darf nie in Dateien, Logs oder Commits landen. Kundendaten gehören nicht in dieses Repo (nur `data/` im privaten Daten-Repo).
- Läuft auch per Doppelklick auf `index.html` (file://). Deshalb keine ES-Module, keine Webfonts, keine externen Skripte.
- Prüfen nach Änderungen: `node --check` über alle JS-Dateien, dann im Browser mit Demo-Daten (Einstellungen → Demo-Daten laden) alle fünf Ansichten einmal durchklicken.
- Datum: per `date` ermitteln, nie raten.
