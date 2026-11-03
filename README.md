# CRM

Eigenes CRM mit ERP-Funktionen für einen Einzelunternehmer. Reine Web-App ohne Build-Schritt, ohne Server, ohne laufende Kosten.

- **App**: statisches HTML/CSS/JS, läuft über GitHub Pages (`https://josadir.github.io/crm/`) oder per Doppelklick auf `index.html`.
- **Daten**: eine JSON-Datei (`data/crm.json`) in einem **privaten** GitHub-Repo, geschrieben über die GitHub Contents API. Jede Änderung ist ein Commit, die Historie ist die Sicherung.
- **Arbeitskopie**: localStorage im Browser. Ohne Internet weiterarbeiten, Abgleich sobald wieder online.

## Module

| Bereich | Modul | Inhalt |
|---|---|---|
| | Übersicht | Pipeline-Wert, offene Rechnungen, Umsatz, nicht abgerechnete Zeit, Fälliges, nächste 7 Tage, letzte Gespräche, Interessenten ohne Bewegung |
| Vertrieb | Kontakte | Suche, Statusfilter, Kontaktakte mit Anschrift, Vorgängen, Belegen, Terminen, Aufgaben, Gesprächsverlauf; Einwilligung E-Mail-Werbung |
| Vertrieb | Historie | Komplette Chronik je Kunde: Gespräche, Belege und Phasenwechsel, Termine, erledigte Aufgaben; Filter und Volltextsuche |
| Vertrieb | Pipeline | Kanban: Anfrage, Erstgespräch, Angebot, Verhandlung, **Abschluss**, **Nachbereitung**, Gewonnen, Verloren. Nachbereitungs-Checkliste, Pflicht-Verlustgrund |
| Vertrieb | Angebote | AN-Nummernkreis, Positionen, Entwurf → Gesendet → Angenommen (legt Auftrag an) / Abgelehnt / Abgelaufen, Druckansicht |
| Arbeit | Aufträge | AUF-Nummernkreis, Positionen, Status Neu → In Arbeit → Fertig → Berechnet, Zeiten als Position übernehmen, Rechnung stellen |
| Arbeit | Zeiten | Timer, Schnellerfassung, Woche/Monat, abrechenbar/intern, Wert der offenen Zeiten je Auftrag |
| Arbeit | Aufgaben | Priorität, Fälligkeit, Bezug zu Kontakt und Auftrag |
| Arbeit | Termine | Agenda, Google-Kalender-Link und .ics je Termin, Sammel-Export |
| Finanzen | Rechnungen | RE-Nummernkreis, eingefrorene Positionen, Zahlungsziel, Zahlung erfassen, Mahnstufen, Storno-Beleg, Druckansicht mit Pflichtangaben, Schnellrechnung |
| Finanzen | Ausgaben | Belege mit Kategorie, Brutto/USt/Netto, wiederkehrende Posten, Monatsansicht, CSV |
| Finanzen | Finanzen | Monatsübersicht (gestellt, bezahlt, Ausgaben, Ergebnis), Umsatzsteuer je Quartal, offene Posten, Exporte |
| Marketing | Customer Journey | Trichter über sechs Stufen (Aufmerksamkeit bis Empfehlung), Dauer zwischen den Stufen, Quellen der Käufer, typische Wege bis zum Kauf |
| Marketing | Newsletter | Kampagnen, Öffnungs- und Klickraten, Käufe bis 7 Tage nach Klick, UTM-Links, Import der Versandberichte (CSV aus Brevo, Mailchimp, CleverReach) |
| Marketing | Workflows | Eigene Regeln wie bei HubSpot oder Asana: Auslöser, dann Schritte (Aktion, Wenn/Dann, Warten). Vorlagen, Test mit einem Kontakt, Protokoll je Lauf |
| | Einstellungen | Stammdaten (Absender, Steuernummer, Bank, Stundensatz, Zahlungsziel, § 19), GitHub-Anbindung, Sicherung, CSV, Kalender |

## Belegregeln

Übernommen als reine Systemstruktur aus einem Belegwesen-Muster, ohne fremde Inhalte:

1. **Belege werden nie gelöscht.** Angebote, Aufträge und Rechnungen bleiben. Statuswechsel landen im Journal (Verlauf). Eine Rechnung wird nur durch einen Storno-Beleg mit negativen Beträgen aufgehoben.
2. **Sprechende Nummern je Art und Jahr**: `AN-2026-0001`, `AUF-2026-0001`, `RE-2026-0001`. Fortlaufend, ohne Lücken, vergeben beim Anlegen.
3. **Eine Rechnung friert ein**: Positionen, Empfängeranschrift, Absenderdaten. Spätere Änderungen am Auftrag oder in den Stammdaten berühren sie nicht.
4. **Summen werden gerechnet, nicht gepflegt**: Beträge, Stunden, offene Posten, Umsatzsteuer entstehen aus den Einzelposten.
5. **Kontakte mit Belegen** werden nicht gelöscht, sondern auf „Archiv" gesetzt.

Typischer Weg: Vorgang in der Pipeline → Angebot → angenommen → Auftrag (Zeiten erfassen, Positionen) → Rechnung → Zahlung → Vorgang in Nachbereitung → Gewonnen.

