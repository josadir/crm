# CRM

Eigenes, schlankes CRM für einen Solo-Berater. Reine Web-App ohne Build-Schritt, ohne Server, ohne laufende Kosten.

- **App**: statisches HTML/CSS/JS, läuft über GitHub Pages oder lokal.
- **Daten**: eine JSON-Datei (`data/crm.json`) in einem **privaten** GitHub-Repo, geschrieben über die GitHub Contents API. Jede Änderung ist ein Commit, die Historie ist die Sicherung.
- **Arbeitskopie**: localStorage im Browser. Ohne Internet weiterarbeiten, Abgleich sobald wieder online.

## Funktionen

| Bereich | Inhalt |
|---|---|
| Übersicht | Kennzahlen, fällige Aufgaben und nächste Schritte, Pipeline nach Phase, letzte Aktivitäten, Interessenten ohne Bewegung |
| Kontakte | Suche, Statusfilter, Kontaktakte mit Vorgängen, Aufgaben und Aktivitäten-Zeitstrahl, Einwilligung für E-Mail-Werbung mit Datum |
| Pipeline | Kanban über Anfrage, Erstgespräch, Angebot, Verhandlung, Gewonnen, Verloren. Drag & Drop, Pflicht-Verlustgrund |
| Aufgaben | Schnellerfassung, Gruppen Überfällig / Heute / Diese Woche / Später / Ohne Datum |
| Einstellungen | GitHub-Anbindung, Sync-Status, JSON-Sicherung, CSV-Import/-Export, Demo-Daten |

## Einrichtung

### 1. Daten-Repo (privat)

Auf GitHub ein neues Repo `crm-daten` anlegen, **Private**, mit README. Mehr nicht, die Datei `data/crm.json` legt die App beim ersten Speichern selbst an.

### 2. Token

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.

- Repository access: *Only select repositories* → `crm-daten`
- Permissions → Repository permissions → **Contents: Read and write**
- Expiration: z. B. 1 Jahr (Erinnerung im Kalender setzen)

Der Token wird nur im Browser gespeichert (localStorage) und nie ins Repo geschrieben.

### 3. App starten

Lokal reicht ein Doppelklick auf `index.html`. Oder mit Node:

```
npm start
```

Dann im Browser `http://localhost:3000` öffnen, **Einstellungen**, Owner / Repo / Token eintragen, „Verbindung testen", „Speichern und synchronisieren".

### 4. App auf GitHub Pages (optional, 0 €)

Dieses Repo nach GitHub pushen (`josadir/crm`, darf öffentlich sein, es enthält nur Code). Repo → Settings → Pages → Source *Deploy from a branch*, Branch `main`, Ordner `/ (root)`. Die App liegt danach unter `https://josadir.github.io/crm/`.

GitHub Pages aus einem privaten Repo braucht GitHub Pro. Deshalb die Trennung: App öffentlich, Daten privat.

### 5. Zweites Gerät

Dieselbe URL öffnen, dieselben Einstellungen eintragen. Die Daten kommen von GitHub.

## Abgleich und Konflikte

- Nach jeder Änderung lädt die App den Stand 1,5 Sekunden später hoch (ein Commit mit sprechender Nachricht, z. B. `crm: Vorgang geändert: Chatbot Gästeanfragen`).
- Beim Öffnen lädt die App den GitHub-Stand. Liegen lokal ungesicherte Änderungen vor **und** hat sich GitHub inzwischen geändert, zeigt die Seitenleiste einen Konflikt mit zwei Knöpfen: GitHub-Stand übernehmen oder Browser-Stand hochladen. Nichts wird stillschweigend überschrieben.
- Verlorene Stände stehen in der Git-Historie des Daten-Repos (`git log -- data/crm.json`).

## Grenzen

- Eine Datei bis 1 MB über die Contents API. Das reicht für einige tausend Kontakte mit Aktivitäten. Danach aufteilen oder auf die Git Data API wechseln.
- Ein Nutzer. Für ein Team wäre ein Backend mit echter Rechteverwaltung nötig.
- Der Token im Browser ist so sicher wie der Browser. Auf fremden Rechnern nicht einrichten.

## Datenmodell

```
contacts[]   id, firma, person, email, telefon, website, ort, branche, quelle, status,
             einwilligungEmail, einwilligungDatum, notizen, erstellt, geaendert
deals[]      id, contactId, titel, phase, wert, naechsterSchritt, faellig,
             verlustgrund, notizen, erstellt, geaendert, geschlossen
activities[] id, contactId, dealId, typ, text, datum
tasks[]      id, contactId, dealId, titel, faellig, erledigt, erstellt
```

Auswahllisten stehen in `js/store.js` unter `K` (Phasen, Status, Quellen, Verlustgründe, Aktivitätstypen) und lassen sich dort anpassen.

## Dateien

```
index.html            Gerüst, lädt die Skripte in fester Reihenfolge
css/app.css           Gestaltung
js/util.js            Helfer (Escaping, Datum, Modal, Toast, Download)
js/github.js          GitHub Contents API (lesen, schreiben)
js/csv.js             CSV lesen/schreiben, Spaltenzuordnung
js/store.js           Datenmodell, CRUD, localStorage, Demo-Daten
js/sync.js            Abgleich mit GitHub, Konflikterkennung
js/forms.js           Formulare für Kontakt, Vorgang, Aufgabe, Aktivität
js/views/*.js         Die fünf Ansichten
js/app.js             Routing, Rendern, Ereignisse
```
