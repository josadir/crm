// Journey in der Kontaktakte: Stufen-Leiste, Ereignis erfassen, in Workflow aufnehmen. Gemeinsame Datei für beide CRMs.
window.CRM = window.CRM || {};
(function (CRM) {
  const U = CRM.util, J = window.CRMJourney, esc = U.esc;
  const A = () => CRM.auto;
  const sicher = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); U.toast(e.message || String(e), 'fehler'); } };
  const kopf = (t) => `<div class="modal-kopf"><h2>${esc(t)}</h2><button type="button" class="btn-icon" data-action="modal-schliessen" aria-label="Schließen">×</button></div>`;

  function leiste(kontaktId) {
    if (!A()) return '';
    const k = A().kontakte().find((x) => x.id === kontaktId);
    const tps = A().tpsNachKontakt().get(kontaktId) || [];
    const j = J.journey(tps, A().journeyKonfig(), k);
    const laeufe = A().laeufe().filter((l) => l.kontaktId === kontaktId && l.status === 'laeuft');
    const wfName = (id) => (A().workflows().find((w) => w.id === id) || {}).name || 'Workflow';
    const letzte = tps.slice().sort((a, b) => String(b.datum).localeCompare(String(a.datum))).slice(0, 6);
    return `<div class="abschnitt"><div class="panel-kopf"><h3>Customer Journey</h3><button class="btn btn-klein" data-action="tp-neu" data-kontakt="${esc(kontaktId)}">+ Ereignis</button><button class="btn btn-klein" data-action="wf-aufnehmen" data-kontakt="${esc(kontaktId)}">In Workflow</button></div>
      <div class="jy-leiste">${j.stufen.map((s) => `<div class="jy-punkt ${s.erreicht ? 'an' : ''} ${s.key === j.stufe ? 'aktuell' : ''}" title="${esc(s.name)}${s.datum ? ' seit ' + esc(U.fmtDatum(s.datum)) : ''}"><span></span><div class="klein">${esc(s.name)}</div>${s.datum ? `<div class="meta">${esc(U.fmtDatum(s.datum))}</div>` : ''}</div>`).join('')}</div>
      <p class="klein muted">${tps.length} Kontaktpunkte${j.kaeufe ? ' · ' + j.kaeufe + ' Käufe · ' + U.fmtEur(j.umsatz) : ''}${k && k.tracking ? ' · Einwilligung Erfolgsmessung' : ''}</p>
      ${laeufe.length ? `<p class="klein">Läuft gerade in: ${laeufe.map((l) => `<a href="#/workflows/${esc(l.workflowId)}">${esc(wfName(l.workflowId))}</a>`).join(', ')}</p>` : ''}
      ${letzte.length ? `<ul class="liste klein">${letzte.map((t) => `<li><span class="dehnen">${esc(J.ART_NAME[t.art] || t.art)}${t.art === 'phase' ? ': ' + esc(t.titel) : t.titel && t.art !== 'erstkontakt' ? ' · ' + esc(t.titel) : ''}${t.wert ? ' · ' + U.fmtEur(t.wert) : ''}</span><span class="ende muted">${esc(U.fmtDatum(t.datum))}</span></li>`).join('')}</ul>` : ''}
    </div>`;
  }

  const AK = CRM.actions;
  AK['tp-neu'] = (d) => {
    const auswahl = J.ARTEN.filter((a) => !['erstkontakt', 'phase', 'aufgabe_erledigt'].includes(a[0]));
    const jetzt = new Date(); const lokal = U.localDate(jetzt) + 'T' + String(jetzt.getHours()).padStart(2, '0') + ':' + String(jetzt.getMinutes()).padStart(2, '0');
    U.modal(`${kopf('Ereignis erfassen')}<form data-submit="tp-speichern">
      <input type="hidden" name="kontaktId" value="${esc(d.kontakt)}">
      <div class="feld"><label>Was ist passiert?</label><select name="art">${U.options(auswahl.map((a) => [a[0], a[1]]), 'empfehlung')}</select></div>
      <div class="feld"><label>Beschreibung</label><input name="titel" placeholder="z. B. Google-Bewertung 5 Sterne, hat Frau X empfohlen"></div>
      <div class="feld-reihe"><div class="feld"><label>Zeitpunkt</label><input name="datum" type="datetime-local" value="${lokal}"></div><div class="feld"><label>Wert in € (optional, z. B. Bestellung)</label><input name="wert" type="number" min="0" step="0.01"></div></div>
      ${A().kampagnen().length ? `<div class="feld"><label>Kampagne (optional)</label><select name="kampagneId">${U.options(A().kampagnen().map((k) => [k.id, k.name]), '', '– keine –')}</select></div>` : ''}
      <div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Speichern</button></div></form>`);
  };
  AK['tp-speichern'] = sicher(async (f) => {
    await A().touchpointsAnlegen([{ kontaktId: f.kontaktId, art: f.art, titel: f.titel || '', datum: f.datum ? new Date(f.datum).toISOString() : new Date().toISOString(), wert: f.wert ? Number(f.wert) : null, kampagneId: f.kampagneId || null, quelle: 'manuell' }]);
    U.closeModal(); U.toast('Ereignis gespeichert', 'ok'); CRM.render();
  });
  AK['wf-aufnehmen'] = (d) => {
    const wfs = A().workflows().filter((w) => w.aktiv);
    if (!wfs.length) { U.toast('Kein aktiver Workflow vorhanden', 'fehler'); return; }
    U.modal(`${kopf('In Workflow aufnehmen')}<form data-submit="wf-aufnehmen-speichern"><input type="hidden" name="kontaktId" value="${esc(d.kontakt)}">
      <div class="feld"><label>Workflow</label><select name="workflowId" required>${U.options(wfs.map((w) => [w.id, w.name]), '')}</select></div>
      <p class="muted klein">Der Kontakt startet beim ersten Schritt, unabhängig vom Auslöser.</p>
      <div class="form-aktionen"><button type="button" class="btn" data-action="modal-schliessen">Abbrechen</button><button type="submit" class="btn btn-primary">Aufnehmen</button></div></form>`);
  };
  AK['wf-aufnehmen-speichern'] = sicher(async (f) => {
    const wf = A().workflows().find((w) => w.id === f.workflowId);
    await A().aufnehmen(wf, f.kontaktId);
    U.closeModal(); U.toast('Aufgenommen in „' + wf.name + '"', 'ok'); CRM.render();
  });

  CRM.journeyUI = { leiste };
})(window.CRM);