## Workflows, Customer Journey, Newsletter

**Workflows** starten mit einem Auslöser und führen danach Schritte aus.

- Auslöser: neuer Kontakt, Ereignis (z. B. Newsletter geklickt, Zahlung, Bewertung), Journey-Stufe erreicht, Vorgang wechselt Phase, Aufgabe erledigt, keine Aktivität seit X Tagen, Angebot seit X Tagen ohne Antwort, Rechnung X Tage überfällig, manuell.
- Schritte: Aufgabe anlegen, Notiz in die Historie, Schlagwort setzen oder entfernen, Status setzen, Vorgang anlegen, Phase setzen, Ereignis eintragen, Webhook (z. B. n8n), Wenn/Dann mit Ja- und Nein-Zweig, Warten, Ende.
- Platzhalter in Texten: `{name}`, `{vorname}`, `{firma}`, `{email}`, `{objekt}`, `{datum}`.

Dieses CRM hat keinen Server. Workflows laufen deshalb im Browser, solange das CRM geöffnet ist (jede Minute und nach jeder Änderung). Was in der Zwischenzeit fällig wurde, holt es beim nächsten Öffnen nach. Am besten nur auf einem Gerät gleichzeitig offen haben, sonst können Aktionen doppelt laufen.

**Customer Journey**: Jeder Kontakt sammelt Kontaktpunkte. Die meisten entstehen aus vorhandenen Daten: Kontakt angelegt, Gespräche, Termine, Phasenwechsel, gesendete Angebote, bezahlte Rechnungen, erledigte Aufgaben. Weitere kommen über den Newsletter-Import oder „+ Ereignis" in der Kontaktakte dazu. Welche Art welcher Stufe zählt, legt „Stufen einstellen" fest.

**Newsletter und Datenschutz**: Öffnungen und Klicks personenbezogen auszuwerten braucht eine eigene Einwilligung (§ 25 TDDDG, DSGVO). Jeder Kontakt hat deshalb die Häkchen „E-Mail-Werbung" und „Erfolgsmessung". Ohne Erfolgsmessung zählt der Import nur anonym je Kampagne. Abmeldungen entfernen die Werbeeinwilligung.

Die Engine (`js/journey.js`) und die Ansichten Workflows, Customer Journey und Newsletter sind identisch mit dem Team-CRM (`..\CRM-Team`).

## Kalender

- **Einzeln**: Termin → „Google" öffnet Google Kalender mit Titel, Zeit, Ort, Beschreibung. „.ics" für Outlook und Apple.
- **Gesammelt**: Termine → „Kalender exportieren (.ics)" mit Terminen, fälligen Aufgaben, Rechnungsfristen, Fertigstellungsterminen. Die Einträge tragen stabile UIDs (`termin-<id>`), ein erneuter Import aktualisiert statt zu verdoppeln.
- **Per Claude (MCP)**: Claude mit Google-Calendar-Connector und Zugriff auf `crm.json` (GitHub-Connector auf `crm-daten` oder Datei hochladen). Anweisung:

```
Lies data/crm.json aus josadir/crm-daten. Lege für jeden Eintrag in appointments
mit datum >= heute einen Termin in meinem Google Kalender an, falls noch keiner
mit der Kennung "termin-<id>" in der Beschreibung existiert. Titel = titel,
Zeit = datum + von/bis (Europe/Berlin), ganztägig wenn von leer, Ort = ort,
Beschreibung = Kontaktname, Notizen und die Kennung.
```

Dasselbe Muster funktioniert für Aufgaben (`tasks` mit `faellig`) und Rechnungsfristen (`invoices` mit `status: "Offen"`).

## Einrichtung

### 1. Daten-Repo (privat)

Auf GitHub ein neues Repo `crm-daten` anlegen, **Private**, mit README. Die Datei `data/crm.json` legt die App beim ersten Speichern selbst an.

### 2. Token

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.

- Repository access: *Only select repositories* → `crm-daten`
- Permissions → Repository permissions → **Contents: Read and write** (Metadata: Read-only wird automatisch gesetzt)
- Expiration: z. B. 1 Jahr (Erinnerung im Kalender setzen)

Vorbelegter Link: `https://github.com/settings/personal-access-tokens/new?name=crm-daten&contents=write`

Der Token wird nur im Browser gespeichert (localStorage) und nie ins Repo geschrieben.

### 3. App starten

Lokal reicht ein Doppelklick auf `index.html`. Oder mit Node:

```
npm start
```

Dann **Einstellungen**: Stammdaten ausfüllen (Absender für Belege), Owner / Repo / Token eintragen, „Verbindung testen", „Speichern und synchronisieren".

### 4. App auf GitHub Pages (0 €)

Repo `crm` ist öffentlich (nur Code, keine Kundendaten; `data/`, `*.csv` und Sicherungen stehen in `.gitignore`). Settings → Pages → Deploy from a branch, `main`, `/ (root)`. Pages aus einem privaten Repo braucht GitHub Pro, deshalb die Trennung.

### 5. Zweites Gerät

