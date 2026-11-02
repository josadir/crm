# Entscheidung: Stack für das eigene CRM

Stand 02.11.2026. Leitlinie: so wenig Geld wie möglich (Joel, 30.09.2026).

## Gewählt

| Baustein | Wahl | Kosten | Grund |
|---|---|---|---|
| Oberfläche | HTML/CSS/JS ohne Framework, ohne Build | 0 € | läuft per Doppelklick und auf GitHub Pages, nichts zu warten |
| Hosting App | GitHub Pages aus öffentlichem Repo `crm` | 0 € | Pages aus privaten Repos kostet GitHub Pro (4 $/Monat); das App-Repo enthält keine Kundendaten, darf also öffentlich sein |
| Datenbank | eine JSON-Datei in privatem Repo `crm-daten`, GitHub Contents API | 0 € | Versionierung gratis, Backup gratis, von jedem Gerät erreichbar, kein Server |
| Login | Fine-grained Personal Access Token nur für `crm-daten`, Contents Read/Write | 0 € | kein OAuth-Backend nötig; Token bleibt im Browser |
| Offline | localStorage als Arbeitskopie | 0 € | Änderungen gehen nicht verloren, Abgleich wenn online |

Fixkosten: **0 €**. Zeitkosten: Token einmal im Jahr erneuern.

## Verworfen

- **Supabase Free + Auth**: funktional besser (echte DB, Mehrbenutzer), aber Free-Projekte pausieren nach 7 Tagen ohne Zugriff, und für einen Nutzer ist es ein zweiter Dienst, den man pflegt. Erst sinnvoll, wenn jemand anderes mitarbeitet.
- **Next.js / React**: Build-Schritt, Abhängigkeiten, Updates. Für ein Ein-Personen-Werkzeug ohne Nutzen.
- **GitHub Issues als CRM**: Felder und Pipeline nur über Labels abbildbar, Kundendaten in Issues eines Repos unübersichtlich, kein Zahlfeld.
- **Fertige Open-Source-CRMs (Twenty, EspoCRM, SuiteCRM)**: brauchen Server (Hetzner ab 4 €/Monat) und Pflege, deutlich mehr Funktionen als nötig.
- **HubSpot Free / Pipedrive**: 0 € bzw. ab 14 €/Monat, aber Daten beim Anbieter, Upsell-Druck, kein eigener Code. Wäre die Wahl, wenn Joel keinen eigenen Code wollte.

## Bekannte Grenzen und wann sie greifen

- Contents API liefert Dateiinhalt nur bis 1 MB. Bei ca. 3.000 Kontakten mit vielen Aktivitäten wird es eng. Dann: Datei pro Jahr oder Git Data API (Blobs bis 100 MB).
- Zwei Geräte gleichzeitig: die App erkennt den Konflikt über den Datei-SHA und fragt. Kein automatisches Zusammenführen.
- GitHub-Rate-Limit: 5.000 Anfragen pro Stunde mit Token, die App braucht pro Änderung eine. Irrelevant.
- Token läuft ab (max. 1 Jahr bei fine-grained). Erinnerung in den Kalender.

## Nächste Ausbaustufen (nur bei Bedarf)

1. E-Mail-Verknüpfung: Gmail-Threads per Link in Aktivitäten eintragen (Hand), später n8n-Workflow, der eingehende Mails bekannter Kontakte als Aktivität in `crm.json` committet.
2. Angebots-/Rechnungsnummern am Vorgang, Export für die Buchhaltung.
3. Claude Code auf dem Daten-Repo: Wochenbericht, Scoring, Dublettensuche direkt auf `crm.json` (wie in Demo „Mini-CRM" der Schulung).
