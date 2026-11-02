window.CRM = window.CRM || {};
CRM.views = CRM.views || {};
(function (CRM) {
  const U = CRM.util, S = CRM.store, K = S.K, esc = U.esc;

  function stammdatenFormular() {
    const s = S.data.stammdaten;
    return `
      <div class="panel">
        <h3>Stammdaten (Absender auf Angeboten und Rechnungen)</h3>
        <p class="muted klein">Pflichtangaben nach § 14 UStG: vollständiger Name und Anschrift, Steuernummer oder USt-IdNr. Die Daten liegen in der Datendatei, nicht im Browser.</p>
        <form data-submit="stammdaten-speichern">
          <div class="feld-reihe">
            <div class="feld"><label>Name</label><input name="name" value="${esc(s.name)}" required></div>
            <div class="feld"><label>Firmenbezeichnung (optional)</label><input name="firma" value="${esc(s.firma)}"></div>
          </div>
          <div class="feld"><label>Straße und Hausnummer</label><input name="strasse" value="${esc(s.strasse)}"></div>
          <div class="feld-reihe">
            <div class="feld"><label>PLZ</label><input name="plz" value="${esc(s.plz)}"></div>
            <div class="feld"><label>Ort</label><input name="ort" value="${esc(s.ort)}"></div>
          </div>
          <div class="feld-reihe">
            <div class="feld"><label>E-Mail</label><input name="email" value="${esc(s.email)}"></div>
            <div class="feld"><label>Telefon</label><input name="telefon" value="${esc(s.telefon)}"></div>
          </div>
          <div class="feld"><label>Website</label><input name="website" value="${esc(s.website)}"></div>
          <div class="feld-reihe">
            <div class="feld"><label>Steuernummer</label><input name="steuernummer" value="${esc(s.steuernummer)}"></div>
            <div class="feld"><label>USt-IdNr.</label><input name="ustId" value="${esc(s.ustId)}"></div>
          </div>
          <div class="feld-reihe">
            <div class="feld"><label>IBAN</label><input name="iban" value="${esc(s.iban)}"></div>
            <div class="feld"><label>BIC / Bank</label><div style="display:flex;gap:6px"><input name="bic" value="${esc(s.bic)}" placeholder="BIC"><input name="bank" value="${esc(s.bank)}" placeholder="Bank"></div></div>
          </div>
          <div class="feld-reihe">
            <div class="feld"><label>Standard-Stundensatz netto (€)</label><input name="stundensatz" type="number" min="0" step="5" value="${esc(s.stundensatz || '')}"></div>
            <div class="feld"><label>Zahlungsziel (Tage)</label><input name="zahlungszielTage" type="number" min="0" value="${esc(s.zahlungszielTage)}"></div>
          </div>
          <div class="feld-reihe">
            <div class="feld"><label>Standard-USt-Satz %</label><select name="steuersatz">${U.options(K.STEUERSAETZE.map(String), String(s.steuersatz))}</select></div>
            <div class="feld"><label>Angebote gültig (Tage)</label><input name="angebotGueltigTage" type="number" min="1" value="${esc(s.angebotGueltigTage)}"></div>
          </div>
          <div class="feld feld-check"><input type="checkbox" id="klein" name="kleinunternehmer" ${s.kleinunternehmer ? 'checked' : ''}><label for="klein">Kleinunternehmerregelung § 19 UStG (keine Umsatzsteuer ausweisen)</label></div>
          <div class="feld"><label>Fußtext Rechnung</label><textarea name="rechnungsFuss" style="min-height:50px">${esc(s.rechnungsFuss)}</textarea></div>
          <div class="feld"><label>Fußtext Angebot</label><textarea name="angebotsFuss" style="min-height:40px">${esc(s.angebotsFuss)}</textarea></div>
          <div class="form-aktionen"><button type="submit" class="btn btn-primary">Stammdaten speichern</button></div>
        </form>
      </div>`;
  }

  function render() {
    const s = S.settings, m = S.meta, st = CRM.sync.status();
    const d = S.data;
    return `
      <h1>Einstellungen</h1>
      <div class="spalten-2">
        <div>
          ${stammdatenFormular()}
        </div>
        <div>
          <div class="panel">
            <h3>GitHub-Anbindung</h3>
            <p class="muted klein">Die Daten liegen als eine JSON-Datei in einem <strong>privaten</strong> Repo. Jede Änderung wird als Commit gespeichert. Der Token bleibt nur in diesem Browser (localStorage).</p>
            <form data-submit="einstellungen-speichern">
              <div class="feld-reihe">
                <div class="feld"><label>GitHub-Benutzer (Owner)</label><input name="owner" value="${esc(s.owner)}" placeholder="josadir" autocomplete="off"></div>
                <div class="feld"><label>Daten-Repo (privat)</label><input name="repo" value="${esc(s.repo)}" placeholder="crm-daten" autocomplete="off"></div>
              </div>
              <div class="feld-reihe">
                <div class="feld"><label>Branch</label><input name="branch" value="${esc(s.branch || 'main')}"></div>
                <div class="feld"><label>Dateipfad</label><input name="path" value="${esc(s.path || 'data/crm.json')}"></div>
              </div>
              <div class="feld"><label>Fine-grained Personal Access Token (nur Contents: Read and write, nur dieses Repo)</label><input name="token" type="password" value="${esc(s.token)}" autocomplete="off" placeholder="github_pat_…"></div>
              <div class="form-aktionen">
                <button type="button" class="btn links" data-action="github-testen">Verbindung testen</button>
                <button type="submit" class="btn btn-primary">Speichern und synchronisieren</button>
              </div>
            </form>
            <div id="github-test"></div>
            <h3 style="margin-top:14px">Synchronisation</h3>
            <p>Status: <strong>${esc(st.text)}</strong></p>
            <p class="muted klein">Letzter Abgleich: ${m.lastSync ? U.fmtZeit(m.lastSync) : 'noch nie'} · ungesicherte Änderungen: ${m.dirty ? 'ja' : 'nein'}</p>
            <div class="toolbar" style="margin:0">
              <button class="btn" data-action="sync-jetzt">Jetzt abgleichen</button>
              <button class="btn" data-action="sync-hochladen" title="Browser-Stand nach GitHub schreiben">Browser-Stand hochladen</button>
              <button class="btn" data-action="sync-herunterladen" title="GitHub-Stand übernehmen, lokale Änderungen verwerfen">GitHub-Stand übernehmen</button>
            </div>
          </div>
          <div class="panel">
            <h3>Daten</h3>
            <p class="muted klein">${d.contacts.length} Kontakte · ${d.deals.length} Vorgänge · ${d.quotes.length} Angebote · ${d.orders.length} Aufträge · ${d.invoices.length} Rechnungen · ${d.times.length} Zeiten · ${d.expenses.length} Ausgaben · ${d.appointments.length} Termine · Stand ${U.fmtZeit(d.updatedAt)}</p>
            <div class="toolbar" style="margin:0 0 8px">
              <button class="btn" data-action="json-export">Sicherung herunterladen (JSON)</button>
              <button class="btn" data-action="json-import">Sicherung einspielen (JSON)</button>
            </div>
            <div class="toolbar" style="margin:0 0 8px">
              <button class="btn" data-action="csv-export">Kontakte als CSV</button>
              <button class="btn" data-action="csv-import">Kontakte aus CSV</button>
              <button class="btn" data-action="kalender-export">Kalender (.ics)</button>
            </div>
            <div class="toolbar" style="margin:0">
              <button class="btn" data-action="demo-laden">Demo-Daten laden (fiktiv)</button>
              <button class="btn btn-gefahr" data-action="alles-loeschen">Alle Daten löschen</button>
            </div>
          </div>
          <div class="panel">
            <h3>Kalender-Anbindung</h3>
            <ol class="schritte klein">
              <li><strong>Einzeln:</strong> bei jedem Termin „Google" (öffnet Google Kalender mit allen Angaben) oder „.ics" (Outlook, Apple).</li>
              <li><strong>Gesammelt:</strong> „Kalender (.ics)" exportiert Termine, fällige Aufgaben und Rechnungsfristen. In Google Kalender: Einstellungen → Importieren. Gleiche Kennungen, deshalb keine Dubletten beim erneuten Import.</li>
              <li><strong>Per Claude (MCP):</strong> Claude mit Google-Calendar-Connector und Zugriff auf <code>crm.json</code> (GitHub-Connector oder Datei) bitten: „Lege alle Termine aus crm.json an, die noch nicht im Kalender sind, Kennung termin-&lt;id&gt; in die Beschreibung". Siehe README.</li>
            </ol>
          </div>
        </div>
      </div>`;
  }

  CRM.actions['einstellungen-speichern'] = (f) => {
    S.saveSettings({ owner: f.owner, repo: f.repo, branch: f.branch || 'main', path: f.path || 'data/crm.json', token: f.token });
    S.saveMeta({ sha: null });
    U.toast('Gespeichert', 'ok');
    CRM.sync.pull().then(() => CRM.render());
  };
  CRM.actions['github-testen'] = async (d, el) => {
    const form = el.closest('form');
    const f = U.formData(form);
    const ziel = document.getElementById('github-test');
    if (!f.owner || !f.repo || !f.token) { ziel.innerHTML = '<div class="hinweis fehler">Owner, Repo und Token ausfüllen.</div>'; return; }
    ziel.innerHTML = '<div class="hinweis">Prüfe …</div>';
    try {
      const info = await CRM.github.repoInfo(f);
      if (!info) throw Object.assign(new Error('GitHub 404: Repo nicht gefunden'), { status: 404 });
      const datei = await CRM.github.getFile(Object.assign({ branch: 'main', path: 'data/crm.json' }, f));
      ziel.innerHTML = `<div class="hinweis ${info.private ? 'ok' : 'fehler'}">Repo <strong>${esc(info.full_name)}</strong> erreichbar, ${info.private ? 'privat' : '<strong>ÖFFENTLICH – bitte auf privat stellen, hier liegen Kundendaten!</strong>'}, Standard-Branch <code>${esc(info.default_branch)}</code>. Datei <code>${esc(f.path || 'data/crm.json')}</code>: ${datei ? 'vorhanden' : 'noch nicht vorhanden (wird beim Speichern angelegt)'}.</div>`;
    } catch (e) {
      ziel.innerHTML = `<div class="hinweis fehler">${esc(e.message)}${e.status === 401 ? ' – Token ungültig oder abgelaufen.' : e.status === 404 ? ' – Repo nicht gefunden oder Token hat keinen Zugriff darauf.' : ''}</div>`;
    }
  };
  CRM.actions['sync-jetzt'] = () => CRM.sync.pull().then(() => CRM.render());
  CRM.actions['sync-hochladen'] = () => {
    if (!CRM.sync.konfiguriert()) { U.toast('GitHub ist nicht eingerichtet', 'fehler'); return; }
    if (!confirm('Den Stand aus diesem Browser nach GitHub schreiben? Ein abweichender Stand auf GitHub wird überschrieben (bleibt aber in der Git-Historie).')) return;
    S.saveMeta({ dirty: true, lastLabel: 'Browser-Stand manuell hochgeladen' });
    CRM.sync.pull('lokal').then(() => CRM.render());
  };
  CRM.actions['sync-herunterladen'] = () => {
    if (!CRM.sync.konfiguriert()) { U.toast('GitHub ist nicht eingerichtet', 'fehler'); return; }
    if (!confirm('Den Stand von GitHub übernehmen? Ungesicherte Änderungen in diesem Browser gehen verloren.')) return;
    CRM.sync.pull('remote').then(() => CRM.render());
  };
  CRM.actions['json-export'] = () => U.download(`crm-sicherung_${U.heute()}.json`, JSON.stringify(S.data, null, 2), 'application/json');
  CRM.actions['json-import'] = async () => {
    const datei = await U.dateiWaehlen('.json,application/json');
    if (!datei) return;
    let neu;
    try { neu = JSON.parse(datei.text); } catch (e) { U.toast('Keine gültige JSON-Datei', 'fehler'); return; }
    if (!neu || !Array.isArray(neu.contacts)) { U.toast('Datei enthält keine CRM-Daten', 'fehler'); return; }
    if (!confirm(`Sicherung mit ${neu.contacts.length} Kontakten einspielen? Der aktuelle Stand wird ersetzt.`)) return;
    S.replaceData(neu, true);
    U.toast('Sicherung eingespielt', 'ok');
  };
  CRM.actions['demo-laden'] = () => {
    if (S.data.contacts.length && !confirm('Demo-Daten ersetzen den aktuellen Stand (auch Stammdaten). Fortfahren?')) return;
    S.replaceData(S.demoDaten(), true);
    U.toast('Demo-Daten geladen (alles fiktiv)', 'ok');
    location.hash = '#/uebersicht';
  };
  CRM.actions['alles-loeschen'] = () => {
    if (!confirm('Wirklich ALLE Daten löschen (Kontakte, Belege, Zeiten, Ausgaben, Termine, Stammdaten)? Vorher am besten eine Sicherung herunterladen.')) return;
    if (!confirm('Letzte Frage: endgültig löschen?')) return;
    S.replaceData(S.leer(), true);
    U.toast('Alle Daten gelöscht');
  };

  CRM.views.einstellungen = { render };
})(window.CRM);