Dieselbe URL öffnen, dieselben Einstellungen eintragen. Die Daten kommen von GitHub.

## Abgleich und Konflikte

- Nach jeder Änderung lädt die App den Stand 1,5 Sekunden später hoch (ein Commit mit sprechender Nachricht, z. B. `crm: Rechnung gestellt: RE-2026-0003`).
- Beim Öffnen lädt die App den GitHub-Stand. Liegen lokal ungesicherte Änderungen vor **und** hat sich GitHub inzwischen geändert, zeigt die Seitenleiste einen Konflikt mit zwei Knöpfen. Nichts wird stillschweigend überschrieben.
- Verlorene Stände stehen in der Git-Historie des Daten-Repos (`git log -- data/crm.json`).

## Grenzen

- Eine Datei bis 1 MB über die Contents API. Die Demo-Daten mit allen Modulen belegen rund 40 KB; das reicht für Jahre. Danach aufteilen oder auf die Git Data API wechseln.
- Ein Nutzer. Für ein Team wäre ein Backend mit Rechteverwaltung nötig.
- Der Token im Browser ist so sicher wie der Browser. Auf fremden Rechnern nicht einrichten.
- Rechnungen sind Entwürfe für die Buchhaltung mit den Pflichtangaben nach § 14 UStG. GoBD-konforme Archivierung (Unveränderbarkeit, Verfahrensdokumentation) leistet die App nicht; die Git-Historie hilft, ersetzt sie aber nicht. Belege (PDF, Fotos) bleiben außerhalb der App.
- Finanzen rechnet nach Zufluss (Ist-Versteuerung) und ersetzt keine Steuerberatung.

## Datenmodell

```
stammdaten     Absender, Steuernummer, USt-IdNr, Bank, Stundensatz, Zahlungsziel, Steuersatz, § 19, Fußtexte
contacts[]     id, firma, person, email, telefon, website, strasse, plz, ort, land, ustId, branche, quelle,
               status, einwilligungEmail, einwilligungDatum, notizen, erstellt, geaendert
deals[]        id, contactId, titel, phase, wert, naechsterSchritt, faellig, verlustgrund, nachbereitung{},
               abschlussDatum, notizen, erstellt, geaendert, geschlossen
activities[]   id, contactId, dealId, orderId, typ, betreff, text, datum
tasks[]        id, contactId, dealId, orderId, titel, faellig, prioritaet, erledigt, erstellt
quotes[]       id, nummer, jahr, laufendeNr, contactId, dealId, titel, einleitung, datum, gueltigBis,
               positionen[], status, notizen, orderId
orders[]       id, nummer, jahr, laufendeNr, contactId, dealId, quoteId, titel, beschreibung, datum, faellig,
               stundensatz, budget, positionen[], status, fertigAm, notizen
invoices[]     id, nummer, jahr, laufendeNr, contactId, orderId, titel, datum, leistungVon, leistungBis,
               faellig, zahlungszielTage, positionen[] (eingefroren), netto, steuer, brutto, saetze[],
               kleinunternehmer, empfaenger{}, absender{}, fuss, hinweis, status, bezahltAm, zahlungsart,
               mahnungen[], stornoVon, stornoId
times[]        id, datum, orderId, minuten, beschreibung, abrechenbar, abgerechnetPositionId
expenses[]     id, datum, lieferant, beschreibung, kategorie, belegNr, brutto, steuersatz, netto, steuer,
               bezahlt, zahlungsart, orderId, wiederkehrend, notizen
appointments[] id, titel, datum, von, bis, ort, kategorie, contactId, orderId, notizen
journal[]      id, datum, belegart, belegId, nummer, ereignis, notiz
position       id, art (Leistung|Pauschale|Auslage), bezeichnung, menge, einheit, einzelpreis, steuersatz
```

Auswahllisten stehen in `js/store.js` unter `K`.

## Dateien

```
index.html            Gerüst, Navigation, lädt die Skripte in fester Reihenfolge
css/app.css           Gestaltung inkl. Beleg-Layout und Druck
js/util.js            Helfer (Escaping, Datum, Modal, Toast, Download)
js/github.js          GitHub Contents API
js/csv.js             CSV lesen/schreiben
js/ics.js             Kalender-Export (.ics) und Google-Kalender-Links
js/store.js           Datenmodell, Belegregeln, Nummernkreise, Journal, CRUD, Auswertungen, Demo-Daten
js/sync.js            Abgleich mit GitHub, Konflikterkennung
js/journey.js         Customer Journey, Analytics, Workflow-Engine (identisch im Team-CRM)
js/auto-solo.js       Touchpoints aus den Daten ableiten, Workflows im Browser ausführen
js/journey-ui.js      Journey-Leiste und Ereignisse in der Kontaktakte
js/forms.js           Alle Formulare und Aktionen
js/views/belege.js    Dokumentansicht, Positionseditor, Summen, Verlauf
js/views/*.js         Die Ansichten
js/app.js             Routing, Rendern, Ereignisse
```

Prüfen: `npm run check` (Syntax aller Skripte), danach im Browser mit Demo-Daten alle Ansichten durchklicken.
